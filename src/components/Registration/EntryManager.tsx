import React, { useState } from 'react';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import type { Entry, Race } from '../../types';
import { normalizeCarNo } from '../../utils/carNoUtils';

interface EntryManagerProps {
  race: Race;
  onUpdateEntries: (newEntries: Record<string, Entry>) => void;
}

const EntryManager: React.FC<EntryManagerProps> = ({ race, onUpdateEntries }) => {
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [originalCarNo, setOriginalCarNo] = useState<string | null>(null);

  const entriesArray = Object.values(race.entries).sort((a, b) => {
    // 数値としてソート（できなければ文字列比較）
    const numA = parseInt(a.carNo, 10);
    const numB = parseInt(b.carNo, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.carNo.localeCompare(b.carNo);
  });

  const handleEdit = (entry: Entry) => {
    setEditingEntry({ ...entry, drivers: [...entry.drivers] });
    setOriginalCarNo(entry.carNo);
  };

  const handleAddNew = () => {
    setEditingEntry({ id: '', carNo: '', pitNo: '', drivers: [''] });
    setOriginalCarNo(null);
  };

  const handleDelete = (carNo: string) => {
    if (window.confirm(`Car No: ${carNo} の登録を削除しますか？`)) {
      const newEntries = { ...race.entries };
      delete newEntries[carNo];
      onUpdateEntries(newEntries);
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    const cleanCarNo = normalizeCarNo(editingEntry.carNo);
    if (!cleanCarNo) {
      alert('有効なCar Noを入力してください。');
      return;
    }

    // Car Noの重複チェック
    if (originalCarNo !== cleanCarNo && race.entries[cleanCarNo]) {
      if (!window.confirm('このCar Noは既に登録されています。上書きしますか？')) {
        return;
      }
    }

    const newEntries = { ...race.entries };
    
    // 元のCarNoから変更された場合、古いものを削除
    if (originalCarNo && originalCarNo !== cleanCarNo) {
      delete newEntries[originalCarNo];
    }

    // 新しい（または更新された）エントリーを保存
    newEntries[cleanCarNo] = {
      ...editingEntry,
      id: cleanCarNo,
      carNo: cleanCarNo,
      drivers: editingEntry.drivers.map(d => d.trim()).filter(d => d !== ''),
    };

    onUpdateEntries(newEntries);
    setEditingEntry(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-bold text-gray-700">登録済みデータ ({entriesArray.length}台)</h2>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> 追加
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {entriesArray.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-10">
            登録されたデータはありません
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {entriesArray.map((entry) => (
              <div key={entry.carNo} className="border border-gray-200 rounded-lg p-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded">
                      Car {entry.carNo}
                    </span>
                    {entry.pitNo && (
                      <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                        PIT {entry.pitNo}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {entry.drivers.length > 0 ? entry.drivers.join(' / ') : <span className="text-gray-400">ドライバー未登録</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.carNo)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-full">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 shrink-0">
              <h3 className="font-bold text-gray-800">
                {originalCarNo ? 'データ編集' : '新規追加'}
              </h3>
              <button onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveModal} className="p-4 space-y-4 overflow-y-auto">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Car No <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editingEntry.carNo}
                    onChange={(e) => setEditingEntry({ ...editingEntry, carNo: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    placeholder="例: 25"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 mb-1">PIT No</label>
                  <input
                    type="text"
                    value={editingEntry.pitNo || ''}
                    onChange={(e) => setEditingEntry({ ...editingEntry, pitNo: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    placeholder="例: 1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">ドライバー</label>
                <div className="space-y-2">
                  {editingEntry.drivers.map((drv, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-xs font-bold text-gray-400 w-4 text-center">{String.fromCharCode(65 + i)}</span>
                      <input
                        type="text"
                        value={drv}
                        onChange={(e) => {
                          const newDrvs = [...editingEntry.drivers];
                          newDrvs[i] = e.target.value;
                          setEditingEntry({ ...editingEntry, drivers: newDrvs });
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="氏名を入力"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newDrvs = editingEntry.drivers.filter((_, idx) => idx !== i);
                          setEditingEntry({ ...editingEntry, drivers: newDrvs });
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        tabIndex={-1}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {editingEntry.drivers.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setEditingEntry({ ...editingEntry, drivers: [...editingEntry.drivers, ''] })}
                      className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 w-full py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus size={14} /> ドライバーを追加
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-colors"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntryManager;
