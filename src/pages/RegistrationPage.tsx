import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePitStore } from '../store/usePitStore';
import type { Entry } from '../types';
import { normalizeCarNo } from '../utils/carNoUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

type DriverRole = 'driver_a' | 'driver_b' | 'driver_c' | 'driver_d' | 'driver_e' | 'driver_f';
type ColumnRole = 'ignore' | 'carno' | 'pitno' | 'carno_driver_a' | DriverRole;
type GridRow = { y: number; cells: string[] };

import EntryManager from '../components/Registration/EntryManager';

const RegistrationPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'pdf' | 'manage'>('pdf');
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [mergeDrivers, setMergeDrivers] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const races = usePitStore((s) => s.races);
  const activeRaceId = usePitStore((s) => s.activeRaceId);
  const setActiveRace = usePitStore((s) => s.setActiveRace);
  const updateRaceName = usePitStore((s) => s.updateRaceName);
  const setRaceEntries = usePitStore((s) => s.setRaceEntries);

  const activeRace = races.find((r) => r.id === activeRaceId) ?? races[0];

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let allItems: { text: string; x: number; y: number }[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        textContent.items.forEach((item: any) => {
          const text = item.str.trim();
          if (!text) return;
          allItems.push({
            text,
            x: item.transform[4],
            // ページごとにY座標をオフセットして混ざらないようにする
            y: item.transform[5] - pageNum * 10000,
          });
        });
      }

      if (allItems.length === 0) {
        alert('テキストが見つかりませんでした。画像化されたPDFの可能性があります。');
        return;
      }

      // 1. Y座標でグループ化して行を生成（行ごとの平均Y座標も計算）
      allItems.sort((a, b) => b.y - a.y);
      const rowsRaw: { items: { text: string; x: number; y: number }[], y: number }[] = [];
      let currentRow: { text: string; x: number; y: number }[] = [];
      let lastY = allItems[0].y;

      for (const item of allItems) {
        if (Math.abs(item.y - lastY) > 5) {
          if (currentRow.length > 0) {
            currentRow.sort((a, b) => a.x - b.x);
            const avgY = currentRow.reduce((sum, i) => sum + i.y, 0) / currentRow.length;
            rowsRaw.push({ items: currentRow, y: avgY });
          }
          currentRow = [item];
        } else {
          currentRow.push(item);
        }
        lastY = item.y;
      }
      if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.x - b.x);
        const avgY = currentRow.reduce((sum, i) => sum + i.y, 0) / currentRow.length;
        rowsRaw.push({ items: currentRow, y: avgY });
      }

      // 2. 全X座標をクラスタリングして「マスター列位置」を特定
      const allX = allItems.map((i) => i.x).sort((a, b) => a - b);
      const masterCols: number[] = [];
      if (allX.length > 0) {
        let currentClusterSum = allX[0];
        let currentClusterCount = 1;
        let prevX = allX[0];

        for (let i = 1; i < allX.length; i++) {
          if (allX[i] - prevX > 15) {
            masterCols.push(currentClusterSum / currentClusterCount);
            currentClusterSum = allX[i];
            currentClusterCount = 1;
          } else {
            currentClusterSum += allX[i];
            currentClusterCount++;
          }
          prevX = allX[i];
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

    } catch (err) {
      console.error(err);
      alert('PDFの解析に失敗しました。');
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
    const newEntries: Record<string, Entry> = { ...storeEntries }; // 既存データとマージ
    const carNoIndices = columnRoles.map((r, i) => r === 'carno' ? i : -1).filter(i => i !== -1);
    const pitNoIndices = columnRoles.map((r, i) => r === 'pitno' ? i : -1).filter(i => i !== -1);
    const mergedColIndices = columnRoles.map((r, i) => r === 'carno_driver_a' ? i : -1).filter(i => i !== -1);

    const hasMergedCol = mergedColIndices.length > 0;

    // 「ゼッケン＋ドライバー混在」列を使う場合はcarnoチェックを免除
    if (carNoIndices.length === 0 && !hasMergedCol) {
      alert('「Car No」か「ゼッケン＋ドラA（混在）」の列を選択してください。');
      return;
    }

    const hasDriver = columnRoles.some((r) => r.startsWith('driver_'));
    if (!hasDriver && pitNoIndices.length === 0 && !hasMergedCol) {
      alert('「ドライバー」か「PIT No」のどちらかの列を選択してください。');
      return;
    }

    // ---- 【混在列モード】 carno_driver_a の場合は独自のシンプルな処理で完結 ----
    if (hasMergedCol) {
      // パターン: "7 高木 彪乃介/ T.TAKAGI" → carNo="7", driverA="高木 彪乃介/ T.TAKAGI"
      const headerKeywords = ['ゼッケン', 'driver', 'ドライバー', 'name', 'no', '番号'];
      for (const row of grid) {
        for (const cIndex of mergedColIndices) {
          const cell = row.cells[cIndex]?.trim() ?? '';
          const match = cell.match(/^(\d+)\s+(.+)$/);
          if (!match) continue;
          const lower = cell.toLowerCase();
          if (headerKeywords.some((k) => lower.includes(k) && !/\d/.test(cell))) continue;

          const cleanCarNo = normalizeCarNo(match[1]);
          const driverName = match[2].trim();
          if (!cleanCarNo || !driverName) continue;

          if (!newEntries[cleanCarNo]) {
            newEntries[cleanCarNo] = { id: cleanCarNo, carNo: cleanCarNo, drivers: [] };
          }
          if (!newEntries[cleanCarNo].drivers.includes(driverName)) {
            newEntries[cleanCarNo].drivers = [driverName];
          }
          
          // pitNo列があれば、一番近い列から取得
          if (pitNoIndices.length > 0) {
            const closestPitIdx = pitNoIndices.reduce((a, b) => Math.abs(b - cIndex) < Math.abs(a - cIndex) ? b : a);
            const pitNoRaw = row.cells[closestPitIdx]?.trim();
            if (pitNoRaw && /\d/.test(pitNoRaw)) {
              newEntries[cleanCarNo].pitNo = pitNoRaw;
            }
          }
        }
      }
      setRaceEntries(activeRaceId, newEntries);
      alert(`${Object.keys(newEntries).length} 件を「${activeRace.name}」に登録しました。`);
      return;
    }

    // ---- 【通常モード】 ----

    // 1. Car No (アンカー) をすべて抽出
    const anchors: {
      y: number;
      carNo: string;
      pitNo: string;
      drivers: { a: string[]; b: string[]; c: string[]; d: string[]; e: string[]; f: string[] };
      cIndex: number;
    }[] = [];

    for (const row of grid) {
      for (const cIdx of carNoIndices) {
        const carNoRaw = row.cells[cIdx]?.trim();
        if (carNoRaw && /\d/.test(carNoRaw)) {
          const cleanCarNo = normalizeCarNo(carNoRaw);
          let pitNoRaw = '';
          if (pitNoIndices.length > 0) {
            const closestPitIdx = pitNoIndices.reduce((a, b) => Math.abs(b - cIdx) < Math.abs(a - cIdx) ? b : a);
            pitNoRaw = row.cells[closestPitIdx]?.trim() || '';
          }
          if (cleanCarNo) {
            anchors.push({ y: row.y, carNo: cleanCarNo, pitNo: pitNoRaw, drivers: { a: [], b: [], c: [], d: [], e: [], f: [] }, cIndex: cIdx });
          }
        }
      }
    }

    if (anchors.length === 0) {
      alert('有効なCar Noが見つかりませんでした。');
      return;
    }

    // 2. 各行のドライバーを、左右ブロックごとにY座標が最も近いCar Noに割り当てる
    for (const row of grid) {
      const blockDrivers = new Map<number, { a: string[]; b: string[]; c: string[]; d: string[]; e: string[]; f: string[] }>();

      for (let c = 0; c < columnRoles.length; c++) {
        const role = columnRoles[c];
        if (!role.startsWith('driver_')) continue;
        const text = row.cells[c]?.trim();
        if (!text) continue;

        const lower = text.toLowerCase();
        // ヘッダー誤検知フィルタ
        if (lower.includes('driver') || lower.includes('ドライバー') || lower.includes('ﾄﾞﾗｲﾊﾞｰ') || lower.includes('氏名') || lower.includes('名前') || lower.includes('第1') || lower.includes('第2') || lower.includes('第3')) {
          continue;
        }

        // このドライバー列に一番近い Car No 列（ブロック）を特定
        const closestCarNoIdx = carNoIndices.reduce((a, b) => Math.abs(b - c) < Math.abs(a - c) ? b : a);
        if (!blockDrivers.has(closestCarNoIdx)) {
          blockDrivers.set(closestCarNoIdx, { a: [], b: [], c: [], d: [], e: [], f: [] });
        }
        
        const key = role.replace('driver_', '') as 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
        blockDrivers.get(closestCarNoIdx)![key].push(text);
      }

      // ブロックごとに最も近いアンカーへドライバーを紐付け
      for (const [blockCarNoIdx, drvs] of blockDrivers.entries()) {
        const anchorsInBlock = anchors.filter((a) => a.cIndex === blockCarNoIdx);
        if (anchorsInBlock.length === 0) continue;

        let closestAnchor = anchorsInBlock[0];
        let minDiff = Math.abs(row.y - closestAnchor.y);
        for (let i = 1; i < anchorsInBlock.length; i++) {
          const diff = Math.abs(row.y - anchorsInBlock[i].y);
          if (diff < minDiff) {
            minDiff = diff;
            closestAnchor = anchorsInBlock[i];
          }
        }

        // ページ上部のタイトルやフッターなど、離れすぎているテキストは無視（閾値: 60px）
        if (minDiff > 60) continue;

        for (const key of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
          if (drvs[key].length > 0) {
            // 同じ行に同じ役割（例：ドラA）が複数列ある場合（姓・名がスペースで分断された列など）は、スペースで結合して1人分とする
            const combined = drvs[key].join(' ');
            if (!closestAnchor.drivers[key].includes(combined)) {
              closestAnchor.drivers[key].push(combined);
            }
          }
        }
      }
    }

    // 3. エントリーの生成
    for (const anchor of anchors) {
      const finalDrivers: string[] = [];
      // 複数の役割（A以外）が使われているかチェック
      const usedMultipleRoles = ['b', 'c', 'd', 'e', 'f'].some((k) => anchor.drivers[k as keyof typeof anchor.drivers].length > 0);

      if (usedMultipleRoles) {
        // S耐やSGTなど、明示的に複数ドラ（A, B...）を割り当てている場合
        for (const key of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
          const drvs = anchor.drivers[key];
          if (drvs.length > 0) {
            // 同一役割で複数行ある場合はスラッシュ結合（通常は1行）
            finalDrivers.push(drvs.join(' / '));
          }
        }
      } else {
        // ドラAしか使われていない場合（SFの複数行、またはWECの縦並び）
        if (mergeDrivers) {
          // SFモード：縦並びの文字をすべてスラッシュ結合して1人のドライバー（A）にする
          if (anchor.drivers.a.length > 0) finalDrivers.push(anchor.drivers.a.join(' / '));
        } else {
          // WECモード：縦並びの文字を独立した別々のドライバー（A, B, C...）に展開する
          finalDrivers.push(...anchor.drivers.a);
        }
      }

      if (finalDrivers.length > 0) {
        if (!newEntries[anchor.carNo]) {
          newEntries[anchor.carNo] = { id: anchor.carNo, carNo: anchor.carNo, drivers: [] };
        }
        newEntries[anchor.carNo].drivers = finalDrivers;
      }
      
      if (anchor.pitNo) {
        if (!newEntries[anchor.carNo]) {
          newEntries[anchor.carNo] = { id: anchor.carNo, carNo: anchor.carNo, drivers: [] };
        }
        newEntries[anchor.carNo].pitNo = anchor.pitNo;
      }
    }

    setRaceEntries(activeRaceId, newEntries);
    alert(`${anchors.length} 件の情報を「${activeRace.name}」に更新しました。\n（※すでに登録されていた他のエントリーと結合されました）`);
  };

  const handleStartEditName = () => {
    setNameInput(activeRace.name);
    setEditingName(true);
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateRaceName(activeRaceId, nameInput.trim());
    }
    setEditingName(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex-none bg-white border-b border-gray-200 px-3 py-2 shadow-sm z-10 space-y-2">
        {/* レース選択 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 shrink-0">記録対象レース：</span>
          <select
            value={activeRaceId}
            onChange={(e) => {
              setActiveRace(e.target.value);
              setEditingName(false);
              setGrid([]);
              setColumnRoles([]);
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
              onClick={() => setViewMode('manage')}
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
    </div>
  );
};

export default RegistrationPage;
