import React from 'react';
import { Trash2 } from 'lucide-react';
import LaneCard from '../components/LaneCard/LaneCard';
import HistoryList from '../components/HistoryList';
import EditModal from '../components/EditModal';
import { usePitStore } from '../store/usePitStore';
import type { PitRecord } from '../types';

const InputPage: React.FC = () => {
  const [editingRecord, setEditingRecord] = React.useState<PitRecord | null>(null);
  const clearAllData = usePitStore((s) => s.clearAllData);
  const laneCount = usePitStore((s) => s.laneCount);
  const laneStates = usePitStore((s) => s.laneStates);
  const setLaneCount = usePitStore((s) => s.setLaneCount);
  const hasNoCarNo = usePitStore((s) => s.records.some((r) => !r.carNo));

  const handleClearAll = () => {
    if (window.confirm('本当にすべての入力情報と履歴をクリアしますか？\n（次のイベントを始める前に使用します）')) {
      clearAllData();
    }
  };

  const handleLaneCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = Number(e.target.value);
    if (next >= laneCount) {
      // 増やす場合は確認不要
      setLaneCount(next);
      return;
    }
    // 減らす場合: 削除されるレーンに作業中データがあるか確認
    const hasWorkingData = laneStates
      .slice(next)
      .some((ls) => ls.status === 'working');

    if (hasWorkingData) {
      if (!window.confirm(
        `レーン数を ${laneCount} → ${next} に減らすと、\n` +
        `レーン ${next + 1}〜${laneCount} の入力途中データが消えます。\n\n` +
        `よろしいですか？`
      )) {
        return; // キャンセル: プルダウンは変化しない（React の controlled）
      }
    }
    setLaneCount(next);
  };

  return (
    <div className="px-3 pb-24 pt-4 space-y-4 max-w-lg mx-auto">
      {/* ページタイトル / レーン数 / 全クリア */}
      <div className="flex items-center gap-2 px-1">
        <h1 className="text-lg font-bold text-gray-800 shrink-0">📝 ピット作業入力</h1>

        {/* レーン数プルダウン */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          <label className="text-xs text-gray-500 font-bold shrink-0">レーン数</label>
          <select
            value={laneCount}
            onChange={handleLaneCountChange}
            className="border border-gray-300 rounded-lg text-sm px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleClearAll}
          className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-100 transition-colors shrink-0"
          title="すべてのデータを初期化"
        >
          <Trash2 size={14} />
          全クリア
        </button>
      </div>

      {/* レーンカード（laneCount 分ループ） */}
      {Array.from({ length: laneCount }, (_, i) => (
        <LaneCard key={i} laneIndex={i} />
      ))}

      {/* 履歴 */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <h2 className="text-sm font-bold text-gray-600">📋 作業履歴（タップで編集）</h2>
          {hasNoCarNo && (
            <span className="text-xs text-red-500">赤枠：Car No.未入力</span>
          )}
        </div>
        <HistoryList onEditRecord={setEditingRecord} />
      </div>

      {/* 修正モーダル */}
      <EditModal record={editingRecord} onClose={() => setEditingRecord(null)} />
    </div>
  );
};

export default InputPage;
