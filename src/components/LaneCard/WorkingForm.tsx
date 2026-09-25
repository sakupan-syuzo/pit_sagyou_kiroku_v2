import React from 'react';
import type { LaneDraft } from '../../types';

import { usePitStore } from '../../store/usePitStore';

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

const DEFAULT_DRIVER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** 取り消しの二段階確認が自動リセットされるまでの時間（ms） */
const CANCEL_CONFIRM_TIMEOUT_MS = 5000;

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
  onDraftChange,
  onCancel,
  onHandover,
  onPitOut,
}) => {
  const headerColor = LANE_HEADER_COLORS[laneIndex] || 'bg-gray-500';
  const labelText = LANE_LABELS[laneIndex] || `LANE ${laneIndex + 1}`;

  const entries = usePitStore((s) => s.entries);
  const entry = draft.carNo ? entries[draft.carNo] : undefined;
  const labels = entry?.drivers && entry.drivers.length > 0 ? entry.drivers : (DEFAULT_DRIVER_LABELS as readonly string[]);

  /**
   * 取り消しのインライン二段階確認ステート。
   * - false: 通常の [引き継ぎ] [取り消し] 表示
   * - true : 確認モードの [破棄OK？] [戻る] 表示（警告色）
   */
  const [cancelConfirming, setCancelConfirming] = React.useState(false);
  const cancelTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 確認モードに入り、5秒後に自動で通常モードへ戻る */
  const enterCancelConfirm = () => {
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    setCancelConfirming(true);
    cancelTimerRef.current = setTimeout(() => {
      setCancelConfirming(false);
      cancelTimerRef.current = null;
    }, CANCEL_CONFIRM_TIMEOUT_MS);
  };

  /** 確認モードをキャンセルして通常モードに戻る */
  const exitCancelConfirm = () => {
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = null;
    setCancelConfirming(false);
  };

  /** 破棄を実行する */
  const handleConfirmCancel = () => {
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = null;
    setCancelConfirming(false);
    onCancel();
  };

  // アンマウント時にタイマーをクリア
  React.useEffect(() => {
    return () => {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* ======= ヘッダー ======= */}
      <div className={`${headerColor} text-white px-3 py-2`}>
        <div className="flex items-end justify-between gap-2">
          {/* LANE ラベル */}
          <span className="text-xs font-black tracking-widest opacity-80 shrink-0 pb-0.5">
            {labelText}
          </span>
          {/* PIT No. */}
          <div className="flex flex-col items-center leading-none">
            <span className="text-xs font-black tracking-widest opacity-80">PIT</span>
            <span className="text-3xl font-black leading-none">{draft.pitNo || '—'}</span>
          </div>
          {/* Car No. */}
          <div className="flex flex-col items-center leading-none">
            <span className="text-xs font-black tracking-widest opacity-80">Car</span>
            <span className="text-3xl font-black leading-none">{draft.carNo || '—'}</span>
          </div>
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

        {/* ---- 給油: 巨大セグメントコントロール ---- */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-1">⛽ 給油</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onDraftChange({ refuel: false })}
              className={`flex-1 h-14 rounded-xl font-black text-xl border-2 transition-colors ${
                !draft.refuel
                  ? 'bg-gray-500 text-white border-gray-500 shadow-inner'
                  : 'bg-white text-gray-400 border-gray-200 active:bg-gray-100'
              }`}
            >
              なし
            </button>
            <button
              type="button"
              onClick={() => onDraftChange({ refuel: true })}
              className={`flex-1 h-14 rounded-xl font-black text-xl border-2 transition-colors ${
                draft.refuel
                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg'
                  : 'bg-white text-gray-400 border-gray-200 active:bg-gray-100'
              }`}
            >
              ⛽ あり
            </button>
          </div>
        </div>

        {/* ---- OUTドライバー変更: セグメントコントロール ---- */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-1">🧑‍✈️ OUTドライバー</p>
          <div className="flex gap-1 mb-1">
            <button
              type="button"
              onClick={() => onDraftChange({ isDriverChanged: false, pitOutDriver: '' })}
              className={`flex-1 h-14 rounded-xl border-2 transition-colors flex flex-col items-center justify-center leading-tight ${
                !draft.isDriverChanged
                  ? 'bg-gray-500 text-white border-gray-500 shadow-inner'
                  : 'bg-white text-gray-400 border-gray-200 active:bg-gray-100'
              }`}
            >
              <span className="text-xs font-bold opacity-80">継続</span>
              <span className="font-black text-xl">{draft.pitInDriver || '未設定'}</span>
            </button>
            <button
              type="button"
              onClick={() => onDraftChange({ isDriverChanged: true, pitOutDriver: '' })}
              className={`flex-1 h-14 rounded-xl font-black text-lg border-2 transition-colors flex items-center justify-center gap-1 ${
                draft.isDriverChanged
                  ? 'bg-purple-600 text-white border-purple-600 shadow-lg'
                  : 'bg-white text-gray-400 border-gray-200 active:bg-gray-100'
              }`}
            >
              <span className="text-xl">🔄</span> 交代
            </button>
          </div>

          {draft.isDriverChanged && (
            <div className="flex flex-wrap gap-1">
              {labels.map((label, i) => {
                const defaultLabel = DEFAULT_DRIVER_LABELS[i] || String.fromCharCode(65 + i);
                const isCustom = label !== defaultLabel;
                const displaySub = isCustom ? label.slice(0, 5) : null;
                const isExcluded = label === draft.pitInDriver;
                const isSelected = draft.pitOutDriver === label;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={isExcluded}
                    onClick={() => !isExcluded && onDraftChange({ pitOutDriver: label })}
                    className={`flex-1 flex flex-col items-center justify-center min-w-[3rem] h-12 rounded-xl border-2 transition-colors leading-none overflow-hidden ${
                      isExcluded
                        ? 'bg-gray-100 text-gray-300 border-gray-200 line-through cursor-not-allowed'
                        : isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-lg'
                        : 'bg-white text-gray-600 border-gray-200 active:bg-gray-100'
                    }`}
                    title={isExcluded ? `${label}: 乗車中` : label}
                  >
                    <span className="font-black text-sm">{defaultLabel}</span>
                    {displaySub && <span className="text-[10px] font-bold mt-0.5">{displaySub}</span>}
                  </button>
                );
              })}
              {/* カスタム入力 */}
              <input
                type="text"
                value={labels.includes(draft.pitOutDriver) ? '' : draft.pitOutDriver}
                onChange={(e) => onDraftChange({ pitOutDriver: e.target.value })}
                placeholder="その他"
                className="flex-1 min-w-[3.5rem] h-12 border-2 border-gray-200 rounded-xl px-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}
        </div>

        {/* ---- その他メモ ---- */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-1">📝 メモ</p>
          <input
            type="text"
            value={draft.other || ''}
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

        {/* ---- 引き継ぎ / 取り消し: インライン二段階確認 ---- */}
        <div className="flex gap-2 pt-1">
          {!cancelConfirming ? (
            <>
              {/* 通常表示: [引き継ぎ] [取り消し] */}
              <button
                type="button"
                onClick={onHandover}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm rounded-xl transition-colors shadow"
              >
                🔄 引き継ぎ
              </button>
              <button
                type="button"
                onClick={enterCancelConfirm}
                className="flex-1 py-3 bg-white text-red-500 border-2 border-red-300 hover:bg-red-50 active:bg-red-100 font-bold text-sm rounded-xl transition-colors"
              >
                ✕ 取り消し
              </button>
            </>
          ) : (
            <>
              {/* 確認表示: [破棄OK？] [戻る] — 警告色で目立たせる */}
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-sm rounded-xl transition-colors shadow-lg animate-pulse"
              >
                🗑 破棄OK？
              </button>
              <button
                type="button"
                onClick={exitCancelConfirm}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 font-bold text-sm rounded-xl transition-colors"
              >
                ← 戻る
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkingForm;
