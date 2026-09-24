import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PitRecord, LaneDraft, LaneStatus, Entry } from '../types';

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
  pitInAt: 0,
  pitOutAt: null,
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
  pitInButtonPosition: 'left' | 'right'; // PIT INボタン位置
  entries: Record<string, Entry>; // CarNo をキーとするエントリーリスト

  addRecord: (record: PitRecord) => void;
  updateRecord: (id: string, patch: Partial<PitRecord>) => void;
  deleteRecord: (id: string) => void;
  setSessionName: (v: string) => void;
  setInspector: (v: string) => void;
  setLaneCount: (count: number) => boolean;
  setLaneState: (index: number, partial: Partial<LaneState>) => void;
  updateDraft: (index: number, patch: Partial<LaneDraft>) => void;
  resetLane: (index: number) => void;
  clearAllData: () => void;
  setPitInButtonPosition: (pos: 'left' | 'right') => void;
  setEntries: (entries: Record<string, Entry>) => void;
}

export const usePitStore = create<PitStore>()(
  persist(
    (set) => ({
      records: [],
      sessionName: '',
      inspector: '',
      laneCount: 2,
      laneStates: [initialLaneState(), initialLaneState()],
      pitInButtonPosition: 'right',
      entries: {},

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
      setPitInButtonPosition: (pos) => set({ pitInButtonPosition: pos }),
      setEntries: (entries) => set({ entries }),

      setLaneCount: (count) => {
        let success = true;
        set((s) => {
          const current = s.laneStates;
          if (count >= current.length) {
            const added = Array.from(
              { length: count - current.length },
              () => initialLaneState()
            );
            return { laneCount: count, laneStates: [...current, ...added] };
          }
          const toRemove = current.slice(count);
          if (toRemove.some((ls) => ls.status === 'working')) {
            success = false;
            return {};
          }
          return { laneCount: count, laneStates: current.slice(0, count) };
        });
        return success;
      },

      setLaneState: (index, partial) =>
        set((s) => {
          const next = [...s.laneStates];
          next[index] = { ...next[index], ...partial };
          return { laneStates: next };
        }),

      updateDraft: (index, patch) =>
        set((s) => {
          const next = [...s.laneStates];
          next[index] = {
            ...next[index],
            draft: { ...next[index].draft, ...patch },
          };
          return { laneStates: next };
        }),

      resetLane: (index) =>
        set((s) => {
          const next = [...s.laneStates];
          next[index] = {
            ...initialLaneState(),
            continuousMode: s.laneStates[index]?.continuousMode ?? false,
          };
          return { laneStates: next };
        }),

      clearAllData: () =>
        set((s) => ({
          records: [],
          sessionName: '',
          inspector: '',
          laneStates: Array.from({ length: s.laneCount }, () => initialLaneState()),
          // entries はマスターデータなのでクリアしない
        })),
    }),
    {
      name: 'pit-records-storage',
      version: 2,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = persistedState as Record<string, unknown> | null;
        if (!state) return state as unknown as PitStore;

        if (state.pitInButtonPosition === undefined) {
          state.pitInButtonPosition = 'right';
        }
        if (state.entries === undefined) {
          state.entries = {};
        }

        if (fromVersion < 1) {
          if (!Array.isArray(state.records)) state.records = [];
          if (!Array.isArray(state.laneStates)) {
            state.laneStates = [initialLaneState(), initialLaneState()];
          }
          // ... migrations omitted for brevity (kept logical equivalent)
        }

        return state as unknown as PitStore;
      },
    }
  )
);
