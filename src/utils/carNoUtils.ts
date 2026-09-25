/**
 * CarNo 正規化ユーティリティ
 *
 * マスターデータ側（PDF抽出）とユーザー入力側の両方に適用し、
 * 以下の表記揺れを吸収してマッチングする：
 *   - 全角数字 → 半角数字
 *   - 前後の空白・記号 (#, No., ♯ 等) を除去
 *   - 先頭ゼロを除去（"01" → "1"）
 *   - 全角アルファベット → 半角
 */
export function normalizeCarNo(raw: string): string {
  if (!raw) return '';

  let s = raw.trim();

  // 全角英数字 → 半角
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 先頭の記号 (#, ♯, No., no., №, ゼッケン 等) を除去
  s = s.replace(/^[#♯＃№\s]*(No\.?|no\.?|ゼッケン)?\s*/i, '');

  // 残った先頭の記号 (#, ♯ 等) を念のため再除去
  s = s.replace(/^[#♯＃\s]+/, '');

  // 先頭ゼロを除去（純粋な数字列の場合のみ）
  if (/^\d+$/.test(s)) {
    s = String(parseInt(s, 10));
  }

  return s.trim();
}
