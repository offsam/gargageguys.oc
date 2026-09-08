import { SEED_STOCK_ITEMS } from "@/lib/stock/seed-catalog";
import type { StockOrderLine } from "@/lib/telegram/stock-order-parse";

export type StockCatalogItem = { sku: string; name: string };

export type MatchedStockOrderLine = {
  rawName: string;
  qty: number;
  poNumber: string | null;
  /** Catalog hits after expanding (pair) → red+black. */
  matches: Array<{ sku: string; name: string; qty: number }>;
  status: "matched" | "partial" | "unmatched";
};

function normalizeName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/black/g, "blk")
    .replace(/[“”"]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/[^\w*#"'.-]+/g, " ")
    .trim();
}

function expandPairName(rawName: string): string[] {
  const m = rawName.match(/^(\d+\s*[x*×]\s*\d+)\s*\(\s*pair\s*\)\s*$/i);
  if (!m) return [rawName];
  const base = m[1]!.replace(/\s+/g, "").replace(/[x×]/g, "*");
  return [`${base} (red)`, `${base} (blk)`];
}

function scoreMatch(a: string, b: string): number {
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const at = new Set(a.split(" ").filter(Boolean));
  const bt = new Set(b.split(" ").filter(Boolean));
  let hit = 0;
  for (const t of at) if (bt.has(t)) hit += 1;
  if (!at.size) return 0;
  return Math.round((hit / at.size) * 60);
}

export function matchStockOrderLines(
  lines: StockOrderLine[],
  catalog: StockCatalogItem[] = SEED_STOCK_ITEMS.map((i) => ({ sku: i.sku, name: i.name })),
): MatchedStockOrderLine[] {
  const normCatalog = catalog.map((c) => ({
    ...c,
    key: normalizeName(c.name),
  }));

  return lines.map((line) => {
    const expanded = expandPairName(line.rawName);
    const matches: MatchedStockOrderLine["matches"] = [];

    for (const name of expanded) {
      const key = normalizeName(name);
      let best: { sku: string; name: string; score: number } | null = null;
      for (const item of normCatalog) {
        const score = scoreMatch(key, item.key);
        if (!best || score > best.score) best = { sku: item.sku, name: item.name, score };
      }
      if (best && best.score >= 70) {
        matches.push({ sku: best.sku, name: best.name, qty: line.qty });
      }
    }

    const needed = expanded.length;
    const status: MatchedStockOrderLine["status"] =
      matches.length === 0
        ? "unmatched"
        : matches.length < needed
          ? "partial"
          : "matched";

    return {
      rawName: line.rawName,
      qty: line.qty,
      poNumber: line.poNumber,
      matches,
      status,
    };
  });
}
