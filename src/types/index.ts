/** 1回のピット作業記録 */
export type PitRecord = {
  id: string;           // UUID v4
  createdAt: number;    // Date.now() — ソート・日跨ぎ判定の基準
  carNo: string;
  pitNo: string;
  pitInDriver: string;
  isDriverChanged: boolean;
  pitOutDriver: string;
  pitInTime: string;    // "HH:mm:ss" — 表示専用
  pitOutTime: string;   // "HH:mm:ss" または "" (途中離脱)
  refuel: boolean;
  tires: number;        // 0〜4
  other: string;
};

/** レーンの一時的な作業中状態 (localStorage非永続) */
export type LaneStatus = 'standby' | 'working';

export type LaneDraft = {
  pitNo: string;
  carNo: string;
  pitInDriver: string;
  isDriverChanged: boolean;
  pitOutDriver: string;
  pitInTime: string;
  refuel: boolean;
  tires: number;
  other: string;
  createdAt: number;
};
