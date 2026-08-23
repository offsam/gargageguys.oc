export type SheetServiceLine = {
  name: string;
  qty: number;
};

/** Display: `Cable replacement ×2; Tune-up / lubrication` */
export function formatServiceLines(lines: SheetServiceLine[]): string {
  return lines
    .filter((line) => line.name.trim() && line.qty > 0)
    .map((line) => {
      const name = line.name.trim();
      return line.qty > 1 ? `${name} ×${line.qty}` : name;
    })
    .join("; ");
}

export function parseServiceLines(raw: unknown, fallbackService = ""): SheetServiceLine[] {
  if (Array.isArray(raw)) {
    const out: SheetServiceLine[] = [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = String(r.name || "").trim();
      const qty = Math.max(0, Math.floor(Number(r.qty) || 0));
      if (!name || qty <= 0) continue;
      out.push({ name, qty });
    }
    if (out.length) return mergeServiceLines(out);
  }

  const text = String(fallbackService || "").trim();
  if (!text) return [];

  const out: SheetServiceLine[] = [];
  for (const chunk of text.split(/;|\n/)) {
    const piece = chunk.trim();
    if (!piece) continue;
    const m = piece.match(/^(.*?)(?:\s*[×x]\s*(\d+))\s*$/i);
    if (m) {
      const name = m[1].trim();
      const qty = Math.max(1, Math.floor(Number(m[2]) || 1));
      if (name) out.push({ name, qty });
      continue;
    }
    out.push({ name: piece, qty: 1 });
  }
  return mergeServiceLines(out);
}

export function mergeServiceLines(lines: SheetServiceLine[]): SheetServiceLine[] {
  const map = new Map<string, number>();
  for (const line of lines) {
    const name = line.name.trim();
    if (!name || line.qty <= 0) continue;
    map.set(name, (map.get(name) || 0) + Math.floor(line.qty));
  }
  return [...map.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
