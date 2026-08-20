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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayKeyFromIso(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return toDayKey(d);
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
  if (!iso) return "Anytime";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function formatDayHeading(dayKey: string): string {
  const d = parseDayKey(dayKey);
  if (!d) return dayKey;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Sunday-start week containing dayKey. */
export function weekDayKeys(dayKey: string): string[] {
  const d = parseDayKey(dayKey) || startOfToday();
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return toDayKey(day);
  });
}

export function shiftDayKey(dayKey: string, delta: number): string {
  const d = parseDayKey(dayKey) || startOfToday();
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

export function formatWeekHeading(dayKey: string): string {
  const keys = weekDayKeys(dayKey);
  const start = parseDayKey(keys[0]);
  const end = parseDayKey(keys[6]);
  if (!start || !end) return dayKey;
  const sameMonth = start.getMonth() === end.getMonth();
  const left = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const right = end.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${left} – ${right}`;
}

export function formatMonthHeading(dayKey: string): string {
  const d = parseDayKey(dayKey) || startOfToday();
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
