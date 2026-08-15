export type SheetPartLine = {
  name: string;
  qty: number;
};

/** Display: `Chamberlain B3010 ×2; 207*27 (red)` */
export function formatPartsLines(lines: SheetPartLine[]): string {
  return lines
    .filter((line) => line.name.trim() && line.qty > 0)
    .map((line) => {
      const name = line.name.trim();
      return line.qty > 1 ? `${name} ×${line.qty}` : name;
    })
    .join("; ");
}

export function parsePartsLines(raw: unknown, fallbackParts = ""): SheetPartLine[] {
  if (Array.isArray(raw)) {
    const out: SheetPartLine[] = [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = String(r.name || "").trim();
      const qty = Math.max(0, Math.floor(Number(r.qty) || 0));
      if (!name || qty <= 0) continue;
      out.push({ name, qty });
    }
    if (out.length) return mergePartLines(out);
  }

  const text = String(fallbackParts || "").trim();
  if (!text) return [];

  const out: SheetPartLine[] = [];
  for (const chunk of text.split(/;|\n|,/)) {
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
  return mergePartLines(out);
}

export function mergePartLines(lines: SheetPartLine[]): SheetPartLine[] {
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

export function partsCostForLines(
  lines: SheetPartLine[],
  unitCostByName: Map<string, string>,
): string {
  let total = 0;
  let any = false;
  for (const line of lines) {
    const raw = unitCostByName.get(line.name);
    if (raw == null || raw === "") continue;
    const unit = Number(String(raw).replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(unit)) continue;
    any = true;
    total += unit * line.qty;
  }
  if (!any) return "";
  return total.toFixed(2);
}
