import { dayKeyInBusinessTz, formatBusinessTime } from "@/lib/datetime";

export type FieldJob = {
  id: string;
  title: string;
  status: string;
  zip: string | null;
  address: string | null;
  notes: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  technician_id: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export function toDayKey(d: Date): string {
  return dayKeyInBusinessTz(d);
}

export function parseDayKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  // Noon UTC avoids DST edge when only the calendar day is needed.
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

export function startOfToday(): Date {
  const key = dayKeyInBusinessTz(new Date());
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function dayKeyFromIso(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dayKeyInBusinessTz(d);
}

/** Counts of jobs per YYYY-MM-DD (excludes cancelled). */
export function jobCountsByDay(jobs: FieldJob[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    if (job.status === "cancelled") continue;
    const key = dayKeyFromIso(job.scheduled_start);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function jobsForDay(jobs: FieldJob[], dayKey: string): FieldJob[] {
  return jobs
    .filter((j) => j.status !== "cancelled" && dayKeyFromIso(j.scheduled_start) === dayKey)
    .sort((a, b) => {
      const ta = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const tb = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return ta - tb;
    });
}

export function formatTime(iso: string | null): string {
  return formatBusinessTime(iso);
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function formatDayHeading(dayKey: string): string {
  const d = parseDayKey(dayKey);
  if (!d) return dayKey;
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Sunday-start week containing dayKey (Pacific calendar dates). */
export function weekDayKeys(dayKey: string): string[] {
  const d = parseDayKey(dayKey) || startOfToday();
  const dow = d.getUTCDay();
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const y = day.getUTCFullYear();
    const m = String(day.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(day.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  });
}

export function shiftDayKey(dayKey: string, delta: number): string {
  const d = parseDayKey(dayKey) || startOfToday();
  d.setUTCDate(d.getUTCDate() + delta);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatWeekHeading(dayKey: string): string {
  const keys = weekDayKeys(dayKey);
  const start = parseDayKey(keys[0]);
  const end = parseDayKey(keys[6]);
  if (!start || !end) return dayKey;
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const left = start.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
  const right = end.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${left} – ${right}`;
}

export function formatMonthHeading(dayKey: string): string {
  const d = parseDayKey(dayKey) || startOfToday();
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}
