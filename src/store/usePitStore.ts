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

  addRecord: (record: PitRecord) => void;
  updateRecord: (id: string, patch: Partial<PitRecord>) => void;
  deleteRecord: (id: string) => void;
  setSessionName: (v: string) => void;
  setInspector: (v: string) => void;
  /** レーン数を変更。切り捨て対象に working レーンが含まれる場合は false を返す */
  setLaneCount: (count: number) => boolean;
  /** 部分マージ方式 */
  setLaneState: (index: number, partial: Partial<LaneState>) => void;
  /** draft のみネストマージ（stale closure を起こさないストア駆動版） */
  updateDraft: (index: number, patch: Partial<LaneDraft>) => void;
  /** continuousMode を温存したまま status/draft のみ初期化 */
  resetLane: (index: number) => void;
  clearAllData: () => void;
  setPitInButtonPosition: (pos: 'left' | 'right') => void;
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

      setLaneCount: (count) => {
        let success = true;
        set((s) => {
          const current = s.laneStates;
          // 増やす場合: 新しいレーンを追加
          if (count >= current.length) {
            const added = Array.from(
              { length: count - current.length },
              () => initialLaneState()
            );
            return { laneCount: count, laneStates: [...current, ...added] };
          }
          // 減らす場合: 切り捨て対象に working レーンが含まれるか確認
          const toRemove = current.slice(count);
          if (toRemove.some((ls) => ls.status === 'working')) {
            success = false;
            return {}; // 変更なし
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
        })),
    }),
    {
      name: 'pit-records-storage',
      version: 1,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = persistedState as Record<string, unknown> | null;
        if (!state) return state as unknown as PitStore;

        // pitInButtonPosition が無い旧データに初期値を補完
        if (state.pitInButtonPosition === undefined) {
          state.pitInButtonPosition = 'right';
        }

        if (fromVersion < 1) {
          if (!Array.isArray(state.records)) {
            state.records = [];
          }
          if (!Array.isArray(state.laneStates)) {
            state.laneStates = [initialLaneState(), initialLaneState()];
          }

          // PitRecord に pitInAt / pitOutAt を補完
          if (Array.isArray(state.records)) {
            state.records = (state.records as Record<string, unknown>[])
              .filter(Boolean)
              .map((r) => {
                const record = r as Record<string, unknown>;
                if (record.pitInAt === undefined || record.pitInAt === null) {
                  const timeStr = record.pitInTime as string | undefined;
                  const createdAt = (record.createdAt as number | undefined) ?? Date.now();
                  if (timeStr && /^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
                    const base = new Date(createdAt);
                    const [hh, mm, ss] = timeStr.split(':').map(Number);
                    base.setHours(hh, mm, ss, 0);
                    record.pitInAt = base.getTime();
                  } else {
                    record.pitInAt = createdAt;
                  }
                }
                if (record.pitOutAt === undefined) {
                  const outTime = record.pitOutTime as string | undefined;
                  if (outTime && /^\d{2}:\d{2}:\d{2}$/.test(outTime)) {
                    const base = new Date((record.pitInAt as number));
                    const [hh, mm, ss] = outTime.split(':').map(Number);
                    base.setHours(hh, mm, ss, 0);
                    record.pitOutAt = base.getTime();
                  } else {
                    record.pitOutAt = null;
                  }
                }
                return record;
              });
          }

          // LaneState.draft に pitInAt / pitOutAt を補完
          if (Array.isArray(state.laneStates)) {
            state.laneStates = (state.laneStates as Record<string, unknown>[]).map((ls) => {
              if (!ls) return initialLaneState() as unknown as Record<string, unknown>;
              const laneState = ls as Record<string, unknown>;
              const draft = (laneState.draft ?? {}) as Record<string, unknown>;
              if (draft.pitInAt === undefined || draft.pitInAt === null) {
                const timeStr = draft.pitInTime as string | undefined;
                const createdAt = (draft.createdAt as number | undefined) ?? 0;
                if (timeStr && /^\d{2}:\d{2}:\d{2}$/.test(timeStr) && createdAt > 0) {
                  const base = new Date(createdAt);
                  const [hh, mm, ss] = timeStr.split(':').map(Number);
                  base.setHours(hh, mm, ss, 0);
                  draft.pitInAt = base.getTime();
                } else {
                  draft.pitInAt = createdAt;
                }
              }
              if (draft.pitOutAt === undefined) {
                draft.pitOutAt = null;
              }
              laneState.draft = draft;
              return laneState;
            });
          }
        }

        return state as unknown as PitStore;
      },
    }
  )
);
