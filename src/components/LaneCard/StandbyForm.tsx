import React from 'react';
import type { LaneDraft } from '../../types';
import { usePitStore } from '../../store/usePitStore';

interface StandbyFormProps {
  draft: LaneDraft;
  onDraftChange: (patch: Partial<LaneDraft>) => void;
  onPitIn: () => void;
}

const StandbyForm: React.FC<StandbyFormProps> = ({ draft, onDraftChange, onPitIn }) => {
  const pitInButtonPosition = usePitStore((s) => s.pitInButtonPosition);

  return (
    <div
      className={`flex items-center gap-2 ${
        pitInButtonPosition === 'left' ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* PIT IN ボタン */}
      <button
        onClick={onPitIn}
        className="shrink-0 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black py-2 px-3 rounded-xl text-base transition-colors shadow-md"
      >
        🏎️ IN
      </button>

      {/* 入力フィールド群（flex-1 で残りスペースを埋める） */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        {/* PIT No. */}
        <input
          type="text"
          inputMode="numeric"
          value={draft.pitNo}
          onChange={(e) => onDraftChange({ pitNo: e.target.value })}
          placeholder="PIT#"
          className="w-14 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* Car No. */}
        <input
          type="text"
          inputMode="numeric"
          value={draft.carNo}
          onChange={(e) => onDraftChange({ carNo: e.target.value })}
          placeholder="Car#"
          className="w-14 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* Driver — テキスト入力のみ（グローブ対応でシンプル化） */}
        <input
          type="text"
          value={draft.pitInDriver}
          onChange={(e) => onDraftChange({ pitInDriver: e.target.value })}
          placeholder="Drv"
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default StandbyForm;
