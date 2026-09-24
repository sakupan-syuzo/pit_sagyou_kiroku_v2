import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Download } from 'lucide-react';
import { usePitStore } from '../store/usePitStore';
import HistoryList from '../components/HistoryList';
import EditModal from '../components/EditModal';
import PitDocument from '../pdf/PitDocument';
import { calcDuration } from '../pdf/pdfUtils';
import type { PitRecord } from '../types';

type OutputFormat = 'pdf' | 'csv';

/** レコード1件をCSV行に変換 */
const recordToCsvRow = (r: PitRecord, index: number): string => {
  const outDriver = r.isDriverChanged ? r.pitOutDriver : r.pitInDriver;
  const duration = calcDuration(r.pitInTime, r.pitOutTime);
  const cells = [
    index + 1,
    r.pitNo,
    r.carNo,
    r.pitInTime,
    r.pitOutTime,
    duration,
    r.pitInDriver,
    outDriver,
    r.isDriverChanged ? 'あり' : 'なし',
    r.refuel ? 'あり' : 'なし',
    r.tires,
    r.other,
  ];
  // ダブルクォートでラップ（カンマ・改行を含む可能性のあるフィールド対策）
  return cells.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
};

const downloadCsv = (records: PitRecord[], sessionName: string) => {
  const header = [
    '"#"', '"PIT No."', '"Car No."',
    '"PIT IN時刻"', '"PIT OUT時刻"', '"滞在時間"',
    '"IN Dr."', '"OUT Dr."', '"交代"',
    '"給油"', '"タイヤ"', '"その他"',
  ].join(',');

  const rows = [...records]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r, i) => recordToCsvRow(r, i));

  const csv = '\uFEFF' + [header, ...rows].join('\r\n'); // BOM付きUTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date()
    .toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '');
  const fileName = `pit_record_${sessionName || 'session'}_${dateStr}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

const PdfPage: React.FC = () => {
  const records = usePitStore((s) => s.records);
  const sessionName = usePitStore((s) => s.sessionName);
  const inspector = usePitStore((s) => s.inspector);
  const setSessionName = usePitStore((s) => s.setSessionName);
  const setInspector = usePitStore((s) => s.setInspector);

  const [editingRecord, setEditingRecord] = React.useState<PitRecord | null>(null);
  const [format, setFormat] = React.useState<OutputFormat>('pdf');

  const pdfFileName = `pit_record_${sessionName || 'session'}_${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')}.pdf`;

  return (
    <div className="px-3 pb-24 pt-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-gray-800 px-1">📤 OUTPUT</h1>

      {/* セッション情報 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700">出力情報</h2>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">セッション名</label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="例: 決勝レース"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">担当審判員</label>
          <input
            type="text"
            value={inspector}
            onChange={(e) => setInspector(e.target.value)}
            placeholder="氏名"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* PDF / CSV 切り替え */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-2">出力形式</label>
          <div className="flex gap-2">
            {(['pdf', 'csv'] as OutputFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                  format === f
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ダウンロードボタン */}
        {records.length === 0 ? (
          <div className="w-full bg-gray-200 text-gray-500 font-bold py-3 rounded-xl text-center text-sm">
            作業記録がないため出力できません
          </div>
        ) : format === 'pdf' ? (
          <PDFDownloadLink
            document={
              <PitDocument
                records={records}
                sessionName={sessionName}
                inspector={inspector}
              />
            }
            fileName={pdfFileName}
          >
            {({ loading, error }) => (
              <button
                className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-base transition-colors shadow-md ${
                  loading
                    ? 'bg-gray-400 text-white cursor-wait'
                    : error
                    ? 'bg-red-500 text-white'
                    : 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
                }`}
                disabled={loading}
              >
                <Download size={20} />
                {loading ? 'PDF生成中...' : error ? 'エラー' : 'PDFダウンロード'}
              </button>
            )}
          </PDFDownloadLink>
        ) : (
          <button
            onClick={() => downloadCsv(records, sessionName)}
            className="w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-base transition-colors shadow-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
          >
            <Download size={20} />
            CSVダウンロード
          </button>
        )}
      </div>

      {/* 履歴一覧 */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 mb-2 px-1">📋 作業履歴（タップで修正）</h2>
        <HistoryList onEditRecord={setEditingRecord} />
      </div>

      <EditModal record={editingRecord} onClose={() => setEditingRecord(null)} />
    </div>
  );
};

export default PdfPage;
