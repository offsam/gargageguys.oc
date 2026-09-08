import { loadStockState } from "@/lib/stock/store";
import { SEED_STOCK_ITEMS } from "@/lib/stock/seed-catalog";
import {
  looksLikeStockOrderText,
  parseStockOrderText,
  type StockOrderParseResult,
} from "@/lib/telegram/stock-order-parse";
import { matchStockOrderLines, type MatchedStockOrderLine } from "@/lib/telegram/stock-order-match";
import {
  downloadTelegramFile,
  ocrStockOrderImage,
} from "@/lib/telegram/stock-order-ocr";

export type StockOrderDryRunResult = {
  ok: boolean;
  applied: false;
  source: "photo" | "text";
  ocrProvider?: string;
  rawText: string;
  parse: StockOrderParseResult;
  matched: MatchedStockOrderLine[];
  error?: string;
};

/**
 * Dry-run Stock order pipe: OCR (optional) → parse → catalog match.
 * Does NOT call receiveSupplier / write Stock.
 */
export async function dryRunStockOrderFromText(rawText: string): Promise<StockOrderDryRunResult> {
  const parse = parseStockOrderText(rawText);
  if (!parse.ok) {
    return {
      ok: false,
      applied: false,
      source: "text",
      rawText,
      parse,
      matched: [],
      error: parse.error,
    };
  }

  let catalog = SEED_STOCK_ITEMS.map((i) => ({ sku: i.sku, name: i.name }));
  try {
    const state = await loadStockState();
    if (state.items.length) {
      catalog = state.items.map((i) => ({ sku: i.sku, name: i.name }));
    }
  } catch {
    /* seed fallback */
  }

  const matched = matchStockOrderLines(parse.lines, catalog);
  return {
    ok: true,
    applied: false,
    source: "text",
    rawText,
    parse,
    matched,
  };
}

export async function dryRunStockOrderFromTelegramPhoto(input: {
  fileId: string;
  caption?: string;
}): Promise<StockOrderDryRunResult> {
  const caption = String(input.caption || "").trim();
  try {
    const file = await downloadTelegramFile(input.fileId);
    const ocr = await ocrStockOrderImage(file.bytes, file.mimeType);
    const rawText = [ocr.text, caption].filter(Boolean).join("\n\n");
    const result = await dryRunStockOrderFromText(rawText);
    return {
      ...result,
      source: "photo",
      ocrProvider: ocr.provider,
      rawText,
    };
  } catch (err) {
    // If OCR fails but caption looks like an order, still parse caption.
    if (caption && looksLikeStockOrderText(caption)) {
      const result = await dryRunStockOrderFromText(caption);
      return {
        ...result,
        source: "photo",
        error: err instanceof Error ? err.message : "OCR failed",
      };
    }
    return {
      ok: false,
      applied: false,
      source: "photo",
      rawText: caption,
      parse: { ok: false, error: "OCR failed" },
      matched: [],
      error: err instanceof Error ? err.message : "OCR failed",
    };
  }
}

export function formatStockOrderDryRunReply(result: StockOrderDryRunResult): string {
  const lines: string[] = [
    `<b>Stock order (dry run)</b>`,
    `Nothing written to Stock yet.`,
  ];
  if (result.ocrProvider) lines.push(`OCR: ${result.ocrProvider}`);
  if (result.error && result.ok) lines.push(`Note: ${result.error}`);
  if (!result.ok) {
    lines.push("", `Error: ${result.error || "parse failed"}`);
    return lines.join("\n");
  }

  const matched = result.matched.filter((m) => m.status === "matched").length;
  const partial = result.matched.filter((m) => m.status === "partial").length;
  const unmatched = result.matched.filter((m) => m.status === "unmatched").length;
  lines.push("", `Lines: ${result.matched.length} · matched ${matched} · partial ${partial} · unmatched ${unmatched}`);

  for (const row of result.matched) {
    const po = row.poNumber ? ` · po# ${row.poNumber}` : "";
    if (row.matches.length) {
      for (const hit of row.matches) {
        lines.push(`• +${hit.qty} <code>${escape(hit.sku)}</code> ${escape(hit.name)}${escape(po)}`);
      }
      if (row.status !== "matched") {
        lines.push(`  ⚠ from “${escape(row.rawName)}” (${row.status})`);
      }
    } else {
      lines.push(`• ? ${escape(row.rawName)} x${row.qty}${escape(po)} — no catalog match`);
    }
  }

  lines.push("", "Next step later: confirm → receive into warehouse.");
  return lines.join("\n");
}

function escape(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
