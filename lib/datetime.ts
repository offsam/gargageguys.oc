/** Garage Guys business timezone — all schedule wall times are Pacific. */
export const BUSINESS_TZ = "America/Los_Angeles";

type TzParts = {
  y: number;
  mo: number;
  d: number;
  hh: number;
  mm: number;
  ss: number;
};

function tzParts(date: Date, timeZone: string = BUSINESS_TZ): TzParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value || "0");
  return {
    y: num("year"),
    mo: num("month"),
    d: num("day"),
    hh: num("hour"),
    mm: num("minute"),
    ss: num("second"),
  };
}

/**
 * Convert a civil wall time in `timeZone` to a UTC Date.
 * Avoids Node/Vercel treating `YYYY-MM-DDTHH:mm` as server-local (UTC).
 */
export function zonedWallTimeToUtc(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  ss = 0,
  timeZone: string = BUSINESS_TZ,
): Date {
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss);
  for (let i = 0; i < 3; i++) {
    const seen = tzParts(new Date(utcMs), timeZone);
    const asIfUtc = Date.UTC(seen.y, seen.mo - 1, seen.d, seen.hh, seen.mm, seen.ss);
    const wanted = Date.UTC(y, mo - 1, d, hh, mm, ss);
    const diff = wanted - asIfUtc;
    utcMs += diff;
    if (diff === 0) break;
  }
  return new Date(utcMs);
}

/** Format a Date as `YYYY-MM-DDTHH:mm` in business (Pacific) time for datetime-local. */
export function toDatetimeLocalValue(d: Date): string {
  const p = tzParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`;
}

/**
 * Parse datetime-local / sheet values as Pacific wall time.
 * `2026-08-20T15:00` → 3:00 PM in LA, not 3:00 PM UTC on Vercel.
 */
export function parseLocalDateTime(value: string): Date | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  if (/Z$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!m) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return zonedWallTimeToUtc(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4] || 0),
    Number(m[5] || 0),
    Number(m[6] || 0),
  );
}

export function dayKeyInBusinessTz(date: Date): string {
  const p = tzParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

export function timeHmInBusinessTz(date: Date): string {
  const p = tzParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

export function formatBusinessTime(iso: string | null | undefined): string {
  if (!iso) return "Anytime";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Anytime";
  return d.toLocaleTimeString("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Next half-hour in Pacific, or 9:00 on a future/past day. */
export function defaultScheduleStart(dayKey?: string): string {
  const now = new Date();
  const p = tzParts(now);
  let hh = p.hh;
  let mm = p.mm;
  if (mm === 0) {
    /* keep */
  } else if (mm <= 30) {
    mm = 30;
  } else {
    hh = (hh + 1) % 24;
    mm = 0;
  }

  if (dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    const todayKey = dayKeyInBusinessTz(now);
    if (dayKey !== todayKey) {
      return `${dayKey}T09:00`;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${dayKey}T${pad(hh)}:${pad(mm)}`;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dayKeyInBusinessTz(now)}T${pad(hh)}:${pad(mm)}`;
}
