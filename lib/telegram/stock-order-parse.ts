/**
 * Parse Stock replenishment messages like:
 *
 * Order:
 * End plates x1
 * Cable 7-ft x1
 * …
 * 250*33 (pair) x1
 * po# sam82126
 */

export type StockOrderLine = {
  rawName: string;
  qty: number;
  /** Purchase order id from the following `po# …` marker, if any. */
  poNumber: string | null;
};

export type StockOrderParseOk = {
  ok: true;
  lines: StockOrderLine[];
  poNumbers: string[];
};

export type StockOrderParseFail = {
  ok: false;
  error: string;
};

export type StockOrderParseResult = StockOrderParseOk | StockOrderParseFail;

const QTY_RE = /^(.*?)\s*[x×]\s*(\d+)\s*$/i;
const PO_RE = /^po\s*#?\s*([a-z0-9_-]+)\s*$/i;

function normalizeOcrText(raw: string): string {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .trim();
}

export function looksLikeStockOrderText(raw: string): boolean {
  const text = normalizeOcrText(raw);
  if (!text) return false;
  if (/^order\s*:/im.test(text)) return true;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const qtyLines = lines.filter((l) => QTY_RE.test(l)).length;
  const poLines = lines.filter((l) => PO_RE.test(l)).length;
  return qtyLines >= 2 || (qtyLines >= 1 && poLines >= 1);
}

/**
 * Assign each item line to the next `po#` below it (within the same blank-line block).
 * Items in a block with no PO keep poNumber = null.
 */
export function parseStockOrderText(raw: string): StockOrderParseResult {
  const text = normalizeOcrText(raw);
  if (!text) return { ok: false, error: "Empty order text" };

  const rawLines = text.split("\n").map((l) => l.trim());
  type Pending = { rawName: string; qty: number };
  const blocks: Array<{ items: Pending[]; po: string | null }> = [];
  let current: { items: Pending[]; po: string | null } = { items: [], po: null };

  const flush = () => {
    if (current.items.length || current.po) {
      blocks.push(current);
      current = { items: [], po: null };
    }
  };

  const ingestLine = (line: string) => {
    const po = line.match(PO_RE);
    if (po) {
      current.po = po[1]!;
      flush();
      return;
    }
    const qty = line.match(QTY_RE);
    if (qty) {
      const name = qty[1]!.trim();
      const n = Number(qty[2]);
      if (name && Number.isFinite(n) && n > 0) {
        current.items.push({ rawName: name, qty: n });
      }
    }
  };

  for (const original of rawLines) {
    if (!original) {
      flush();
      continue;
    }
    if (/^order\s*:/i.test(original)) {
      const rest = original.replace(/^order\s*:?\s*/i, "").trim();
      if (rest) ingestLine(rest);
      continue;
    }
    ingestLine(original);
  }
  flush();

  const lines: StockOrderLine[] = [];
  const poNumbers: string[] = [];
  for (const block of blocks) {
    if (block.po) poNumbers.push(block.po);
    for (const item of block.items) {
      lines.push({
        rawName: item.rawName,
        qty: item.qty,
        poNumber: block.po,
      });
    }
  }

  if (!lines.length) {
    return { ok: false, error: "No order lines found (expected Name xQty)" };
  }

  return { ok: true, lines, poNumbers: [...new Set(poNumbers)] };
}

export function stockOrderHelpText(): string {
  return [
    "Stock order photo → parse (dry run — nothing is written to Stock yet).",
    "",
    "Send a screenshot like:",
    "Order:",
    "End plates x1",
    "218*28 (red) x1",
    "po# sam82126",
    "",
    "Caption optional. You can also paste the same text.",
  ].join("\n");
}
