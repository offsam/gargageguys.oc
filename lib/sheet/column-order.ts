export type SheetColumnDropPlace = "before" | "after";

export type SheetColumnDropTarget<T extends string> = {
  key: T;
  place: SheetColumnDropPlace;
};

/**
 * Returns a new column order after moving `fromKey` before/after `toKey`.
 * All columns may move freely (including Job # / Client).
 * Returns null when the move is a no-op.
 */
export function moveSheetColumnOrder<T extends string>(
  order: readonly T[],
  fromKey: T,
  toKey: T,
  place: SheetColumnDropPlace = "before",
): T[] | null {
  if (fromKey === toKey) return null;
  if (!order.includes(fromKey) || !order.includes(toKey)) return null;

  const next = order.slice();
  const fromIdx = next.indexOf(fromKey);
  next.splice(fromIdx, 1);
  let insertAt = next.indexOf(toKey);
  if (insertAt < 0) return null;
  if (place === "after") insertAt += 1;
  next.splice(insertAt, 0, fromKey);

  if (next.join("|") === order.join("|")) return null;
  return next;
}

/**
 * Pick a drop slot by X among all headers.
 * Walks left→right midpoints (excluding the dragged column) so adjacent swaps work.
 */
export function sheetColumnDropAtX<T extends string>(
  clientX: number,
  dragKey: T,
  headers: Array<{ key: T; left: number; right: number }>,
): SheetColumnDropTarget<T> | null {
  if (headers.length < 2) return null;

  const others = headers.filter((h) => h.key !== dragKey && h.right - h.left > 0);
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

/** @deprecated Prefer sheetColumnDropAtX */
export function sheetColumnKeyAtX<T extends string>(
  clientX: number,
  dragKey: T,
  headers: Array<{ key: T; left: number; right: number }>,
): T | null {
  return sheetColumnDropAtX(clientX, dragKey, headers)?.key ?? null;
}
