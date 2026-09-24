import React from 'react';
import type { LaneDraft } from '../../types';

// レーンヘッダー色（InputPage と合わせる）
const LANE_LABELS = [
  'LANE 1', 'LANE 2', 'LANE 3', 'LANE 4', 'LANE 5',
  'LANE 6', 'LANE 7', 'LANE 8', 'LANE 9', 'LANE 10',
];
const LANE_HEADER_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-orange-500',
  'bg-rose-600', 'bg-cyan-600', 'bg-yellow-500', 'bg-teal-600',
  'bg-pink-600', 'bg-indigo-600',
];

const DRIVER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

interface WorkingFormProps {
  laneIndex: number;
  draft: LaneDraft;
  continuousMode: boolean;
  onDraftChange: (patch: Partial<LaneDraft>) => void;
  onCancel: () => void;
  onHandover: () => void;
  onPitOut: () => void;
}

const WorkingForm: React.FC<WorkingFormProps> = ({
  laneIndex,
  draft,
  continuousMode,
  onDraftChange,
  onCancel,
  onHandover,
  onPitOut,
}) => {
  return (
    <div className="flex flex-col">
      {/* ======= ヘッダー: レーン番号 + Car No. ======= */}
      <div className={`${LANE_HEADER_COLORS[laneIndex]} text-white px-3 py-2`}>
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-xs font-black tracking-widest opacity-80">
            {LANE_LABELS[laneIndex]}
          </span>
          <span className="text-3xl font-black leading-none tracking-tight">
            {draft.carNo || '—'}
          </span>
        </div>
        {/* PIT IN時刻 */}
        <div className="text-xs font-mono opacity-75 mt-0.5">
          IN {draft.pitInTime}
          {continuousMode && (
            <span className="ml-2 bg-white/20 rounded px-1">🔄 連続</span>
          )}
        </div>
      </div>

      {/* ======= ボディ ======= */}
      <div className="p-2 space-y-2">

        {/* ---- タイヤ交換: 巨大セグメントコントロール ---- */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-1">🛞 タイヤ交換本数</p>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onDraftChange({ tires: n })}
                className={`flex-1 h-16 flex flex-col items-center justify-center rounded-xl font-black text-lg border-2 transition-colors ${
                  draft.tires === n
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                    : 'bg-white text-gray-600 border-gray-200 active:bg-gray-100'
                }`}
              >
                <span>{n}</span>
                <span className="text-xs font-bold opacity-60">本</span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- 給油: 巨大トグル ---- */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-1">⛽ 給油</p>
          <button
            type="button"
            onClick={() => onDraftChange({ refuel: !draft.refuel })}
            className={`w-full h-14 rounded-xl font-black text-xl border-2 transition-colors ${
              draft.refuel
                ? 'bg-orange-500 text-white border-orange-500 shadow-lg'
                : 'bg-white text-gray-400 border-gray-200 active:bg-gray-100'
            }`}
          >
            {draft.refuel ? '⛽ 給油 あり' : '給油 なし'}
          </button>
        </div>

        {/* ---- OUTドライバー変更 ---- */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-black text-gray-500">🧑‍✈️ OUTドライバー</p>
            {/* 交代スイッチ */}
            <button
              type="button"
              onClick={() => onDraftChange({ isDriverChanged: !draft.isDriverChanged, pitOutDriver: '' })}
              className={`px-2 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                draft.isDriverChanged
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-400 border-gray-300'
              }`}
            >
              {draft.isDriverChanged ? '交代あり' : '交代なし'}
            </button>
          </div>
          {draft.isDriverChanged && (
            <div className="flex flex-wrap gap-1">
              {DRIVER_LABELS.map((label) => {
                const isExcluded = label === draft.pitInDriver;
                const isSelected = draft.pitOutDriver === label;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={isExcluded}
                    onClick={() => !isExcluded && onDraftChange({ pitOutDriver: label })}
                    className={`flex-1 min-w-[2.5rem] h-12 rounded-xl font-black text-lg border-2 transition-colors ${
                      isExcluded
                        ? 'bg-gray-100 text-gray-300 border-gray-200 line-through cursor-not-allowed'
                        : isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-lg'
                        : 'bg-white text-gray-600 border-gray-200 active:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {/* カスタム入力 */}
              <input
                type="text"
                value={DRIVER_LABELS.includes(draft.pitOutDriver as typeof DRIVER_LABELS[number]) ? '' : draft.pitOutDriver}
                onChange={(e) => onDraftChange({ pitOutDriver: e.target.value })}
                placeholder="その他"
                className="flex-1 min-w-[3.5rem] h-12 border-2 border-gray-200 rounded-xl px-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}
          {!draft.isDriverChanged && (
            <div className="text-sm font-bold text-gray-500 px-1">
              → {draft.pitInDriver || '（未設定）'}
            </div>
          )}
        </div>

        {/* ---- その他メモ ---- */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-1">📝 メモ</p>
          <input
            type="text"
            value={draft.other}
            onChange={(e) => onDraftChange({ other: e.target.value })}
            placeholder="例: エアプレッシャー調整"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* ---- PIT OUTボタン ---- */}
        <button
          type="button"
          onClick={onPitOut}
          className="w-full h-20 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-2xl rounded-2xl shadow-xl transition-colors"
        >
          🏁 PIT OUT
        </button>

        {/* ---- 引き継ぎ / 取り消し（間隔を空けて誤操作防止） ---- */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onHandover}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm rounded-xl transition-colors shadow"
          >
            🔄 引き継ぎ
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-white text-red-500 border-2 border-red-300 hover:bg-red-50 active:bg-red-100 font-bold text-sm rounded-xl transition-colors"
          >
            ✕ 取り消し
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkingForm;
