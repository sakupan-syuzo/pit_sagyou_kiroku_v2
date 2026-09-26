/** マスターデータ（エントリーリスト） */
export type Entry = {
  id: string;
  carNo: string;
  drivers: string[];
  team?: string;
  pitNo?: string;
};

/** レース（セッション）設定 */
export type Race = {
  id: string;                     // 'race1' 〜 'race5'
  name: string;                   // 表示名（例: "決勝レース", "予選Q1"）
  entries: Record<string, Entry>; // このレースのエントリーリスト
};

/** 1回のピット作業記録 */
export type PitRecord = {
  id: string;           // UUID v4
  createdAt: number;    // Date.now() — ソート・日跨ぎ判定の基準
  raceId?: string;      // 紐づいたレースID（'race1' 〜 'race5'）
  carNo: string;
  pitNo: string;
  pitInDriver: string;
  isDriverChanged: boolean;
  pitOutDriver: string;
  pitInTime: string;    // "HH:mm:ss" — 表示専用
  pitOutTime: string;   // "HH:mm:ss" または "" (途中離脱)
  pitInAt: number;      // epoch ms — 計算用
  pitOutAt: number | null; // epoch ms — 計算用（途中離脱時は null）
  refuel: boolean;
  tires: number;        // 0〜4
  other: string;
};

/** レーンの一時的な作業中状態 */
export type LaneStatus = 'standby' | 'working';

export type LaneDraft = {
  pitNo: string;
  carNo: string;
  pitInDriver: string;
  isDriverChanged: boolean;
  pitOutDriver: string;
  pitInTime: string;
  pitInAt: number;      // epoch ms — 計算用
  pitOutAt: number | null; // epoch ms — 計算用
  refuel: boolean;
  tires: number;
  other: string;
  createdAt: number;
};
