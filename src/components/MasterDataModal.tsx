import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePitStore } from '../store/usePitStore';
import type { Entry } from '../types';
import { normalizeCarNo } from '../utils/carNoUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

type ColumnRole = 'ignore' | 'carno' | 'driver';

// Y座標を保持する行データ
type GridRow = { y: number; cells: string[] };

interface MasterDataModalProps {
  onClose: () => void;
}

const MasterDataModal: React.FC<MasterDataModalProps> = ({ onClose }) => {
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const setEntries = usePitStore((s) => s.setEntries);

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
      for (let c = 0; c < masterCols.length; c++) {
        let combinedText = '';
        for (let r = 0; r < Math.min(5, parsedGrid.length); r++) {
          combinedText += parsedGrid[r].cells[c] + ' ';
        }
        combinedText = combinedText.toLowerCase();

        if (
          combinedText.includes('ゼッケン') ||
          combinedText.includes('car no') ||
          combinedText.includes('carno') ||
          combinedText.includes('no.')
        ) {
          roles[c] = 'carno';
        } else if (
          combinedText.includes('ドライバー') ||
          combinedText.includes('driver') ||
          combinedText.includes('ﾄﾞﾗｲﾊﾞｰ')
        ) {
          roles[c] = 'driver';
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
    const newEntries: Record<string, Entry> = {};
    const carNoIndex = columnRoles.indexOf('carno');

    if (carNoIndex === -1) {
      alert('「Car No」の列が1つも選択されていません。');
      return;
    }

    const driverIndices = columnRoles
      .map((role, idx) => (role === 'driver' ? idx : -1))
      .filter((idx) => idx !== -1);

    if (driverIndices.length === 0) {
      alert('「ドライバー」の列が1つも選択されていません。');
      return;
    }

    // 1. Car No (アンカー) をすべて抽出
    const anchors: { y: number; carNo: string; drivers: string[] }[] = [];
    for (const row of grid) {
      const carNoRaw = row.cells[carNoIndex]?.trim();
      if (carNoRaw && /\d/.test(carNoRaw)) {
        const cleanCarNo = normalizeCarNo(carNoRaw);
        if (cleanCarNo) {
          anchors.push({ y: row.y, carNo: cleanCarNo, drivers: [] });
        }
      }
    }

    if (anchors.length === 0) {
      alert('有効なCar Noが見つかりませんでした。');
      return;
    }

    // 2. 各行のドライバーを、Y座標が最も近いCar Noに割り当てる
    for (const row of grid) {
      const drivers = driverIndices
        .map((idx) => row.cells[idx]?.trim())
        .filter(Boolean);

      if (drivers.length > 0) {
        let closestAnchor = anchors[0];
        let minDiff = Math.abs(row.y - anchors[0].y);

        for (let i = 1; i < anchors.length; i++) {
          const diff = Math.abs(row.y - anchors[i].y);
          if (diff < minDiff) {
            minDiff = diff;
            closestAnchor = anchors[i];
          }
        }

        // 姓名で列が分かれている場合（例: ["岩佐", "歩夢"]）はスペースで結合して1人として扱う
        const combinedDriver = drivers.join(' ');
        if (!closestAnchor.drivers.includes(combinedDriver)) {
          closestAnchor.drivers.push(combinedDriver);
        }
      }
    }

    // 3. エントリーの生成
    for (const anchor of anchors) {
      if (anchor.drivers.length > 0) {
        newEntries[anchor.carNo] = {
          id: anchor.carNo,
          carNo: anchor.carNo,
          drivers: anchor.drivers,
        };
      }
    }

    setEntries(newEntries);
    alert(`${Object.keys(newEntries).length} 件のエントリーを保存しました。`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-full">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-800">⚙️ エントリー登録 (PDF解析)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1">
            ✕
          </button>
        </div>

        {/* ボディ */}
        <div className="p-4 flex-1 flex flex-col overflow-hidden gap-4">
          <div className="shrink-0 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-700">1. PDFファイルを選択してください</p>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={isParsing}
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            {isParsing && (
              <span className="text-sm text-blue-600 font-bold animate-pulse">解析中...</span>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
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
                                : role === 'driver'
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : 'bg-white text-gray-500 border-gray-300'
                            }`}
                          >
                            <option value="ignore">❌ 無視</option>
                            <option value="carno">🏎️ Car No</option>
                            <option value="driver">👤 ドライバー</option>
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
                                  : role === 'driver'
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
          </div>
          {grid.length > 0 && (
            <p className="text-xs text-gray-500 shrink-0">
              ※各列の上のプルダウンで「Car No」「ドライバー」を正しく割り当ててください。不要な列は「❌ 無視」のままでOKです。
            </p>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={grid.length === 0}
            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors shadow"
          >
            保存して適用
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasterDataModal;
