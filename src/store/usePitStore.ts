import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PitRecord, LaneDraft, LaneStatus } from '../types';

export type LaneState = {
  status: LaneStatus;
  draft: LaneDraft;
  continuousMode: boolean;
};

const initialLaneDraft = (): LaneDraft => ({
  pitNo: '',
  carNo: '',
  pitInDriver: '',
  isDriverChanged: false,
  pitOutDriver: '',
  pitInTime: '',
  refuel: false,
  tires: 0,
  other: '',
  createdAt: 0,
});

export const initialLaneState = (): LaneState => ({
  status: 'standby',
  draft: initialLaneDraft(),
  continuousMode: false,
});

interface PitStore {
  records: PitRecord[];
  sessionName: string;
  inspector: string;
  laneCount: number;        // 1〜10
  laneStates: LaneState[];  // 可変長（最大10）

  addRecord: (record: PitRecord) => void;
  updateRecord: (id: string, patch: Partial<PitRecord>) => void;
  deleteRecord: (id: string) => void;
  setSessionName: (v: string) => void;
  setInspector: (v: string) => void;
  setLaneCount: (count: number) => void;
  // 部分マージ方式
  setLaneState: (index: number, partial: Partial<LaneState>) => void;
  // continuousMode を温存したまま status/draft のみ初期化
  resetLane: (index: number) => void;
  clearAllData: () => void;
}

export const usePitStore = create<PitStore>()(
  persist(
    (set) => ({
      records: [],
      sessionName: '',
      inspector: '',
      laneCount: 2,
      laneStates: [initialLaneState(), initialLaneState()],

      addRecord: (record) =>
        set((state) => ({ records: [...state.records, record] })),

      updateRecord: (id, patch) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...patch } : r
          ),
        })),

      deleteRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        })),

      setSessionName: (v) => set({ sessionName: v }),
      setInspector: (v) => set({ inspector: v }),

      setLaneCount: (count) =>
        set((s) => {
          const current = s.laneStates;
          // 増やす場合: 新しいレーンを追加
          if (count > current.length) {
            const added = Array.from(
              { length: count - current.length },
              () => initialLaneState()
            );
            return { laneCount: count, laneStates: [...current, ...added] };
          }
          // 減らす場合: 末尾を切り捨て（呼び出し元で確認済み）
          return { laneCount: count, laneStates: current.slice(0, count) };
        }),

      setLaneState: (index, partial) =>
        set((s) => {
          const next = [...s.laneStates];
          next[index] = { ...next[index], ...partial };
          return { laneStates: next };
        }),

      resetLane: (index) =>
        set((s) => {
          const next = [...s.laneStates];
          next[index] = {
            ...initialLaneState(),
            continuousMode: s.laneStates[index].continuousMode,
          };
          return { laneStates: next };
        }),

      clearAllData: () =>
        set((s) => ({
          records: [],
          sessionName: '',
          inspector: '',
          laneStates: Array.from({ length: s.laneCount }, () => initialLaneState()),
        })),
    }),
    {
      name: 'pit-records-storage',
    }
  )
);
