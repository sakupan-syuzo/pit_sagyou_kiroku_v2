import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Trash2 } from 'lucide-react';
import StandbyForm from '../components/LaneCard/StandbyForm';
import WorkingForm from '../components/LaneCard/WorkingForm';

import { usePitStore, initialLaneState } from '../store/usePitStore';
import { useWakeLock } from '../hooks/useWakeLock';
import type { LaneDraft, PitRecord } from '../types';
import MasterDataModal from '../components/MasterDataModal';

const LANE_LABELS = [
  'LANE 1', 'LANE 2', 'LANE 3', 'LANE 4', 'LANE 5',
  'LANE 6', 'LANE 7', 'LANE 8', 'LANE 9', 'LANE 10',
];
const LANE_HEADER_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-orange-500',
  'bg-rose-600', 'bg-cyan-600', 'bg-yellow-500', 'bg-teal-600',
  'bg-pink-600', 'bg-indigo-600',
];
const LANE_BORDER_COLORS = [
  'border-blue-300', 'border-purple-300', 'border-emerald-300', 'border-orange-300',
  'border-rose-300', 'border-cyan-300', 'border-yellow-300', 'border-teal-300',
  'border-pink-300', 'border-indigo-300',
];
const LANE_BG_COLORS = [
  'bg-blue-50', 'bg-purple-50', 'bg-emerald-50', 'bg-orange-50',
  'bg-rose-50', 'bg-cyan-50', 'bg-yellow-50', 'bg-teal-50',
  'bg-pink-50', 'bg-indigo-50',
];

const getNowTime = (): string => {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
};

/** PIT OUT直後の誤爆防止ロック時間（ms） */
const PIT_OUT_LOCK_MS = 700;

const InputPage: React.FC = () => {
  const [showMasterModal, setShowMasterModal] = React.useState(false);

  /**
   * PIT OUT直後に true になる操作ロックフラグ。
   * true の間、作業エリア全体に透明オーバーレイを被せてタップを無効化する。
   */
  const [pitOutLocked, setPitOutLocked] = React.useState(false);
  const pitOutLockTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wake Lock はカスタムフックで管理（visibilitychange 再取得含む）
  const { enabled: isWakeLockActive, toggle: toggleWakeLock } = useWakeLock();

  const clearAllData = usePitStore((s) => s.clearAllData);
  const laneCount = usePitStore((s) => s.laneCount);
  const laneStates = usePitStore((s) => s.laneStates);
  const setLaneCount = usePitStore((s) => s.setLaneCount);
  const setLaneState = usePitStore((s) => s.setLaneState);
  const updateDraft = usePitStore((s) => s.updateDraft);
  const resetLane = usePitStore((s) => s.resetLane);
  const addRecord = usePitStore((s) => s.addRecord);
  const pitInButtonPosition = usePitStore((s) => s.pitInButtonPosition);
  const setPitInButtonPosition = usePitStore((s) => s.setPitInButtonPosition);

  /** PIT OUT後に700msのタップロックを開始する */
  const startPitOutLock = React.useCallback(() => {
    if (pitOutLockTimerRef.current) clearTimeout(pitOutLockTimerRef.current);
    setPitOutLocked(true);
    pitOutLockTimerRef.current = setTimeout(() => {
      setPitOutLocked(false);
      pitOutLockTimerRef.current = null;
    }, PIT_OUT_LOCK_MS);
  }, []);

  // アンマウント時にタイマーをクリア
  React.useEffect(() => {
    return () => {
      if (pitOutLockTimerRef.current) clearTimeout(pitOutLockTimerRef.current);
    };
  }, []);

  // ---- イベントハンドラファクトリ ----
  const makeHandlePitIn = (laneIndex: number) => () => {
    const draft = laneStates[laneIndex]?.draft;
    if (!draft) return;
    const now = Date.now();
    setLaneState(laneIndex, {
      status: 'working',
      draft: {
        ...draft,
        isDriverChanged: false,
        pitOutDriver: '',
        pitInTime: getNowTime(),
        pitInAt: now,
        pitOutAt: null,
        refuel: false,
        tires: 0,
        other: '',
        createdAt: now,
      },
    });
  };

  const makeHandleDraftChange = (laneIndex: number) => (patch: Partial<LaneDraft>) => {
    updateDraft(laneIndex, patch);
  };

  /** 取り消し: WorkingForm のインライン確認から呼ばれるため confirm() 不要 */
  const makeHandleCancel = (laneIndex: number) => () => {
    resetLane(laneIndex);
  };

  /** 引き継ぎ: WorkingForm のインライン確認から呼ばれるため confirm() 不要 */
  const makeHandleHandover = (laneIndex: number) => () => {
    const draft = laneStates[laneIndex]?.draft;
    if (!draft) return;
    const record: PitRecord = {
      id: uuidv4(),
      createdAt: draft.createdAt,
      carNo: draft.carNo,
      pitNo: draft.pitNo,
      pitInDriver: draft.pitInDriver,
      isDriverChanged: draft.isDriverChanged,
      pitOutDriver: draft.isDriverChanged ? draft.pitOutDriver : '',
      pitInTime: draft.pitInTime,
      pitOutTime: '',
      pitInAt: draft.pitInAt,
      pitOutAt: null,
      refuel: draft.refuel,
      tires: draft.tires,
      other: draft.other,
    };
    addRecord(record);
    resetLane(laneIndex);
  };

  const makeHandlePitOut = (laneIndex: number) => () => {
    const ls = laneStates[laneIndex];
    if (!ls) return;
    const { draft, continuousMode } = ls;
    const nextDriver = draft.isDriverChanged ? draft.pitOutDriver : draft.pitInDriver;
    const now = Date.now();
    const record: PitRecord = {
      id: uuidv4(),
      createdAt: draft.createdAt,
      carNo: draft.carNo,
      pitNo: draft.pitNo,
      pitInDriver: draft.pitInDriver,
      isDriverChanged: draft.isDriverChanged,
      pitOutDriver: nextDriver,
      pitInTime: draft.pitInTime,
      pitOutTime: getNowTime(),
      pitInAt: draft.pitInAt,
      pitOutAt: now,
      refuel: draft.refuel,
      tires: draft.tires,
      other: draft.other,
    };
    addRecord(record);
    if (continuousMode) {
      setLaneState(laneIndex, {
        status: 'standby',
        draft: {
          ...initialLaneState().draft,
          pitNo: draft.pitNo,
          carNo: draft.carNo,
          pitInDriver: nextDriver,
        },
      });
    } else {
      resetLane(laneIndex);
    }
    // PIT OUT直後の誤爆防止ロックを開始
    startPitOutLock();
  };

  const makeHandleToggleContinuous = (laneIndex: number) => () => {
    const ls = laneStates[laneIndex];
    if (!ls) return;
    setLaneState(laneIndex, { continuousMode: !ls.continuousMode });
  };

  const handleLaneCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = Number(e.target.value);
    if (next >= laneCount) {
      setLaneCount(next);
      return;
    }
    // 削減対象レーンに作業中が含まれる場合は確認ダイアログ
    const hasWorkingData = laneStates.slice(next).some((ls) => ls?.status === 'working');
    if (hasWorkingData) {
      if (!window.confirm(
        `レーン数を ${laneCount} → ${next} に減らすと、\n` +
        `レーン ${next + 1}〜${laneCount} の入力途中データが消えます。\n\nよろしいですか？`
      )) return;
    }
    // setLaneCount の戻り値を確認し、失敗時はエラーを表示する
    const ok = setLaneCount(next);
    if (!ok) {
      alert('作業中のレーンがあるため、レーン数を減らせません。\n作業中のレーンを完了または中断してから操作してください。');
    }
  };

  const handleClearAll = () => {
    if (window.confirm('本当にすべての入力情報と履歴をクリアしますか？\n（次のイベントを始める前に使用します）')) {
      clearAllData();
    }
  };

  const allLaneIndices = Array.from({ length: laneCount }, (_, i) => i);
  const standbyLanes = allLaneIndices.filter((i) => laneStates[i]?.status === 'standby');
  const workingLanes = allLaneIndices.filter((i) => laneStates[i]?.status === 'working');

  return (
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden">

      {/* ========== ツールバー ========== */}
      <div className="flex-none bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 shadow-sm">
        <h1 className="text-sm font-black text-gray-800 shrink-0">🏁 PIT REC</h1>

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 font-bold shrink-0">レーン</label>
          <select
            value={laneCount}
            onChange={handleLaneCountChange}
            className="border border-gray-300 rounded text-sm px-1 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setPitInButtonPosition(pitInButtonPosition === 'right' ? 'left' : 'right')}
          className="text-xs font-bold text-gray-600 border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors shrink-0"
        >
          {pitInButtonPosition === 'right' ? '⬅ IN' : 'IN ➡'}
        </button>

        <button
          type="button"
          onClick={() => setShowMasterModal(true)}
          className="text-xs font-bold text-blue-600 border border-blue-300 rounded px-2 py-1 bg-white hover:bg-blue-50 active:bg-blue-100 transition-colors shrink-0"
          title="マスターデータを設定します"
        >
          ⚙️ 登録
        </button>

        <button
          type="button"
          onClick={toggleWakeLock}
          className={`text-xs font-bold border rounded px-2 py-1 transition-colors shrink-0 ${
            isWakeLockActive
              ? 'bg-amber-500 text-white border-amber-500 shadow-inner'
              : 'text-amber-600 border-amber-300 bg-white hover:bg-amber-50'
          }`}
          title="画面の自動消灯を防止します"
        >
          {isWakeLockActive ? '☀️ 維持' : '🌙 維持'}
        </button>

        <div className="flex-1" />

        <button
          onClick={handleClearAll}
          className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-100 transition-colors shrink-0"
        >
          <Trash2 size={12} />
          全クリア
        </button>
      </div>

      {/* ========== メインエリア ========== */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ---- 待機中レーン（作業中あり→圧縮、作業中なし→全画面） ---- */}
        {standbyLanes.length > 0 && (
          <div className={`${workingLanes.length > 0 ? 'flex-none max-h-[35vh]' : 'flex-1'} overflow-y-auto bg-white px-2 py-2 space-y-1.5`}>
            {standbyLanes.map((laneIndex) => {
              const ls = laneStates[laneIndex];
              if (!ls) return null;
              const headerColor = LANE_HEADER_COLORS[laneIndex] ?? 'bg-gray-500';
              const borderColor = LANE_BORDER_COLORS[laneIndex] ?? 'border-gray-300';
              const label = LANE_LABELS[laneIndex] ?? `LANE ${laneIndex + 1}`;

              return (
                <div key={laneIndex} className={`rounded-xl border ${borderColor} overflow-hidden`}>
                  {/* レーンヘッダー */}
                  <div className={`${headerColor} text-white px-3 py-1 flex items-center justify-between`}>
                    <span className="text-xs font-black tracking-wider">{label}</span>
                    {/* 連続モードトグル */}
                    <button
                      type="button"
                      onClick={makeHandleToggleContinuous(laneIndex)}
                      className="flex items-center gap-1 text-xs text-white/80 font-bold"
                    >
                      <span>連続</span>
                      🔄
                      <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${ls.continuousMode ? 'bg-white/70' : 'bg-white/20'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full shadow transition-transform ${ls.continuousMode ? 'translate-x-3.5 bg-blue-600' : 'translate-x-0.5 bg-white/60'}`} />
                      </span>
                    </button>
                  </div>
                  {/* StandbyForm */}
                  <div className="px-2 py-1.5">
                    <StandbyForm
                      draft={ls.draft}
                      onDraftChange={makeHandleDraftChange(laneIndex)}
                      onPitIn={makeHandlePitIn(laneIndex)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* standby が 0 かつ working もない場合 */}
        {standbyLanes.length === 0 && workingLanes.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            レーンを選択して開始してください
          </div>
        )}

        {/* ---- 作業中レーン（下・flex-1 で画面の大部分を占有） ---- */}
        {workingLanes.length > 0 && (
          <div className="relative flex-1 overflow-y-auto border-t-2 border-gray-300 bg-gray-100 p-2">

            {/*
              PIT OUT直後の操作ロックオーバーレイ。
              透明だがpointer-events:allでタップを全て吸収する。
              z-50 で作業カード群の上に被さる。
            */}
            {pitOutLocked && (
              <div
                className="absolute inset-0 z-50"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {/* カード群: transition-all でカードが詰まる動きを滑らかに */}
            <div className="grid grid-cols-2 gap-2">
              {workingLanes.map((laneIndex) => {
                const ls = laneStates[laneIndex];
                if (!ls) return null;
                const borderColor = LANE_BORDER_COLORS[laneIndex] ?? 'border-gray-300';
                const bgColor = LANE_BG_COLORS[laneIndex] ?? 'bg-gray-50';

                return (
                  <div
                    key={laneIndex}
                    className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ease-in-out ${borderColor} ${bgColor}`}
                  >
                    <WorkingForm
                      laneIndex={laneIndex}
                      draft={ls.draft}
                      continuousMode={ls.continuousMode}
                      onDraftChange={makeHandleDraftChange(laneIndex)}
                      onCancel={makeHandleCancel(laneIndex)}
                      onHandover={makeHandleHandover(laneIndex)}
                      onPitOut={makeHandlePitOut(laneIndex)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {showMasterModal && <MasterDataModal onClose={() => setShowMasterModal(false)} />}
    </div>
  );
};

export default InputPage;
