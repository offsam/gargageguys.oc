import type { FieldJob } from "@/lib/field/days";
import { sheetDateTimeToStart } from "@/lib/sheet/sync-job-from-sheet";

const BOOKED_STATUSES = new Set([
  "Scheduled",
  "Tech confirmed",
  "En route",
  "On site",
  "Completed",
]);

export type SheetBusyRow = {
  id: string;
  date: string;
  time: string;
  technician: string;
  clientName?: string;
  jobStatus: string;
};

/**
 * Treat Sheet date/time/tech bookings as Field jobs for free/busy windows.
 * Keeps the Schedule modal aligned with Sheet even before a job row exists.
 */
export function busyJobsFromSheetRows(
  rows: SheetBusyRow[],
  technicians: Array<{ id: string; name: string }>,
  excludeRowId?: string,
): FieldJob[] {
  const techByName = new Map(
    technicians.map((t) => [t.name.trim().toLowerCase(), t.id]),
  );
  const out: FieldJob[] = [];

  for (const row of rows) {
    if (excludeRowId && (row.id === excludeRowId || `sheet-${row.id}` === excludeRowId)) {
      continue;
    }
    if (!BOOKED_STATUSES.has(row.jobStatus.trim())) continue;
    const techId = techByName.get(row.technician.trim().toLowerCase());
    if (!techId) continue;
    const start = sheetDateTimeToStart(row.date, row.time);
    if (!start) continue;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    out.push({
      id: `sheet-${row.id}`,
      title: row.clientName?.trim() || "Booked",
      status: "assigned",
      zip: null,
      address: null,
      notes: null,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      technician_id: techId,
    });
  }

  return out;
}

/** Prefer real Field jobs; fill gaps from Sheet-derived busy slots. */
export function mergeScheduleBusyJobs(
  fieldJobs: FieldJob[],
  sheetJobs: FieldJob[],
): FieldJob[] {
  const seen = new Set<string>();
  const out: FieldJob[] = [];

  for (const job of fieldJobs) {
    if (!job.scheduled_start || job.status === "cancelled") continue;
    const key = `${job.technician_id}|${job.scheduled_start}`;
    seen.add(key);
    out.push(job);
  }

  for (const job of sheetJobs) {
    if (!job.scheduled_start || job.status === "cancelled") continue;
    const key = `${job.technician_id}|${job.scheduled_start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }

  return out;
}
