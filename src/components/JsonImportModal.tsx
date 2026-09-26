import React, { useState, useEffect } from 'react';
import { usePitStore } from '../store/usePitStore';

interface JsonImportModalProps {
  data: any;
  onClose: () => void;
  onConfirm: (mapping: Record<string, string>) => void;
}

const JsonImportModal: React.FC<JsonImportModalProps> = ({ data, onClose, onConfirm }) => {
  const localRaces = usePitStore((s) => s.races);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [incomingRaces, setIncomingRaces] = useState<any[]>([]);

  useEffect(() => {
    const racesToImport: any[] = [];

    if (data.races && Array.isArray(data.races)) {
      for (const r of data.races) {
        const entryCount = Object.keys(r.entries || {}).length;
        const recordCount = (data.pitRecords || []).filter(
          (rec: any) => (rec.raceId || 'race1') === r.id
        ).length;
        
        if (entryCount > 0 || recordCount > 0) {
          racesToImport.push({ ...r, entryCount, recordCount });
        }
      }
    } else if (data.entries && Object.keys(data.entries).length > 0) {
      // 古い形式のデータ（races配列がない）
      const recordCount = (data.pitRecords || []).length;
      racesToImport.push({
        id: 'legacy',
        name: '旧形式データ',
        entries: data.entries,
        entryCount: Object.keys(data.entries).length,
        recordCount,
      });
    }

    const initialMapping: Record<string, string> = {};
    racesToImport.forEach((inc) => {
      // 1. 名前が完全一致するローカルレースを探す
      const nameMatch = localRaces.find((lr) => lr.name === inc.name);
      if (nameMatch) {
        initialMapping[inc.id] = nameMatch.id;
      } else {
        // 2. IDが一致するローカルレースを探す
        const idMatch = localRaces.find((lr) => lr.id === inc.id);
        initialMapping[inc.id] = idMatch ? idMatch.id : 'skip';
      }
    });

    setIncomingRaces(racesToImport);
    setMapping(initialMapping);
  }, [data, localRaces]);

  const handleConfirm = () => {
    onConfirm(mapping);
  };

  if (incomingRaces.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 text-center space-y-4">
          <p className="font-bold text-gray-800">インポート可能なデータがありません。</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded-lg"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
        <div className="p-4 border-b border-gray-200 bg-indigo-50">
          <h3 className="font-bold text-indigo-900 text-lg">データの引き継ぎ設定</h3>
          <p className="text-xs text-indigo-700 mt-1">
            受け取ったデータを自分のどのレース枠に保存するか選択してください。
          </p>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {incomingRaces.map((inc) => (
            <div key={inc.id} className="bg-gray-50 border border-gray-200 p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800 text-sm">
                  受信: <span className="text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">{inc.name}</span>
                </span>
                <span className="text-xs text-gray-500 font-bold">
                  {inc.entryCount}台 / {inc.recordCount}件
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-bold shrink-0">保存先 ➔</span>
                <select
                  value={mapping[inc.id] || 'skip'}
                  onChange={(e) => setMapping({ ...mapping, [inc.id]: e.target.value })}
                  className="flex-1 text-sm font-bold border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white py-1.5 px-2"
                >
                  <option value="skip">❌ インポートしない</option>
                  {localRaces.map((lr) => (
                    <option key={lr.id} value={lr.id}>
                      {lr.name} (現在: {Object.keys(lr.entries || {}).length}台)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            インポート実行
          </button>
        </div>
      </div>
    </div>
  );
};

export default JsonImportModal;
