import {
  findWindowForSheetTime,
  nextArrivalWindow,
  sheetTimeForWindow,
} from "@/lib/schedule/windows";
import { dayKeyInBusinessTz } from "@/lib/datetime";

export type ChampionTelegramParsed = {
  ok: true;
  clientName: string;
  clientAddress: string;
  zip: string;
  /** Sheet clock `HH:mm` (window start). */
  sheetTime: string;
  /** Original time fragment, e.g. `130pm or after` / `8-9am`. */
  timeRaw: string;
  /** True when time was filled from next arrival window rules. */
  timeAuto: boolean;
  windowLabel: string;
  description: string;
  jobCostHint: string;
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
  return all.length ? all[all.length - 1]! : "";
}

function looksLikeAddress(line: string): boolean {
  const v = stripJobIndex(line).trim();
  if (!v || v.length < 8) return false;
  if (!/\d/.test(v)) return false;
  if (/\bCA\b|\bCalifornia\b/i.test(v) && extractZip(v)) return true;
  if (/^\d+\s+\S+/.test(v) && STREET_HINT.test(v)) return true;
  return false;
}

function stripJobIndex(line: string): string {
  return String(line || "").replace(/^\d+\.\s*/, "").trim();
}

function extractJobCostHint(text: string): string {
  const range = text.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*[-–]\s*\$?\s*([\d,]+(?:\.\d{2})?)/);
  if (range) return range[0].replace(/\s+/g, "");
  const single = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  return single ? single[0].replace(/\s+/g, "") : "";
}

/**
 * Champion often writes `130pm`, `Around 9am`, `8-9am`, or window labels `1-3`.
 * Returns `HH:mm` (window start when a range matches) or "".
 */
export function parseChampionClock(raw: string): string {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^around\s+/i, "");
  if (!v || /\$/.test(v)) return "";

  // Explicit schedule window ids / labels: 8-10, 1–3, 8-9am
  const range = v.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );
  if (range) {
    let startH = Number(range[1]);
    const startMer = (range[3] || range[6] || "").toLowerCase();
    const endMer = (range[6] || range[3] || "").toLowerCase();
    const mer = startMer || endMer;
    if (mer === "pm" && startH < 12) startH += 12;
    if (mer === "am" && startH === 12) startH = 0;
    // Bare "8-9" without meridiem: morning hours
    if (!mer && startH >= 1 && startH <= 7) {
      /* keep as-is; windows use 8–20 */
    }
    const byStart =
      findWindowForSheetTime(`${String(startH).padStart(2, "0")}:00`) ||
      findWindowForSheetTime(v.replace(/–/g, "-").replace(/\s+/g, ""));
    if (byStart) return sheetTimeForWindow(byStart);
    return `${String(startH).padStart(2, "0")}:00`;
  }

  const withColon = v.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (withColon) {
    let h = Number(withColon[1]);
    const m = Number(withColon[2]);
    const meridiem = withColon[3].toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return snapClockToWindowStart(h, m);
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
      return snapClockToWindowStart(h, m);
    }
  }

  const hourOnly = v.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (hourOnly) {
    let h = Number(hourOnly[1]);
    const mer = hourOnly[2].toLowerCase();
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23) {
      return snapClockToWindowStart(h, 0);
    }
  }

  const byLabel = findWindowForSheetTime(v.replace(/–/g, "-"));
  if (byLabel) return sheetTimeForWindow(byLabel);

  return "";
}

/** Prefer a schedule window start for Sheet Time (hour-only). Keep :30 etc. as-is. */
function snapClockToWindowStart(hour: number, minute: number): string {
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  if (minute !== 0) return hhmm;
  const atHour = findWindowForSheetTime(hhmm);
  if (atHour) return sheetTimeForWindow(atHour);
  return hhmm;
}

function looksLikeTimeLine(line: string): boolean {
  const v = stripJobIndex(line).trim();
  if (!v || /\$/.test(v)) return false;
  if (parseChampionClock(v)) return true;
  return /^(around\s+)?\d{1,2}(:\d{2})?\s*(am|pm)?(\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)?)?(\s+or\s+after)?$/i.test(
    v,
  );
}

function looksLikeName(line: string): boolean {
  const v = stripJobIndex(line).trim();
  if (!v || v.length > 60) return false;
  if (looksLikeAddress(v) || looksLikeTimeLine(v)) return false;
  if (/^[\W\d_*#$]+/i.test(v) && !/^[A-Za-z]/.test(v)) return false;
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

function classifyJobText(rawText: string): {
  timeRaw: string;
  sheetTime: string;
  clientAddress: string;
  clientName: string;
  noteParts: string[];
} {
  const raw = stripJobIndex(rawText).trim();
  const blocks = normalizeBlocks(raw);
  const lines = flattenLines(raw).map(stripJobIndex);

  let timeRaw = "";
  let sheetTime = "";
  let clientAddress = "";
  let clientName = "";
  const noteParts: string[] = [];

  const takeTime = (s: string) => {
    if (timeRaw) return false;
    if (!looksLikeTimeLine(s)) return false;
    timeRaw = s.replace(/\s+/g, " ").trim();
    sheetTime = parseChampionClock(timeRaw);
    return true;
  };

  if (blocks.length >= 2) {
    for (const block of blocks) {
      const blockLines = flattenLines(block).map(stripJobIndex);
      const firstLine = blockLines[0] || block;
      const oneLine = blockLines.length === 1;
      if (takeTime(oneLine ? firstLine : block.replace(/\s+/g, " ").trim())) continue;
      if (!clientAddress && looksLikeAddress(block)) {
        clientAddress = block.replace(/\s+/g, " ").trim();
        clientAddress = stripJobIndex(clientAddress);
        continue;
      }
      if (!clientName && looksLikeName(firstLine) && oneLine) {
        clientName = firstLine.trim();
        continue;
      }
      noteParts.push(block.trim());
    }
  }

  if (!clientAddress || !clientName) {
    timeRaw = "";
    sheetTime = "";
    clientAddress = "";
    clientName = "";
    noteParts.length = 0;
    for (const line of lines) {
      if (takeTime(line)) continue;
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

  // Time may sit in notes (e.g. last line `8-9am`) when address-first.
  if (!timeRaw) {
    const kept: string[] = [];
    for (const part of noteParts) {
      const first = flattenLines(part)[0] || part;
      if (!timeRaw && looksLikeTimeLine(first) && flattenLines(part).length === 1) {
        timeRaw = first;
        sheetTime = parseChampionClock(first);
        continue;
      }
      kept.push(part);
    }
    noteParts.length = 0;
    noteParts.push(...kept);
  }

  return { timeRaw, sheetTime, clientAddress, clientName, noteParts };
}

/**
 * Apply default arrival window when Champion omitted a time.
 * Rule: next window starting ≥ 60 minutes from `now` (e.g. noon → 1–3).
 */
export function applyChampionScheduleDefaults(
  parsed: Omit<ChampionTelegramParsed, "ok">,
  now: Date = new Date(),
): Omit<ChampionTelegramParsed, "ok"> {
  if (parsed.sheetTime) {
    const window = findWindowForSheetTime(parsed.sheetTime);
    return {
      ...parsed,
      timeAuto: false,
      windowLabel: window?.label || parsed.timeRaw || parsed.sheetTime,
    };
  }
  const next = nextArrivalWindow(now, 60);
  return {
    ...parsed,
    sheetTime: next.sheetTime,
    timeRaw: parsed.timeRaw || `${next.window.label} (auto)`,
    timeAuto: true,
    windowLabel: next.window.label,
    // sheet date may roll to tomorrow — caller reads dayKey separately via nextArrivalWindow
  };
}

export function championSheetDateForParse(
  parsed: { timeAuto: boolean },
  now: Date = new Date(),
): string {
  if (!parsed.timeAuto) return dayKeyInBusinessTz(now);
  return nextArrivalWindow(now, 60).dayKey;
}

/** Split a Telegram paste that contains `1. … 2. …` into separate jobs. */
export function splitChampionTelegramJobs(text: string): string[] {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const parts = raw.split(/(?=^\d+\.\s+)/m).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^\d+\.\s+/.test(p))) {
    return parts;
  }
  return [raw];
}

/**
 * Parse one Champion-style job (time optional; address + name required).
 */
export function parseChampionTelegramMessage(
  text: string,
  now: Date = new Date(),
): ChampionTelegramParseResult {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "Empty message" };

  const { timeRaw, sheetTime, clientAddress, clientName, noteParts } = classifyJobText(raw);

  if (!clientAddress) {
    return { ok: false, error: "No address found — need street, city, CA, ZIP" };
  }
  if (!clientName) {
    return { ok: false, error: "No client name found" };
  }

  const zip = extractZip(clientAddress);
  const jobCostHint = extractJobCostHint([timeRaw, ...noteParts].join("\n"));
  const timeExtra = timeRaw
    .replace(/around\s+/i, "")
    .replace(/\b\d{1,2}:?\d{0,2}\s*(am|pm)?(\s*[-–]\s*\d{1,2}:?\d{0,2}\s*(am|pm)?)?\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const description = [...(timeExtra ? [timeExtra] : []), ...noteParts]
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n");

  const base = applyChampionScheduleDefaults(
    {
      clientName,
      clientAddress,
      zip,
      sheetTime,
      timeRaw,
      timeAuto: false,
      windowLabel: "",
      description,
      jobCostHint,
    },
    now,
  );

  return { ok: true, ...base };
}

export function parseChampionTelegramMessages(
  text: string,
  now: Date = new Date(),
): ChampionTelegramParseResult[] {
  return splitChampionTelegramJobs(text).map((chunk) => parseChampionTelegramMessage(chunk, now));
}

export function championTelegramHelpText(): string {
  return [
    "Send Champion job(s). Assigned to Sam. Missing time → next window (≥1h, e.g. noon → 1–3).",
    "",
    "130pm or after",
    "",
    "402 Beryl Cove Way, Seal Beach, CA 90740",
    "",
    "Christina",
    "",
    "** Call before",
  ].join("\n");
}