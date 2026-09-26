import React from 'react';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { Download, Share, Upload } from 'lucide-react';
import { usePitStore } from '../store/usePitStore';
import HistoryList from '../components/HistoryList';
import EditModal from '../components/EditModal';
import PitDocument from '../pdf/PitDocument';
import { calcDuration, getDriverLabel } from '../pdf/pdfUtils';
import type { PitRecord, Entry } from '../types';
import JsonImportModal from '../components/JsonImportModal';

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

const handleCsvExport = async (records: PitRecord[], sessionName: string, entries: Record<string, Entry>, action: 'download' | 'share') => {
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

  if (action === 'share') {
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
    alert('お使いのブラウザはファイル共有に対応していません。保存を使用してください。');
  } else {
    // フォールバック: ダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

const PdfPage: React.FC = () => {
  const records = usePitStore((s) => s.records);
  const sessionName = usePitStore((s) => s.sessionName);
  const inspector = usePitStore((s) => s.inspector);
  const entries = usePitStore((s) => s.entries);
  const races = usePitStore((s) => s.races);
  
  const setSessionName = usePitStore((s) => s.setSessionName);
  const setInspector = usePitStore((s) => s.setInspector);
  const setRecords = usePitStore((s) => s.setRecords);
  const updateRaceName = usePitStore((s) => s.updateRaceName);
  const setRaceEntries = usePitStore((s) => s.setRaceEntries);

  const [editingRecord, setEditingRecord] = React.useState<PitRecord | null>(null);
  const [format, setFormat] = React.useState<OutputFormat>('pdf');
  const [pendingImportData, setPendingImportData] = React.useState<any | null>(null);
  const [isSharingPdf, setIsSharingPdf] = React.useState(false);

  const pdfFileName = `pit_record_${sessionName || 'session'}_${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')}.pdf`;

  const handlePdfShare = async () => {
    setIsSharingPdf(true);
    try {
      const doc = <PitDocument records={records} sessionName={sessionName} inspector={inspector} entries={entries} />;
      const blob = await pdf(doc).toBlob();
      const file = new File([blob], pdfFileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'PitRec PDFデータ',
            files: [file],
          });
        } catch (err) {
          if ((err as Error).name !== 'AbortError') console.error('Share failed', err);
        }
      } else {
        alert('お使いのブラウザはファイル共有に対応していません。保存を使用してください。');
      }
    } catch (error) {
      console.error('PDF generation failed', error);
      alert('PDFの生成に失敗しました。');
    } finally {
      setIsSharingPdf(false);
    }
  };

  const shareJson = async () => {
    if (records.length === 0) {
      alert('作業記録がありません。');
      return;
    }
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      pitRecords: records,
      entries: entries, // 下位互換性用
      races: races,     // 複数レース対応
      sessionName,
      inspector,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const fileName = `pitrec_${sessionName || 'data'}_${Date.now()}.json`;
    const file = new File([blob], fileName, { type: 'application/json' });

    // 1. Web Share API（ファイル共有対応）
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: 'PitRec 引き継ぎデータ', files: [file] });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // キャンセル
        console.warn('File share failed, trying text share:', err);
      }
    }

    // 2. テキスト共有（ファイル共有不可の場合）
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PitRec 引き継ぎデータ',
          text: jsonStr,
        });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('Text share failed:', err);
      }
    }

    // 3. ダウンロード（PC等）
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    } catch (err) {
      console.warn('Download failed:', err);
    }

    // 4. 最終フォールバック：クリップボードにコピー
    try {
      await navigator.clipboard.writeText(jsonStr);
      alert('データをクリップボードにコピーしました。\nLINEやメモアプリに貼り付けて送ってください。');
    } catch {
      alert('共有に失敗しました。端末または設定を確認してください。');
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
          // モーダルを表示してマッピングを選択させる
          setPendingImportData(data);
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

  const handleConfirmImport = (mapping: Record<string, string>) => {
    if (!pendingImportData) return;
    const data = pendingImportData;
    
    const newRecords = [...records];
    let addedRecords = 0;

    // 1. レコードのマージ
    const importedRecords = data.pitRecords || [];
    for (const r of importedRecords) {
      const incRaceId = r.raceId || (data.races ? 'race1' : 'legacy');
      const targetRaceId = mapping[incRaceId];

      if (!targetRaceId || targetRaceId === 'skip') continue;

      if (!newRecords.some(existing => existing.id === r.id)) {
        newRecords.push({ ...r, raceId: targetRaceId });
        addedRecords++;
      }
    }

    // 2. エントリーとレース名のマージ
    if (data.races && Array.isArray(data.races)) {
      data.races.forEach((incRace: any) => {
        const targetRaceId = mapping[incRace.id];
        if (targetRaceId && targetRaceId !== 'skip') {
          // エントリーをマージ
          if (incRace.entries) {
            const currentRace = races.find(r => r.id === targetRaceId);
            const currentEntries = currentRace ? currentRace.entries : {};
            setRaceEntries(targetRaceId, { ...currentEntries, ...incRace.entries });
          }
          // レース名を更新（相手側の名前に合わせる）
          if (incRace.name) {
            updateRaceName(targetRaceId, incRace.name);
          }
        }
      });
    } else if (data.entries) {
      const targetRaceId = mapping['legacy'];
      if (targetRaceId && targetRaceId !== 'skip') {
        const currentRace = races.find(r => r.id === targetRaceId);
        const currentEntries = currentRace ? currentRace.entries : {};
        setRaceEntries(targetRaceId, { ...currentEntries, ...data.entries });
      }
    }

    if (addedRecords > 0) {
      setRecords(newRecords);
    }
    
    alert(`データの引き継ぎが完了しました。\n（レコード追加: ${addedRecords}件）`);
    setPendingImportData(null);
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
          <div className="w-full flex gap-2">
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
              className="flex-1"
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
                  {loading ? '生成中...' : error ? 'エラー' : 'PDF保存'}
                </button>
              )}
            </PDFDownloadLink>
            <button
              onClick={handlePdfShare}
              disabled={isSharingPdf}
              className={`flex-1 flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-base transition-colors shadow-md ${
                isSharingPdf
                  ? 'bg-gray-200 text-gray-500 cursor-wait border border-gray-300'
                  : 'bg-white text-red-600 border border-red-200 hover:bg-red-50 active:bg-red-100'
              }`}
            >
              <Share size={20} />
              {isSharingPdf ? '生成中...' : 'PDF共有'}
            </button>
          </div>
        ) : (
          <div className="w-full flex gap-2">
            <button
              onClick={() => handleCsvExport(records, sessionName, entries, 'download')}
              className="flex-1 flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-base transition-colors shadow-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
            >
              <Download size={20} />
              CSV保存
            </button>
            <button
              onClick={() => handleCsvExport(records, sessionName, entries, 'share')}
              className="flex-1 flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-base transition-colors shadow-md bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 active:bg-emerald-100"
            >
              <Share size={20} />
              CSV共有
            </button>
          </div>
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

      {pendingImportData && (
        <JsonImportModal
          data={pendingImportData}
          onClose={() => setPendingImportData(null)}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  );
};

export default PdfPage;
