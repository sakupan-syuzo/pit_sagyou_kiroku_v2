import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.js?url';
import { usePitStore, DEFAULT_RACE_NAMES } from '../store/usePitStore';
import type { Entry } from '../types';
import { normalizeCarNo } from '../utils/carNoUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type DriverRole = 'driver_a' | 'driver_b' | 'driver_c' | 'driver_d' | 'driver_e' | 'driver_f';
type ColumnRole = 'ignore' | 'carno' | 'pitno' | 'carno_driver_a' | DriverRole;
type GridRow = { y: number; cells: string[] };

import EntryManager from '../components/Registration/EntryManager';
import RaceSwitchWarningModal from '../components/Registration/RaceSwitchWarningModal';
import MasterExportModal from '../components/Registration/MasterExportModal';
import JsonImportModal from '../components/JsonImportModal';
import ImportResultModal from '../components/Registration/ImportResultModal';
import { useDataImport } from '../hooks/useDataImport';

interface Props {
  onNavigateToOutput?: () => void;
}

const RegistrationPage: React.FC<Props> = ({ onNavigateToOutput }) => {
  const [viewMode, setViewMode] = useState<'pdf' | 'manage'>('pdf');
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [mergeDrivers, setMergeDrivers] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [manageFilter, setManageFilter] = useState<'all' | 'missing'>('all');
  
  // 取込結果モーダル用状態
  const [isImportResultModalOpen, setIsImportResultModalOpen] = useState(false);
  const [importResult, setImportResult] = useState({ total: 0, fallbackCars: [] as string[], multipleAppears: [] as string[], missingDrivers: [] as string[] });

  // レース切り替え警告モーダルの状態
  const [pendingRaceId, setPendingRaceId] = useState<string | null>(null);

  // マスター配布
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const { pendingImportData, setPendingImportData, handleFileChange, handleConfirmMapping } = useDataImport();

  const races = usePitStore((s) => s.races);
  const activeRaceId = usePitStore((s) => s.activeRaceId);
  const setActiveRace = usePitStore((s) => s.setActiveRace);
  const updateRaceName = usePitStore((s) => s.updateRaceName);
  const setRaceEntries = usePitStore((s) => s.setRaceEntries);
  const records = usePitStore((s) => s.records);
  const setRecords = usePitStore((s) => s.setRecords);
  const laneStates = usePitStore((s) => s.laneStates);

  const activeRace = races.find((r) => r.id === activeRaceId) ?? races[0];

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let allItems: { text: string; x: number; y: number; width: number }[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        textContent.items.forEach((item: any) => {
          const text = item.str.trim();
          if (!text) return;
          // 罫線や無意味な記号はクラスタリングの邪魔になるため除外
          if (/^[\u2500-\u257F\u2800-\u28FF\u200B-\u200D_|\-ー─│┌┐└┘├┤┬┴┼]+$/.test(text)) return;
          
          allItems.push({
            text,
            x: item.transform[4],
            y: item.transform[5] - pageNum * 10000,
            width: item.width || 0,
          });
        });
      }

      if (allItems.length === 0) {
        alert('テキストが見つかりませんでした。画像化されたPDFの可能性があります。');
        return;
      }

      // 1. Y座標でグループ化して行を生成
      allItems.sort((a, b) => b.y - a.y);
      const rowsRaw: { items: typeof allItems; y: number }[] = [];
      let currentRow: typeof allItems = [];
      let lastY = allItems[0].y;

      const pushRow = (rowItems: typeof allItems) => {
        rowItems.sort((a, b) => a.x - b.x);
        
        // 行内で、X座標が連続している（文字間隔が狭い）アイテムを1つのセル文字列として結合する
        // これにより、文字単位で抽出された長い文字列（車両名など）が隣の列と誤って結合(Chaining)するのを防ぐ
        const mergedItems: typeof allItems = [];
        if (rowItems.length > 0) {
          let current = { ...rowItems[0] };
          for (let i = 1; i < rowItems.length; i++) {
            const item = rowItems[i];
            const gap = item.x - (current.x + current.width);
            
            // gapが6ポイント未満（通常の半角スペース程度）なら同じセルの続きとみなす
            if (gap < 6) {
              current.text += (gap > 2 ? ' ' : '') + item.text;
              current.width = (item.x + item.width) - current.x;
            } else {
              mergedItems.push(current);
              current = { ...item };
            }
          }
          mergedItems.push(current);
        }

        if (mergedItems.length > 0) {
          const avgY = mergedItems.reduce((sum, i) => sum + i.y, 0) / mergedItems.length;
          rowsRaw.push({ items: mergedItems, y: avgY });
        }
      };

      for (const item of allItems) {
        if (Math.abs(item.y - lastY) > 5) {
          if (currentRow.length > 0) pushRow(currentRow);
          currentRow = [item];
        } else {
          currentRow.push(item);
        }
        lastY = item.y;
      }
      if (currentRow.length > 0) pushRow(currentRow);

      // 2. 結合済みのアイテムのX座標を使ってクラスタリングし、「マスター列位置」を特定
      const mergedAllItems = rowsRaw.flatMap(r => r.items);
      const allX = mergedAllItems.map((i) => i.x).sort((a, b) => a - b);
      const masterCols: number[] = [];
      
      if (allX.length > 0) {
        let currentClusterSum = allX[0];
        let currentClusterCount = 1;

        for (let i = 1; i < allX.length; i++) {
          const currentClusterAvg = currentClusterSum / currentClusterCount;
          // prevXではなくクラスタ平均と比較し、12ポイント以上離れていれば別列とする
          if (allX[i] - currentClusterAvg > 12) {
            masterCols.push(currentClusterAvg);
            currentClusterSum = allX[i];
            currentClusterCount = 1;
          } else {
            currentClusterSum += allX[i];
            currentClusterCount++;
          }
        }
        masterCols.push(currentClusterSum / currentClusterCount);
      }

      // 3. 各行のアイテムをマスター列に直接当てはめる
      const parsedGrid: GridRow[] = [];
      for (const row of rowsRaw) {
        const rowData: string[] = Array(masterCols.length).fill('');
        for (const item of row.items) {
          let bestCol = 0;
          let minDiff = Infinity;
          for (let i = 0; i < masterCols.length; i++) {
            const diff = Math.abs(item.x - masterCols[i]);
            if (diff < minDiff) {
              minDiff = diff;
              bestCol = i;
            }
          }
          rowData[bestCol] = rowData[bestCol]
            ? rowData[bestCol] + ' ' + item.text
            : item.text;
        }
        parsedGrid.push({ y: row.y, cells: rowData });
      }

      setGrid(parsedGrid);

      // 4. 上位行のヘッダー文字から役割を自動推測
      const roles: ColumnRole[] = Array(masterCols.length).fill('ignore');
      let driverCount = 0;
      const drvRoles: DriverRole[] = ['driver_a', 'driver_b', 'driver_c', 'driver_d', 'driver_e', 'driver_f'];

      for (let c = 0; c < masterCols.length; c++) {
        let combinedText = '';
        for (let r = 0; r < Math.min(5, parsedGrid.length); r++) {
          combinedText += parsedGrid[r].cells[c] + ' ';
        }
        combinedText = combinedText.toLowerCase();

        if (
          combinedText.includes('ゼッケン') ||
          (combinedText.includes('no.') && !combinedText.includes('pit') && !combinedText.includes('ピット')) ||
          combinedText.includes('carno') ||
          combinedText.includes('車番')
        ) {
          roles[c] = 'carno';
        } else if (
          combinedText.includes('ピット') ||
          combinedText.includes('pit')
        ) {
          roles[c] = 'pitno';
        } else if (
          combinedText.includes('ドライバー') ||
          combinedText.includes('driver') ||
          combinedText.includes('ﾄﾞﾗｲﾊﾞｰ')
        ) {
          roles[c] = drvRoles[Math.min(driverCount, 5)];
          driverCount++;
        }
      }

      // 後処理：どの列も carno にならなかった場合、「数字+スペース+文字」パターンで混在列を検出
      if (!roles.includes('carno')) {
        for (let c = 0; c < masterCols.length; c++) {
          let mergedCount = 0;
          for (let r = 1; r < Math.min(10, parsedGrid.length); r++) {
            const cell = parsedGrid[r].cells[c]?.trim() ?? '';
            // "7 高木 彪乃介" のように数字+スペース+文字で始まるセルをカウント
            if (/^\d+\s+\S/.test(cell)) mergedCount++;
          }
          if (mergedCount >= 3) {
            roles[c] = 'carno_driver_a';
            break;
          }
        }
      }

      setColumnRoles(roles);

    } catch (err: any) {
      console.error(err);
      alert(`PDFの解析に失敗しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  const handleRoleChange = (colIndex: number, role: ColumnRole) => {
    const next = [...columnRoles];
    next[colIndex] = role;
    setColumnRoles(next);
  };

  const handleSave = () => {
    const storeEntries = usePitStore.getState().races.find(r => r.id === activeRaceId)?.entries ?? {};
    const newEntries: Record<string, Entry> = { ...storeEntries };

    const carNoIndices = columnRoles.map((r, i) => r === 'carno' ? i : -1).filter((i) => i !== -1);
    const pitNoIndices = columnRoles.map((r, i) => r === 'pitno' ? i : -1).filter((i) => i !== -1);
    const mergedColIndices = columnRoles.map((r, i) => r === 'carno_driver_a' ? i : -1).filter((i) => i !== -1);

    const hasMergedCol = mergedColIndices.length > 0;
    const hasDriver = columnRoles.some((r) => r.startsWith('driver_'));

    if (carNoIndices.length === 0 && !hasMergedCol) {
      alert('「Car No」か「ゼッケン＋ドラA（混在）」の列を選択してください。');
      return;
    }

    if (!hasDriver && pitNoIndices.length === 0 && !hasMergedCol) {
      alert('「ドライバー」か「PIT No」のどちらかの列を選択してください。');
      return;
    }

    const getClosestIndex = (target: number, indices: number[]) => {
      if (indices.length === 0) return -1;
      let closest = indices[0];
      let minDiff = Math.abs(target - indices[0]);
      for (let i = 1; i < indices.length; i++) {
        const diff = Math.abs(target - indices[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closest = indices[i];
        }
      }
      return closest;
    };

    const touchedCars = new Set<string>();
    const fallbackCars: string[] = [];
    const anchorCounts: Record<string, number> = {};

    if (hasMergedCol) {
      const headerKeywords = ['ゼッケン', 'driver', 'ドライバー', 'name', 'no', '番号'];
      for (const row of grid) {
        for (const c of mergedColIndices) {
          const cell = row.cells[c]?.trim() ?? '';
          const lower = cell.toLowerCase();
          if (headerKeywords.some((k) => lower.includes(k) && !/\d/.test(cell))) continue;

          let carNoStr = '';
          let driverStr = '';
          let isFallback = false;

          const matchA = cell.match(/^(\d{1,4})\s*[\s/／]\s*(.+)$/);
          if (matchA) {
            carNoStr = matchA[1];
            driverStr = matchA[2].trim();
          } else {
            if (cell && !/^\d/.test(cell)) {
              const leftCell = row.cells[c - 1]?.trim() ?? '';
              const matchB = leftCell.match(/(?:^|\s)(\d{1,4})$/);
              if (matchB) {
                carNoStr = matchB[1];
                driverStr = cell.replace(/^[ \/／]+/, '').trim();
                isFallback = true;
              }
            }
          }

          if (!carNoStr || !driverStr) continue;

          const cleanCarNo = normalizeCarNo(carNoStr);
          if (!cleanCarNo) continue;

          if (!newEntries[cleanCarNo]) {
            newEntries[cleanCarNo] = { id: cleanCarNo, carNo: cleanCarNo, drivers: [] };
          }

          if (!touchedCars.has(cleanCarNo)) {
            newEntries[cleanCarNo].drivers = [];
            touchedCars.add(cleanCarNo);
          }

          if (!newEntries[cleanCarNo].drivers.includes(driverStr)) {
            newEntries[cleanCarNo].drivers.push(driverStr);
          }

          anchorCounts[cleanCarNo] = (anchorCounts[cleanCarNo] || 0) + 1;
          if (isFallback) {
            fallbackCars.push(`#${cleanCarNo} ${driverStr}`);
          }

          const closestPit = getClosestIndex(c, pitNoIndices);
          if (closestPit !== -1) {
            const pitNoRaw = row.cells[closestPit]?.trim();
            if (pitNoRaw && /\d/.test(pitNoRaw)) {
              newEntries[cleanCarNo].pitNo = pitNoRaw;
            }
          }
        }
      }
    } else {
      const anchors: { y: number; cIndex: number; carNo: string; pitNo: string; drivers: Record<string, string[]> }[] = [];

      for (const row of grid) {
        for (const c of carNoIndices) {
          const carNoRaw = row.cells[c]?.trim();
          if (carNoRaw && /\d/.test(carNoRaw)) {
            const cleanCarNo = normalizeCarNo(carNoRaw);
            if (cleanCarNo) {
              const closestPit = getClosestIndex(c, pitNoIndices);
              const pitNoRaw = closestPit !== -1 ? row.cells[closestPit]?.trim() : '';
              anchors.push({
                y: row.y,
                cIndex: c,
                carNo: cleanCarNo,
                pitNo: pitNoRaw,
                drivers: { a: [], b: [], c: [], d: [], e: [], f: [] }
              });
              anchorCounts[cleanCarNo] = (anchorCounts[cleanCarNo] || 0) + 1;
            }
          }
        }
      }

      if (anchors.length > 0) {
        for (const row of grid) {
          // この行のドライバー文字列を役割ごとに収集
          const rowMap: Record<string, { col: number; text: string }[]> = { a: [], b: [], c: [], d: [], e: [], f: [] };
          let hasAnyDriver = false;

          for (let c = 0; c < columnRoles.length; c++) {
            const role = columnRoles[c];
            if (role.startsWith('driver_')) {
              const text = row.cells[c]?.trim();
              if (!text) continue;
              const lower = text.toLowerCase();
              if (lower.includes('driver') || lower.includes('ドライバー') || lower.includes('ﾄﾞﾗｲﾊﾞｰ') || lower.includes('氏名') || lower.includes('名前') || lower.includes('第1') || lower.includes('第2') || lower.includes('第3')) continue;

              const key = role.replace('driver_', '');
              if (rowMap[key]) {
                rowMap[key].push({ col: c, text });
                hasAnyDriver = true;
              }
            }
          }

          if (hasAnyDriver) {
            for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
              if (rowMap[key].length > 0) {
                // Determine which anchor block this set of drivers belongs to by taking the first column's closest carno column
                const firstCol = rowMap[key][0].col;
                const closestCarnoCol = getClosestIndex(firstCol, carNoIndices);
                
                let closestAnchor = null;
                let minDiff = Infinity;
                for (const a of anchors) {
                  if (a.cIndex === closestCarnoCol) {
                    const diff = Math.abs(row.y - a.y);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestAnchor = a;
                    }
                  }
                }

                if (closestAnchor && minDiff <= 60) {
                  // 同じ行に同じ役割が複数列ある場合はスペースで結合
                  const combined = rowMap[key].map(item => item.text).join(' ');
                  closestAnchor.drivers[key as keyof typeof closestAnchor.drivers].push(combined);
                }
              }
            }
          }
        }

        for (const anchor of anchors) {
          const finalDrivers: string[] = [];
          const usedMultipleRoles = ['b', 'c', 'd', 'e', 'f'].some((k) => anchor.drivers[k].length > 0);

          if (usedMultipleRoles) {
            for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
              const drvs = anchor.drivers[key];
              if (drvs.length > 0) finalDrivers.push(drvs.join(' / '));
            }
          } else {
            if (mergeDrivers) {
              if (anchor.drivers.a.length > 0) finalDrivers.push(anchor.drivers.a.join(' / '));
            } else {
              finalDrivers.push(...anchor.drivers.a);
            }
          }

          if (!newEntries[anchor.carNo]) {
            newEntries[anchor.carNo] = { id: anchor.carNo, carNo: anchor.carNo, drivers: [] };
          }

          if (!touchedCars.has(anchor.carNo)) {
            if (hasDriver) newEntries[anchor.carNo].drivers = [];
            touchedCars.add(anchor.carNo);
          }

          for (const d of finalDrivers) {
            if (!newEntries[anchor.carNo].drivers.includes(d)) {
              newEntries[anchor.carNo].drivers.push(d);
            }
          }

          if (anchor.pitNo) {
            newEntries[anchor.carNo].pitNo = anchor.pitNo;
            touchedCars.add(anchor.carNo);
          }
        }
      }
    }

    setRaceEntries(activeRaceId, newEntries);

    const multipleAppears = Object.entries(anchorCounts).filter(([_, c]) => c > 1).map(([carNo]) => `#${carNo}`);
    const missingDrivers = Object.values(newEntries).filter(e => e.drivers.length === 0).map(e => `#${e.carNo}`);
    
    setImportResult({
      total: touchedCars.size,
      fallbackCars,
      multipleAppears,
      missingDrivers
    });
    setIsImportResultModalOpen(true);
  };

  const handleStartEditName = () => {
    setNameInput(activeRace.name);
    setEditingName(true);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      updateRaceName(activeRaceId, trimmed);
    } else {
      // 空欄で保存した場合はデフォルト名（レース1〜5）に戻す
      const idx = races.findIndex((r) => r.id === activeRaceId);
      if (idx >= 0 && DEFAULT_RACE_NAMES[idx]) {
        updateRaceName(activeRaceId, DEFAULT_RACE_NAMES[idx]);
      }
    }
    setEditingName(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex-none bg-white border-b border-gray-200 px-3 py-2 shadow-sm z-10 space-y-2">
        {/* セッション未クリア警告バナー */}
        {records.length > 0 && (
          <div className="bg-amber-100 text-amber-800 px-3 py-2 text-xs font-bold rounded flex items-center gap-1 mb-2 mt-1">
            ⚠️ 現在 {records.length} 件の作業記録が未クリアです
          </div>
        )}

        {/* レース選択 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 shrink-0">記録対象レース：</span>
          <select
            value={activeRaceId}
            onChange={(e) => {
              const targetId = e.target.value;
              const hasWorkingLanes = laneStates.some(ls => ls?.status === 'working');
              if (hasWorkingLanes) {
                alert('作業中のレーンがあるため、レースを切り替えられません。\nPIT OUT または取り消しをしてから操作してください。');
                return;
              }

              if (records.length > 0) {
                setPendingRaceId(targetId);
              } else {
                setActiveRace(targetId);
                setEditingName(false);
                setGrid([]);
                setColumnRoles([]);
              }
            }}
            className="flex-1 text-sm font-bold border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name}
                {Object.keys(race.entries).length > 0 ? ` ✅ (${Object.keys(race.entries).length}台)` : ''}
              </option>
            ))}
          </select>
        </div>
        {/* レース名編集 */}
        <div className="flex items-center gap-2">
          {editingName ? (
            <>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
                className="flex-1 text-sm border border-blue-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="レース名を入力"
              />
              <button
                onClick={handleSaveName}
                className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5"
              >保存</button>
              <button
                onClick={() => setEditingName(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-700"
              >キャンセル</button>
            </>
          ) : (
            <button
              onClick={handleStartEditName}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
            >
              ✏️ レース名を変更（現在: {activeRace.name}）
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
          <div className="flex w-full sm:w-auto bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('pdf')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
                viewMode === 'pdf' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              📄 PDFから登録
            </button>
            <button
              onClick={() => {
                setViewMode('manage');
                setManageFilter('all');
              }}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
                viewMode === 'manage' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              🛠️ 登録済みデータを管理
            </button>
          </div>
        </div>
      </div>

      {/* ボディ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-2 gap-2">
        {viewMode === 'pdf' ? (
          <>
        <div className="shrink-0 bg-white p-3 rounded-xl shadow-sm space-y-1">
          <p className="text-sm font-bold text-gray-700">1. PDFファイルを選択してください</p>
          <div className="flex items-center justify-between">
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              disabled={isParsing}
              className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {isParsing && (
              <span className="text-sm text-blue-600 font-bold animate-pulse">解析中...</span>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {grid.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              ここに読み取ったデータが表形式で表示されます
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-200 sticky top-0 shadow-sm z-10">
                  <tr>
                    {columnRoles.map((role, colIndex) => (
                      <th key={colIndex} className="p-2 border-r border-gray-300 font-normal">
                        <select
                          value={role}
                          onChange={(e) => handleRoleChange(colIndex, e.target.value as ColumnRole)}
                          className={`w-full text-xs font-bold p-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            role === 'carno'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : role === 'pitno'
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : role === 'carno_driver_a'
                              ? 'bg-orange-100 text-orange-800 border-orange-300'
                              : role.startsWith('driver_')
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-white text-gray-500 border-gray-300'
                          }`}
                        >
                          <option value="ignore">❌ 無視</option>
                          <option value="carno">🏎️ Car No</option>
                          <option value="pitno">🏁 PIT No</option>
                          <option value="carno_driver_a">🔢 ゼッケン＋ドラA（混在）</option>
                          <option value="driver_a">👤 ドラ A</option>
                          <option value="driver_b">👤 ドラ B</option>
                          <option value="driver_c">👤 ドラ C</option>
                          <option value="driver_d">👤 ドラ D</option>
                          <option value="driver_e">👤 ドラ E</option>
                          <option value="driver_f">👤 ドラ F</option>
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-gray-200 bg-white hover:bg-gray-50">
                      {row.cells.map((cell, colIndex) => {
                        const role = columnRoles[colIndex];
                        return (
                          <td
                            key={colIndex}
                            className={`p-2 border-r border-gray-100 max-w-[200px] truncate ${
                              role === 'carno'
                                ? 'bg-amber-50/50 font-bold'
                                : role === 'carno_driver_a'
                                ? 'bg-orange-50/50 font-bold'
                                : role.startsWith('driver_')
                                ? 'bg-blue-50/50'
                                : 'text-gray-400'
                            }`}
                            title={cell}
                          >
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {grid.length > 0 && (
            <div className="p-2 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500 shrink-0">
                ※各列の上のプルダウンで「Car No」「ドライバー」を正しく割り当ててください。不要な列は「❌ 無視」のままでOKです。
              </p>
            </div>
          )}
        </div>
          </>
        ) : (
          <EntryManager
            race={activeRace}
            onUpdateEntries={(newEntries) => setRaceEntries(activeRaceId, newEntries)}
            initialFilter={manageFilter}
          />
        )}
      </div>

      {/* フッター (PDFモードのみ) */}
      {viewMode === 'pdf' && (
        <div className="p-3 bg-white border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-sm z-10">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={mergeDrivers}
              onChange={(e) => setMergeDrivers(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0"
            />
            <div className="flex flex-col">
              <span>ドラA列の縦並び複数行を1名に結合する</span>
              <span className="text-[10px] text-gray-500 font-normal leading-tight">（スーパーフォーミュラ等で、英語名と日本語名が別行にある場合のみ）</span>
            </div>
          </label>

          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`「${activeRace.name}」のエントリーリストとピット割り当てをクリアします。よろしいですか？`)) {
                  setRaceEntries(activeRaceId, {});
                  alert(`「${activeRace.name}」のデータをクリアしました。`);
                }
              }}
              className="px-4 py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors shadow shrink-0"
            >
              このレースのデータクリア
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={grid.length === 0}
              className="px-6 py-3 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl transition-colors shadow shrink-0"
            >
              保存して適用
            </button>
          </div>
        </div>
      )}

      {/* 週末マスターの配布セクション */}
      <div className="shrink-0 p-3 bg-white border-t border-gray-200 z-10">
        <div className="bg-indigo-50 rounded-2xl shadow-sm border border-indigo-100 p-4 space-y-3">
          <h2 className="text-sm font-bold text-indigo-800 flex items-center gap-1.5">
            📦 週末マスターの配布
          </h2>
          <p className="text-xs text-indigo-600/80">
            全クラスのエントリーをまとめて書き出し・読み込みできます
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm min-h-[48px]"
            >
              📤 書き出す
            </button>
            
            <label className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer min-h-[48px]">
              📥 読み込む
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      <MasterExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {pendingImportData && (
        <JsonImportModal
          data={pendingImportData}
          onClose={() => setPendingImportData(null)}
          onConfirm={handleConfirmMapping}
        />
      )}

      <RaceSwitchWarningModal
        isOpen={pendingRaceId !== null}
        recordCount={records.length}
        onCancel={() => setPendingRaceId(null)}
        onNavigateToOutput={onNavigateToOutput}
        onClearAndSwitch={() => {
          setRecords([]);
          if (pendingRaceId) setActiveRace(pendingRaceId);
          setPendingRaceId(null);
          setEditingName(false);
          setGrid([]);
          setColumnRoles([]);
        }}
        onKeepAndSwitch={() => {
          if (pendingRaceId) setActiveRace(pendingRaceId);
          setPendingRaceId(null);
          setEditingName(false);
          setGrid([]);
          setColumnRoles([]);
        }}
      />
      
      <ImportResultModal
        isOpen={isImportResultModalOpen}
        total={importResult.total}
        fallbackCars={importResult.fallbackCars}
        multipleAppears={importResult.multipleAppears}
        missingDrivers={importResult.missingDrivers}
        onClose={() => setIsImportResultModalOpen(false)}
        onNavigateToManage={() => {
          setViewMode('manage');
          setManageFilter('missing');
        }}
      />
    </div>
  );
};

export default RegistrationPage;
