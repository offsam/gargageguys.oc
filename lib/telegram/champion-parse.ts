export type ChampionTelegramParsed = {
  ok: true;
  clientName: string;
  clientAddress: string;
  zip: string;
  /** Sheet clock `HH:mm`, empty if not found. */
  sheetTime: string;
  /** Original time line, e.g. `130pm or after`. */
  timeRaw: string;
  description: string;
};

export type ChampionTelegramParseFail = {
  ok: false;
  error: string;
};

export type ChampionTelegramParseResult = ChampionTelegramParsed | ChampionTelegramParseFail;

const STREET_HINT =
  /\b(st|street|ave|avenue|dr|drive|ln|lane|rd|road|way|blvd|boulevard|ct|court|cir|circle|pl|place|hwy|highway|pkwy|parkway)\b/i;

function extractZip(text: string): string {
  const ca = text.match(/\b(?:CA|California)\s+(\d{5})(?:-\d{4})?\b/i);
  if (ca) return ca[1];
  const trailing = text.match(/,\s*[A-Za-z .'-]+,?\s*[A-Z]{2}\s+(\d{5})(?:-\d{4})?\b/);
  if (trailing) return trailing[1];
  const all = [...text.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].map((m) => m[1]);
  // Prefer a ZIP-looking code near the end (not a leading street number).
  return all.length ? all[all.length - 1]! : "";
}

function looksLikeAddress(line: string): boolean {
  const v = line.trim();
  if (!v || v.length < 8) return false;
  if (!/\d/.test(v)) return false;
  if (/\bCA\b|\bCalifornia\b/i.test(v) && extractZip(v)) return true;
  if (/^\d+\s+\S+/.test(v) && STREET_HINT.test(v)) return true;
  return false;
}

/**
 * Champion often writes `130pm` (no colon) or `1:30pm`.
 * Returns `HH:mm` or "".
 */
export function parseChampionClock(raw: string): string {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "";

  const withColon = v.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (withColon) {
    let h = Number(withColon[1]);
    const m = Number(withColon[2]);
    const mer = withColon[3].toLowerCase();
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  const compact = v.match(/\b(\d{3,4})\s*(am|pm)\b/i);
  if (compact) {
    const digits = compact[1];
    const mer = compact[2].toLowerCase();
    let h: number;
    let m: number;
    if (digits.length === 3) {
      h = Number(digits.slice(0, 1));
      m = Number(digits.slice(1));
    } else {
      h = Number(digits.slice(0, 2));
      m = Number(digits.slice(2));
    }
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  const hourOnly = v.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (hourOnly) {
    let h = Number(hourOnly[1]);
    const mer = hourOnly[2].toLowerCase();
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, "0")}:00`;
    }
  }

  return "";
}

function looksLikeTimeLine(line: string): boolean {
  const v = line.trim();
  if (!v) return false;
  if (parseChampionClock(v)) return true;
  return /\b\d{1,2}:?\d{0,2}\s*(am|pm)\b/i.test(v);
}

function looksLikeName(line: string): boolean {
  const v = line.trim();
  if (!v || v.length > 60) return false;
  if (looksLikeAddress(v) || looksLikeTimeLine(v)) return false;
  if (/^[\W\d_*#]+$/i.test(v)) return false;
  // Prefer a personal name: letters, spaces, hyphen/apostrophe
  if (!/^[A-Za-z][A-Za-z .'-]{0,58}$/.test(v)) return false;
  return true;
}

function normalizeBlocks(text: string): string[] {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
}

function flattenLines(text: string): string[] {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Parse Champion-style Telegram job text:
 *
 * ```
 * 130pm or after
 *
 * 402 Beryl Cove Way, Seal Beach, CA 90740
 *
 * Christina
 *
 * ** Call before
 * ```
 */
export function parseChampionTelegramMessage(text: string): ChampionTelegramParseResult {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "Empty message" };

  const blocks = normalizeBlocks(raw);
  const lines = flattenLines(raw);

  let timeRaw = "";
  let sheetTime = "";
  let clientAddress = "";
  let clientName = "";
  const noteParts: string[] = [];

  // Prefer blank-line blocks when the message is structured that way.
  if (blocks.length >= 2) {
    for (const block of blocks) {
      const firstLine = flattenLines(block)[0] || block;
      if (!timeRaw && looksLikeTimeLine(firstLine)) {
        timeRaw = block.replace(/\s+/g, " ").trim();
        sheetTime = parseChampionClock(timeRaw);
        continue;
      }
      if (!clientAddress && looksLikeAddress(block)) {
        clientAddress = block.replace(/\s+/g, " ").trim();
        continue;
      }
      if (!clientName && looksLikeName(firstLine) && flattenLines(block).length === 1) {
        clientName = firstLine.trim();
        continue;
      }
      noteParts.push(block.trim());
    }
  }

  // Fallback: classify line-by-line if blocks did not yield address+name.
  if (!clientAddress || !clientName) {
    timeRaw = "";
    sheetTime = "";
    clientAddress = "";
    clientName = "";
    noteParts.length = 0;

    for (const line of lines) {
      if (!timeRaw && looksLikeTimeLine(line)) {
        timeRaw = line;
        sheetTime = parseChampionClock(line);
        continue;
      }
      if (!clientAddress && looksLikeAddress(line)) {
        clientAddress = line;
        continue;
      }
      if (!clientName && looksLikeName(line)) {
        clientName = line;
        continue;
      }
      noteParts.push(line);
    }
  }

  if (!clientAddress) {
    return { ok: false, error: "No address found — need street, city, CA, ZIP" };
  }
  if (!clientName) {
    return { ok: false, error: "No client name found" };
  }

  const zip = extractZip(clientAddress);
  const timeExtra = timeRaw
    .replace(/\b\d{1,2}:?\d{0,2}\s*(am|pm)\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const description = [...(timeExtra ? [timeExtra] : []), ...noteParts]
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n");

  return {
    ok: true,
    clientName,
    clientAddress,
    zip,
    sheetTime,
    timeRaw,
    description,
  };
}

export function championTelegramHelpText(): string {
  return [
    "Send a Champion job like this:",
    "",
    "130pm or after",
    "",
    "402 Beryl Cove Way, Seal Beach, CA 90740",
    "",
    "Christina",
    "",
    "** Call before",
    "",
    "It will be added to Sheet as Partner → Champion.",
  ].join("\n");
}
