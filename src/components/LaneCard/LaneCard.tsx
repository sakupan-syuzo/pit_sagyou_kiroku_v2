import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePitStore } from '../../store/usePitStore';
import type { LaneDraft, PitRecord } from '../../types';
import StandbyForm from './StandbyForm';
import WorkingForm from './WorkingForm';

interface LaneCardProps {
  laneIndex: number;
}

const getNowTime = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const LANE_LABELS = ['監視レーン 1', '監視レーン 2', '監視レーン 3', '監視レーン 4', '監視レーン 5', '監視レーン 6', '監視レーン 7', '監視レーン 8', '監視レーン 9', '監視レーン 10'];
const LANE_COLORS = [
  'from-blue-600 to-blue-500',
  'from-purple-600 to-purple-500',
  'from-emerald-600 to-emerald-500',
  'from-orange-500 to-orange-400',
  'from-rose-600 to-rose-500',
  'from-cyan-600 to-cyan-500',
  'from-yellow-500 to-yellow-400',
  'from-teal-600 to-teal-500',
  'from-pink-600 to-pink-500',
  'from-indigo-600 to-indigo-500',
];
const LANE_BORDER = [
  'border-blue-200',
  'border-purple-200',
  'border-emerald-200',
  'border-orange-200',
  'border-rose-200',
  'border-cyan-200',
  'border-yellow-200',
  'border-teal-200',
  'border-pink-200',
  'border-indigo-200',
];
const LANE_STATUS_BG = [
  'bg-blue-50',
  'bg-purple-50',
  'bg-emerald-50',
  'bg-orange-50',
  'bg-rose-50',
  'bg-cyan-50',
  'bg-yellow-50',
  'bg-teal-50',
  'bg-pink-50',
  'bg-indigo-50',
];

const LaneCard: React.FC<LaneCardProps> = ({ laneIndex }) => {
  const addRecord = usePitStore((s) => s.addRecord);
  const laneState = usePitStore((s) => s.laneStates[laneIndex]);
  const setLaneState = usePitStore((s) => s.setLaneState);
  const resetLane = usePitStore((s) => s.resetLane);

  const { status, draft, continuousMode } = laneState;

  const handleToggleContinuous = () => {
    // 部分マージなので continuousMode だけ更新、status/draft は維持される
    setLaneState(laneIndex, { continuousMode: !continuousMode });
  };

  const handlePitIn = (fields: Pick<LaneDraft, 'pitNo' | 'carNo' | 'pitInDriver'>) => {
    // 部分マージで status と draft だけ更新（continuousMode は維持）
    setLaneState(laneIndex, {
      status: 'working',
      draft: {
        pitNo: fields.pitNo,
        carNo: fields.carNo,
        pitInDriver: fields.pitInDriver,
        isDriverChanged: false,
        pitOutDriver: '',
        pitInTime: getNowTime(),
        refuel: false,
        tires: 0,
        other: '',
        createdAt: Date.now(),
      },
    });
  };

  const handleDraftChange = (patch: Partial<LaneDraft>) => {
    // 部分マージで draft だけ更新（continuousMode は維持）
    setLaneState(laneIndex, {
      draft: { ...draft, ...patch },
    });
  };

  const handleCancel = () => {
    if (!window.confirm('作業データを破棄して待機中に戻りますか？')) return;
    // resetLane は continuousMode を温存したままリセット
    resetLane(laneIndex);
  };

  const handleHandover = () => {
    if (!window.confirm('引き継ぎとして保存し、待機中に戻りますか？\n（PIT OUT時刻は空欄になります）')) return;
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
      refuel: draft.refuel,
      tires: draft.tires,
      other: draft.other,
    };
    addRecord(record);
    // 引き継ぎは連続モードに関わらず通常リセット（continuousMode は温存）
    resetLane(laneIndex);
  };

  const handlePitOut = () => {
    const nextDriver = draft.isDriverChanged ? draft.pitOutDriver : draft.pitInDriver;

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
      refuel: draft.refuel,
      tires: draft.tires,
      other: draft.other,
    };
    addRecord(record);

    if (continuousMode) {
      // 連続モード: pitNo / carNo / 次ドライバーを保持し、その他はクリア
      setLaneState(laneIndex, {
        status: 'standby',
        draft: {
          pitNo: draft.pitNo,
          carNo: draft.carNo,
          pitInDriver: nextDriver,
          isDriverChanged: false,
          pitOutDriver: '',
          pitInTime: '',
          pitOutTime: '',
          refuel: false,
          tires: 0,
          other: '',
          createdAt: 0,
        } as LaneDraft,
        // continuousMode は部分マージなので指定不要（維持される）
      });
    } else {
      // 通常モード: 全クリア（continuousMode は温存）
      resetLane(laneIndex);
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-md border ${LANE_BORDER[laneIndex]} overflow-hidden`}>
      {/* ヘッダー */}
      <div className={`bg-gradient-to-r ${LANE_COLORS[laneIndex]} text-white px-4 py-2.5 flex items-center justify-between gap-2`}>
        <span className="font-bold text-sm tracking-wide shrink-0">{LANE_LABELS[laneIndex]}</span>

        {/* 連続記録モード トグル（常時表示） */}
        <button
          type="button"
          onClick={handleToggleContinuous}
          className="flex items-center gap-1.5 shrink-0"
          title={continuousMode ? '連続記録モード ON（タップでOFF）' : '連続記録モード OFF（タップでON）'}
        >
          <span className="text-xs text-white/80 font-bold">🔄 連続</span>
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              continuousMode ? 'bg-white/70' : 'bg-white/20'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform shadow ${
                continuousMode
                  ? 'translate-x-4 bg-blue-600'
                  : 'translate-x-1 bg-white/60'
              }`}
            />
          </span>
        </button>

        {/* ステータスバッジ */}
        {status === 'working' ? (
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-bold shrink-0">
            🔴 作業中 — Car {draft.carNo}
          </span>
        ) : (
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 shrink-0">
            ⚪ 待機中
          </span>
        )}
      </div>

      {/* ボディ */}
      <div className={`p-4 ${status === 'working' ? LANE_STATUS_BG[laneIndex] : ''}`}>
        {status === 'standby' ? (
          <StandbyForm
            onPitIn={handlePitIn}
            initialPitNo={draft.pitNo}
            initialCarNo={draft.carNo}
            initialDriver={draft.pitInDriver}
          />
        ) : (
          <WorkingForm
            draft={draft}
            onDraftChange={handleDraftChange}
            onCancel={handleCancel}
            onHandover={handleHandover}
            onPitOut={handlePitOut}
          />
        )}
      </div>
    </div>
  );
};

export default LaneCard;
