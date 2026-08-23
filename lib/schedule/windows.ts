import { parseDayKey, type FieldJob } from "@/lib/field/days";
import {
  dayKeyInBusinessTz,
  parseLocalDateTime,
  timeHmInBusinessTz,
  toDatetimeLocalValue,
  zonedWallTimeToUtc,
} from "@/lib/datetime";

/** Fixed arrival windows. Slots are independent — overlapping clock ranges can both be booked. */
export type ScheduleWindow = {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
};

export const SCHEDULE_WINDOWS: ScheduleWindow[] = [
  { id: "8-10", label: "8–10", startHour: 8, endHour: 10 },
  { id: "9-11", label: "9–11", startHour: 9, endHour: 11 },
  { id: "10-12", label: "10–12", startHour: 10, endHour: 12 },
  { id: "11-1", label: "11–1", startHour: 11, endHour: 13 },
  { id: "12-2", label: "12–2", startHour: 12, endHour: 14 },
  { id: "1-3", label: "1–3", startHour: 13, endHour: 15 },
  { id: "2-4", label: "2–4", startHour: 14, endHour: 16 },
  { id: "3-5", label: "3–5", startHour: 15, endHour: 17 },
  { id: "4-6", label: "4–6", startHour: 16, endHour: 18 },
  { id: "5-7", label: "5–7", startHour: 17, endHour: 19 },
  { id: "6-8", label: "6–8", startHour: 18, endHour: 20 },
];

export type SlotStatus = {
  status: "free" | "busy";
  job?: FieldJob;
};

function atBusinessHour(dayKey: string, hour: number): Date | null {
  if (!parseDayKey(dayKey)) return null;
  const [y, m, d] = dayKey.split("-").map(Number);
  return zonedWallTimeToUtc(y, m, d, hour, 0, 0);
}

export function windowRange(dayKey: string, window: ScheduleWindow): {
  start: Date;
  end: Date;
  startLocal: string;
  endLocal: string;
} | null {
  const start = atBusinessHour(dayKey, window.startHour);
  const end = atBusinessHour(dayKey, window.endHour);
  if (!start || !end) return null;
  return {
    start,
    end,
    startLocal: toDatetimeLocalValue(start),
    endLocal: toDatetimeLocalValue(end),
  };
}

/** Job is booked into this window when its start matches the window start hour that day. */
export function jobMatchesWindow(
  job: Pick<FieldJob, "scheduled_start" | "status">,
  dayKey: string,
  window: ScheduleWindow,
): boolean {
  if (job.status === "cancelled" || !job.scheduled_start) return false;
  const start = new Date(job.scheduled_start);
  if (Number.isNaN(start.getTime())) return false;
  if (dayKeyInBusinessTz(start) !== dayKey) return false;
  const [hh, mm] = timeHmInBusinessTz(start).split(":").map(Number);
  return hh === window.startHour && mm === 0;
}

export function slotStatusForTech(
  jobs: FieldJob[],
  techId: string,
  dayKey: string,
  window: ScheduleWindow,
): SlotStatus {
  const job = jobs.find(
    (j) =>
      j.technician_id === techId &&
      jobMatchesWindow(j, dayKey, window),
  );
  if (!job) return { status: "free" };
  return { status: "busy", job };
}

export function firstFreeWindow(
  jobs: FieldJob[],
  techId: string,
  dayKey: string,
): ScheduleWindow | null {
  for (const window of SCHEDULE_WINDOWS) {
    if (slotStatusForTech(jobs, techId, dayKey, window).status === "free") return window;
  }
  return null;
}

export function findWindowById(id: string): ScheduleWindow | undefined {
  return SCHEDULE_WINDOWS.find((w) => w.id === id);
}

/** Sheet Time column value for a window (start clock, e.g. 09:00). */
export function sheetTimeForWindow(window: ScheduleWindow): string {
  return `${String(window.startHour).padStart(2, "0")}:00`;
}

/** Match a stored Sheet time (09:00 or label 9–11) to an arrival window. */
export function findWindowForSheetTime(raw: string): ScheduleWindow | null {
  const v = String(raw || "").trim();
  if (!v) return null;

  const compact = v.replace(/\s/g, "").replace(/–/g, "-").toLowerCase();
  const byLabel = SCHEDULE_WINDOWS.find(
    (w) =>
      w.id === compact ||
      w.label.replace(/\s/g, "").replace(/–/g, "-").toLowerCase() === compact,
  );
  if (byLabel) return byLabel;

  const hm = v.match(/^(\d{1,2}):(\d{2})/);
  if (hm) {
    const hour = Number(hm[1]);
    return SCHEDULE_WINDOWS.find((w) => w.startHour === hour) || null;
  }

  return null;
}

export function sheetTimeSelectOptions(): Array<{ value: string; label: string }> {
  return SCHEDULE_WINDOWS.map((w) => ({
    value: sheetTimeForWindow(w),
    label: w.label,
  }));
}

/** Helper for forms that still need a datetime-local string for a window. */
export function windowStartLocal(dayKey: string, window: ScheduleWindow): string | null {
  return windowRange(dayKey, window)?.startLocal || null;
}
