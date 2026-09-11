/** Sticky Sheet columns stay left; reorder only within sticky or within the rest. */
export const STICKY_SHEET_COLUMNS = ["jobNumber", "clientName"] as const;

export function isStickySheetColumn(key: string, sticky: readonly string[] = STICKY_SHEET_COLUMNS): boolean {
  return sticky.includes(key);
}

/**
 * Returns a new column order after moving `fromKey` before `toKey`.
 * Returns null when the move is a no-op or crosses the sticky boundary.
 */
export function moveSheetColumnOrder<T extends string>(
  order: readonly T[],
  fromKey: T,
  toKey: T,
  sticky: readonly string[] = STICKY_SHEET_COLUMNS,
): T[] | null {
  if (fromKey === toKey) return null;
  if (!order.includes(fromKey) || !order.includes(toKey)) return null;
  if (isStickySheetColumn(fromKey, sticky) !== isStickySheetColumn(toKey, sticky)) {
    return null;
  }

  const next = order.slice();
  const fromIdx = next.indexOf(fromKey);
  next.splice(fromIdx, 1);
  const insertAt = next.indexOf(toKey);
  if (insertAt < 0) return null;
  next.splice(insertAt, 0, fromKey);

  // Keep sticky keys first, preserve relative order within each group.
  const stickyKeys = next.filter((key) => isStickySheetColumn(key, sticky));
  const restKeys = next.filter((key) => !isStickySheetColumn(key, sticky));
  const normalized = [...stickyKeys, ...restKeys];
  if (normalized.join("|") === order.join("|")) return null;
  return normalized;
}

/**
 * Pick a drop target column by X, only among the same sticky/non-sticky group
 * as the dragged column — avoids sticky headers stealing hits after H-scroll.
 */
export function sheetColumnKeyAtX<T extends string>(
  clientX: number,
  dragKey: T,
  headers: Array<{ key: T; left: number; right: number }>,
  sticky: readonly string[] = STICKY_SHEET_COLUMNS,
): T | null {
  const dragSticky = isStickySheetColumn(dragKey, sticky);
  const group = headers.filter((h) => isStickySheetColumn(h.key, sticky) === dragSticky);
  if (group.length === 0) return null;

  let hit: T | null = null;
  let best: { key: T; dist: number } | null = null;
  for (const h of group) {
    if (h.key === dragKey) continue;
    const width = h.right - h.left;
    if (width <= 0) continue;
    if (clientX >= h.left && clientX <= h.right) hit = h.key;
    const mid = (h.left + h.right) / 2;
    const dist = Math.abs(clientX - mid);
    if (!best || dist < best.dist) best = { key: h.key, dist };
  }
  if (hit) return hit;
  if (best && best.dist < 220) return best.key;
  return null;
}
