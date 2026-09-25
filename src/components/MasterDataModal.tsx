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

interface MasterDataModalProps {
  onClose: () => void;
}

/**
 * 同じ行内のアイテム群を X 座標のギャップで列に分割する。
 *
 * - ギャップ閾値 (gapThreshold) 未満の隣接アイテムは同じ列として結合
 * - ギャップ閾値以上離れていれば別列（タブ区切り相当）とみなす
 *
 * 返り値: { text: string; x: number }[] — 列ごとに結合済みのアイテム列
 */
function clusterRowByXGap(
  items: { text: string; x: number; width: number }[],
  gapThreshold: number
): { text: string; x: number }[] {
  if (items.length === 0) return [];

  // X 昇順ソート済み前提
  const clusters: { text: string; x: number }[] = [];
  let curText = items[0].text;
  let curX = items[0].x;
  let curRight = items[0].x + items[0].width;

  for (let i = 1; i < items.length; i++) {
    const gap = items[i].x - curRight;
    if (gap < gapThreshold) {
      // 近接 → 同じ列として結合（スペースで繋ぐ）
      curText += ' ' + items[i].text;
      curRight = items[i].x + items[i].width;
    } else {
      // 離れている → 列確定
      clusters.push({ text: curText.trim(), x: curX });
      curText = items[i].text;
      curX = items[i].x;
      curRight = items[i].x + items[i].width;
    }
  }
  clusters.push({ text: curText.trim(), x: curX });
  return clusters;
}

const MasterDataModal: React.FC<MasterDataModalProps> = ({ onClose }) => {
  const [grid, setGrid] = useState<string[][]>([]);
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

      // width 付きで取得
      let allItems: { text: string; x: number; y: number; width: number }[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        textContent.items.forEach((item: any) => {
          const text = item.str.trim();
          if (!text) return;
          allItems.push({
            text,
            x: item.transform[4],
            // ページごとにY座標をオフセットして混ざらないようにする（PDFは下がY=0）
            y: item.transform[5] - pageNum * 10000,
            width: item.width ?? 0,
          });
        });
      }

      if (allItems.length === 0) {
        alert('テキストが見つかりませんでした。画像化されたPDFの可能性があります。');
        return;
      }

      // 1. Y座標でグループ化して行を生成
      allItems.sort((a, b) => b.y - a.y);
      const rowsRaw: { text: string; x: number; y: number; width: number }[][] = [];
      let currentRow: { text: string; x: number; y: number; width: number }[] = [];
      let lastY = allItems[0].y;

      for (const item of allItems) {
        if (Math.abs(item.y - lastY) > 5) { // 5px以上のズレで改行判定
          if (currentRow.length > 0) {
            currentRow.sort((a, b) => a.x - b.x);
            rowsRaw.push(currentRow);
          }
          currentRow = [item];
        } else {
          currentRow.push(item);
        }
        lastY = item.y;
      }
      if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.x - b.x);
        rowsRaw.push(currentRow);
      }

      // 2. 各行を X ギャップでクラスタリングして列に分割
      //    gapThreshold: フォントサイズの約 0.8 文字分を目安に 12pt 相当で設定
      const GAP_THRESHOLD = 12;
      const clusteredRows: { text: string; x: number }[][] = rowsRaw.map((row) =>
        clusterRowByXGap(row, GAP_THRESHOLD)
      );

      // 3. 全列の X 座標をクラスタリングして「マスター列位置」を特定
      const allColX = clusteredRows.flatMap((row) => row.map((c) => c.x)).sort((a, b) => a - b);
      const masterCols: number[] = [];
      if (allColX.length > 0) {
        let sum = allColX[0];
        let cnt = 1;
        let prev = allColX[0];
        for (let i = 1; i < allColX.length; i++) {
          if (allColX[i] - prev > 15) {
            masterCols.push(sum / cnt);
            sum = allColX[i];
            cnt = 1;
          } else {
            sum += allColX[i];
            cnt++;
          }
          prev = allColX[i];
        }
        masterCols.push(sum / cnt);
      }

      // 4. 各行のクラスターをマスター列に当てはめる
      const parsedGrid: string[][] = [];
      for (const row of clusteredRows) {
        const rowData: string[] = Array(masterCols.length).fill('');
        for (const cluster of row) {
          let bestCol = 0;
          let minDiff = Infinity;
          for (let i = 0; i < masterCols.length; i++) {
            const diff = Math.abs(cluster.x - masterCols[i]);
            if (diff < minDiff) {
              minDiff = diff;
              bestCol = i;
            }
          }
          rowData[bestCol] = rowData[bestCol]
            ? rowData[bestCol] + ' ' + cluster.text
            : cluster.text;
        }
        parsedGrid.push(rowData);
      }

      setGrid(parsedGrid);

      // 5. 上位行のヘッダー文字から役割を自動推測
      const roles: ColumnRole[] = Array(masterCols.length).fill('ignore');
      for (let c = 0; c < masterCols.length; c++) {
        let combinedText = '';
        for (let r = 0; r < Math.min(5, parsedGrid.length); r++) {
          combinedText += parsedGrid[r][c] + ' ';
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

    for (const row of grid) {
      const carNoRaw = row[carNoIndex]?.trim();
      // 数字を含む文字列かチェック
      if (!carNoRaw || !/\d/.test(carNoRaw)) continue;

      const drivers = driverIndices
        .map((idx) => row[idx]?.trim())
        .filter(Boolean);

      if (drivers.length > 0) {
        // normalizeCarNo で #/No./ゼッケン除去＋先頭ゼロ除去＋全角正規化
        const cleanCarNo = normalizeCarNo(carNoRaw);
        if (!cleanCarNo) continue;

        newEntries[cleanCarNo] = {
          id: cleanCarNo,
          carNo: cleanCarNo,
          drivers,
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
                        {row.map((cell, colIndex) => {
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
