import { dayKeyInBusinessTz } from "@/lib/datetime";
import { effectiveTechPay } from "@/lib/sheet/money";

/** Inclusive YYYY-MM-DD range, matching Sheet period filters (Pacific). */
export type PayRange = { from: string; to: string };

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12) + days * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function weekdayUtc(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12)).getUTCDay();
}

export function pacificTodayYmd(now = new Date()): string {
  return dayKeyInBusinessTz(now);
}

/** Sheet "Неделя": Monday through today (Pacific). */
export function pacificWeekToDate(now = new Date()): PayRange {
  const today = pacificTodayYmd(now);
  const day = weekdayUtc(today);
  const diff = day === 0 ? 6 : day - 1;
  return { from: ymdAddDays(today, -diff), to: today };
}

/** Sheet "Месяц": 1st through today (Pacific). */
export function pacificMonthToDate(now = new Date()): PayRange {
  const today = pacificTodayYmd(now);
  return { from: `${today.slice(0, 8)}01`, to: today };
}

export function ymdInInclusiveRange(ymd: string, range: PayRange): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd >= range.from && ymd <= range.to;
}

function pick(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

/** Same date the Sheet row uses for period filters. */
export function sheetPayDateYmd(
  meta: Record<string, unknown>,
  createdAt?: string | null,
): string {
  const raw = pick(meta, "sheetDate", "date");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const mdy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    let year = Number(mdy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) return dayKeyInBusinessTz(d);
  }
  return "";
}

export function namesMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase().replace(/\s+/g, " ");
  const right = b.trim().toLowerCase().replace(/\s+/g, " ");
  return Boolean(left && right && left === right);
}

/**
 * Tech salary the Sheet shows and totals: stored amount, or 30% of job cost
 * when the row is Partner work and salary is blank.
 */
export function sheetTechPayAmount(
  meta: Record<string, unknown>,
  dealPrice?: string | number | null,
): number {
  const jobCost = pick(meta, "jobCost", "job_cost") || String(dealPrice ?? "");
  return effectiveTechPay({
    workSource: pick(meta, "workSource", "work_source"),
    partnerName: pick(meta, "partnerName", "partner_name", "partner"),
    jobCost,
    techSalary: pick(meta, "techSalary", "tech_salary"),
    partsCost: pick(meta, "partsCost", "parts_cost"),
  });
}
