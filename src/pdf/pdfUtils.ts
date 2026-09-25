import type { PitRecord, Entry } from '../types';

/**
 * Car No. でグループ化し、createdAt でソートして返す
 * 返り値: { carNo, records }[] (carNo の最初の出現順)
 */
export function groupByCarNo(records: PitRecord[]): { carNo: string; records: PitRecord[] }[] {
  // createdAt 昇順でソート
  const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt);

  const map = new Map<string, PitRecord[]>();
  const order: string[] = [];

  for (const r of sorted) {
    if (!map.has(r.carNo)) {
      map.set(r.carNo, []);
      order.push(r.carNo);
    }
    map.get(r.carNo)!.push(r);
  }

  return order.map((carNo) => ({ carNo, records: map.get(carNo)! }));
}

/** 各グループを「ページあたりの最大行数」で分割する */
const ROWS_PER_PAGE = 20; // 1ページに収まる推定行数（PDF側と合わせて調整）

export type PageGroup = {
  carNo: string;
  records: PitRecord[];
  pageIndex: number;   // グループ内のページ番号 (1-based)
  totalPages: number;  // グループ内の総ページ数
};

export function buildPageGroups(records: PitRecord[]): PageGroup[] {
  const groups = groupByCarNo(records);
  const result: PageGroup[] = [];

  for (const { carNo, records: recs } of groups) {
    const totalPages = Math.ceil(recs.length / ROWS_PER_PAGE) || 1;
    for (let i = 0; i < totalPages; i++) {
      result.push({
        carNo,
        records: recs.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE),
        pageIndex: i + 1,
        totalPages,
      });
    }
  }

  return result;
}

export const formatBool = (v: boolean): string => (v ? 'あり' : 'なし');

export const calcDuration = (inTimeAt: number | undefined, outTimeAt: number | null | undefined): string => {
  if (!inTimeAt || !outTimeAt) return '';

  const diffMs = outTimeAt - inTimeAt;
  if (diffMs < 0) return '';
  
  const diffSec = Math.floor(diffMs / 1000);
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  
  const h = Math.floor(m / 60);
  const remM = m % 60;
  
  if (h > 0) {
    return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * ドライバー名がエントリーリストにある場合、A, B, C... のアルファベットに変換する
 */
export const getDriverLabel = (driverName: string, entry?: Entry): string => {
  if (!driverName) return '';
  if (!entry || !entry.drivers) return driverName;

  const idx = entry.drivers.indexOf(driverName);
  if (idx !== -1) {
    return String.fromCharCode(65 + idx); // 0 -> A, 1 -> B, etc.
  }
  return driverName;
};
