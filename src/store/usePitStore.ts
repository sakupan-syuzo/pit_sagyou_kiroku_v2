import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PitRecord, LaneDraft, LaneStatus, Entry, Race } from '../types';

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

const RACE_IDS = ['race1', 'race2', 'race3', 'race4', 'race5'] as const;
const DEFAULT_RACE_NAMES = ['レース 1', 'レース 2', 'レース 3', 'レース 4', 'レース 5'];

const initialRaces = (): Race[] =>
  RACE_IDS.map((id, i) => ({
    id,
    name: DEFAULT_RACE_NAMES[i],
    entries: {},
  }));

interface PitStore {
  records: PitRecord[];
  sessionName: string;
  inspector: string;
  laneCount: number;        // 1〜10
  laneStates: LaneState[];  // 可変長（最大10）
  pitInButtonPosition: 'left' | 'right';
  entries: Record<string, Entry>; // アクティブレースのエントリー（後方互換用ミラー）
  races: Race[];            // レース1〜5の設定
  activeRaceId: string;     // 現在アクティブなレースID

  addRecord: (record: PitRecord) => void;
  updateRecord: (id: string, patch: Partial<PitRecord>) => void;
  deleteRecord: (id: string) => void;
  setRecords: (records: PitRecord[]) => void;
  setSessionName: (v: string) => void;
  setInspector: (v: string) => void;
  setLaneCount: (count: number) => boolean;
  setLaneState: (index: number, partial: Partial<LaneState>) => void;
  updateDraft: (index: number, patch: Partial<LaneDraft>) => void;
  resetLane: (index: number) => void;
  clearAllData: () => void;
  setPitInButtonPosition: (pos: 'left' | 'right') => void;
  setEntries: (entries: Record<string, Entry>) => void;
  // レース管理
  setActiveRace: (raceId: string) => void;
  updateRaceName: (raceId: string, name: string) => void;
  setRaceEntries: (raceId: string, entries: Record<string, Entry>) => void;
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
      races: initialRaces(),
      activeRaceId: 'race1',

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

      setRecords: (records) => set({ records }),

      setSessionName: (v) => set({ sessionName: v }),
      setInspector: (v) => set({ inspector: v }),
      setPitInButtonPosition: (pos) => set({ pitInButtonPosition: pos }),

      // 後方互換: entries への直接書き込みは「アクティブレース」に反映
      setEntries: (entries) =>
        set((state) => {
          const updatedRaces = state.races.map((r) =>
            r.id === state.activeRaceId ? { ...r, entries } : r
          );
          return { entries, races: updatedRaces };
        }),

      // レース切り替え: entriesミラーを更新
      setActiveRace: (raceId) =>
        set((state) => {
          const race = state.races.find((r) => r.id === raceId);
          return {
            activeRaceId: raceId,
            entries: race?.entries ?? {},
          };
        }),

      // レース名変更
      updateRaceName: (raceId, name) =>
        set((state) => ({
          races: state.races.map((r) =>
            r.id === raceId ? { ...r, name } : r
          ),
        })),

      // レースのエントリーを保存（entriesミラーも更新）
      setRaceEntries: (raceId, entries) =>
        set((state) => {
          const updatedRaces = state.races.map((r) =>
            r.id === raceId ? { ...r, entries } : r
          );
          // アクティブレースが変更された場合のみミラー更新
          const newEntries = raceId === state.activeRaceId ? entries : state.entries;
          return { races: updatedRaces, entries: newEntries };
        }),

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
          // entries・races はマスターデータなのでクリアしない
        })),
    }),
    {
      name: 'pit-records-storage-v2',
      version: 3,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = persistedState as Record<string, unknown> | null;
        if (!state) return state as unknown as PitStore;

        if (state.pitInButtonPosition === undefined) {
          state.pitInButtonPosition = 'right';
        }
        if (state.entries === undefined) {
          state.entries = {};
        }
        // v3移行: races が存在しない場合は初期化し、既存 entries を race1 に移行
        if (!Array.isArray(state.races) || (state.races as Race[]).length === 0) {
          const races = initialRaces();
          if (state.entries && Object.keys(state.entries as object).length > 0) {
            races[0].entries = state.entries as Record<string, Entry>;
          }
          state.races = races;
        }
        if (state.activeRaceId === undefined) {
          state.activeRaceId = 'race1';
        }

        if (fromVersion < 1) {
          if (!Array.isArray(state.records)) state.records = [];
          if (!Array.isArray(state.laneStates)) {
            state.laneStates = [initialLaneState(), initialLaneState()];
          }
        }

        return state as unknown as PitStore;
      },
    }
  )
);
