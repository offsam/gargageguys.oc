export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseLocalDateTime(value: string): Date | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Next half-hour, or 9:00 on a future/past day. */
export function defaultScheduleStart(dayKey?: string): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const mins = now.getMinutes();
  if (mins === 0) {
    /* keep */
  } else if (mins <= 30) {
    now.setMinutes(30);
  } else {
    now.setHours(now.getHours() + 1, 0, 0, 0);
  }

  if (dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    const [y, m, d] = dayKey.split("-").map(Number);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const target = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), 0, 0);
    if (dayKey !== todayKey) target.setHours(9, 0, 0, 0);
    return toDatetimeLocalValue(target);
  }

  return toDatetimeLocalValue(now);
}
