import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Download, Share, Upload } from 'lucide-react';
import { usePitStore } from '../store/usePitStore';
import HistoryList from '../components/HistoryList';
import EditModal from '../components/EditModal';
import PitDocument from '../pdf/PitDocument';
import { calcDuration, getDriverLabel } from '../pdf/pdfUtils';
import type { PitRecord, Entry } from '../types';

type OutputFormat = 'pdf' | 'csv';

/** レコード1件をCSV行に変換 */
const recordToCsvRow = (r: PitRecord, index: number, entries: Record<string, Entry>): string => {
  const outDriver = r.isDriverChanged ? r.pitOutDriver : r.pitInDriver;
  const entry = entries[r.carNo];
  const duration = calcDuration(r.pitInAt, r.pitOutAt);
  const cells = [
    index + 1,
    r.pitNo,
    r.carNo,
    r.pitInTime,
    r.pitOutTime,
    duration,
    getDriverLabel(r.pitInDriver, entry),
    getDriverLabel(outDriver, entry),
    r.isDriverChanged ? 'あり' : 'なし',
    r.refuel ? 'あり' : 'なし',
    r.tires,
    r.other,
  ];
  // ダブルクォートでラップ（カンマ・改行を含む可能性のあるフィールド対策）
  return cells.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
};

const downloadCsv = async (records: PitRecord[], sessionName: string, entries: Record<string, Entry>) => {
  const header = [
    '"#"', '"PIT No."', '"Car No."',
    '"PIT IN時刻"', '"PIT OUT時刻"', '"滞在時間"',
    '"IN Dr."', '"OUT Dr."', '"交代"',
    '"給油"', '"タイヤ"', '"その他"',
  ].join(',');

  const rows = [...records]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r, i) => recordToCsvRow(r, i, entries));

  const csv = '\uFEFF' + [header, ...rows].join('\r\n'); // BOM付きUTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  
  const dateStr = new Date()
    .toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '');
  const fileName = `pit_record_${sessionName || 'session'}_${dateStr}.csv`;

  // 共有APIが使える場合は共有を優先
  if (navigator.canShare) {
    const file = new File([blob], fileName, { type: 'text/csv' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'PitRec CSVデータ',
          files: [file],
        });
        return;
      } catch (err) {
        // キャンセル時は何もしない
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed', err);
        } else {
          return;
        }
      }
    }
  }

  // フォールバック: ダウンロード
  const url = URL.createObjectURL(blob);
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
  const entries = usePitStore((s) => s.entries);
  const setSessionName = usePitStore((s) => s.setSessionName);
  const setInspector = usePitStore((s) => s.setInspector);
  const setRecords = usePitStore((s) => s.setRecords);
  const setEntries = usePitStore((s) => s.setEntries);

  const [editingRecord, setEditingRecord] = React.useState<PitRecord | null>(null);
  const [format, setFormat] = React.useState<OutputFormat>('pdf');

  const pdfFileName = `pit_record_${sessionName || 'session'}_${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')}.pdf`;

  const shareJson = async () => {
    if (records.length === 0) {
      alert('作業記録がありません。');
      return;
    }
    const data = {
      pitRecords: records,
      entries: entries,
      sessionName,
      inspector,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const file = new File([blob], `pitrec_data_${Date.now()}.json`, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'PitRec 引き継ぎデータ',
          files: [file],
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Share failed', err);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.pitRecords && Array.isArray(data.pitRecords)) {
          const newRecords = [...records];
          let added = 0;
          for (const r of data.pitRecords) {
            if (!newRecords.some(existing => existing.id === r.id)) {
              newRecords.push(r);
              added++;
            }
          }
          if (added > 0) {
            setRecords(newRecords);
          }
          if (data.entries) {
            setEntries({ ...entries, ...data.entries });
          }
          alert(`${added}件のレコードを引き継ぎ（結合）しました。`);
        } else {
          alert('無効なJSONデータです');
        }
      } catch (err) {
        alert('JSONの読み込みに失敗しました');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="px-3 pb-24 pt-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-gray-800 px-1">📤 出力 / 引き継ぎ</h1>

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

        {/* ダウンロード / 共有ボタン */}
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
                entries={entries}
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
            onClick={() => downloadCsv(records, sessionName, entries)}
            className="w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-base transition-colors shadow-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
          >
            <Share size={20} />
            CSVで出力 / 共有する
          </button>
        )}
      </div>

      {/* JSON引き継ぎセクション */}
      <div className="bg-indigo-50 rounded-2xl shadow-sm border border-indigo-100 p-4 space-y-3">
        <h2 className="text-sm font-bold text-indigo-800 flex items-center gap-1.5">
          <Share size={16} /> 担当引き継ぎ・バックアップ
        </h2>
        <p className="text-xs text-indigo-600/80">
          JSON形式で全データを別の端末に送ったり、受け取って合体させることができます。
        </p>
        <div className="flex gap-2">
          <button
            onClick={shareJson}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <Share size={18} />
            データを送る
          </button>
          
          <label className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
            <Upload size={18} />
            データを受け取る
            <input
              type="file"
              accept=".json"
              onChange={handleJsonImport}
              className="hidden"
            />
          </label>
        </div>
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
