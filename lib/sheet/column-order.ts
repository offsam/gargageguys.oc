/** Sticky Sheet columns stay left; reorder only within sticky or within the rest. */
export const STICKY_SHEET_COLUMNS = ["jobNumber", "clientName"] as const;

export function isStickySheetColumn(key: string, sticky: readonly string[] = STICKY_SHEET_COLUMNS): boolean {
  return sticky.includes(key);
}

export type SheetColumnDropPlace = "before" | "after";

export type SheetColumnDropTarget<T extends string> = {
  key: T;
  place: SheetColumnDropPlace;
};

/**
 * Returns a new column order after moving `fromKey` before/after `toKey`.
 * Returns null when the move is a no-op or crosses the sticky boundary.
 */
export function moveSheetColumnOrder<T extends string>(
  order: readonly T[],
  fromKey: T,
  toKey: T,
  sticky: readonly string[] = STICKY_SHEET_COLUMNS,
  place: SheetColumnDropPlace = "before",
): T[] | null {
  if (fromKey === toKey) return null;
  if (!order.includes(fromKey) || !order.includes(toKey)) return null;
  if (isStickySheetColumn(fromKey, sticky) !== isStickySheetColumn(toKey, sticky)) {
    return null;
  }

  const next = order.slice();
  const fromIdx = next.indexOf(fromKey);
  next.splice(fromIdx, 1);
  let insertAt = next.indexOf(toKey);
  if (insertAt < 0) return null;
  if (place === "after") insertAt += 1;
  next.splice(insertAt, 0, fromKey);

  // Keep sticky keys first, preserve relative order within each group.
  const stickyKeys = next.filter((key) => isStickySheetColumn(key, sticky));
  const restKeys = next.filter((key) => !isStickySheetColumn(key, sticky));
  const normalized = [...stickyKeys, ...restKeys];
  if (normalized.join("|") === order.join("|")) return null;
  return normalized;
}

/**
 * Pick a drop slot by X among the same sticky/non-sticky group as the dragged column.
 * Walks left→right midpoints (excluding the dragged column) so adjacent swaps work.
 */
export function sheetColumnDropAtX<T extends string>(
  clientX: number,
  dragKey: T,
  headers: Array<{ key: T; left: number; right: number }>,
  sticky: readonly string[] = STICKY_SHEET_COLUMNS,
): SheetColumnDropTarget<T> | null {
  const dragSticky = isStickySheetColumn(dragKey, sticky);
  const group = headers.filter((h) => isStickySheetColumn(h.key, sticky) === dragSticky);
  if (group.length < 2) return null;

  const others = group.filter((h) => h.key !== dragKey && h.right - h.left > 0);
  if (others.length === 0) return null;

  for (const h of others) {
    const mid = (h.left + h.right) / 2;
    if (clientX < mid) {
      return { key: h.key, place: "before" };
    }
  }
  const last = others[others.length - 1];
  return { key: last.key, place: "after" };
}

/** @deprecated Prefer sheetColumnDropAtX — kept for call sites that only need the key. */
export function sheetColumnKeyAtX<T extends string>(
  clientX: number,
  dragKey: T,
  headers: Array<{ key: T; left: number; right: number }>,
  sticky: readonly string[] = STICKY_SHEET_COLUMNS,
): T | null {
  return sheetColumnDropAtX(clientX, dragKey, headers, sticky)?.key ?? null;
}
