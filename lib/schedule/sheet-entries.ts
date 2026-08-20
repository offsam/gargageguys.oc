import { sheetStatusFromLead, type SheetStatus } from "@/lib/leads/stage-sync";
import type { FieldJob } from "@/lib/field/days";
import {
  normalizeSheetTime,
  sheetDateTimeToStart,
} from "@/lib/sheet/sync-job-from-sheet";

export type CalendarSheetEntry = {
  id: string;
  date: string;
  title: string;
  technicianName: string;
  technicianId: string | null;
  status: SheetStatus;
  address: string;
  zip: string;
  jobNumber: string;
  service: string;
  jobId: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
};

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pick(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

/** Statuses that belong on the calendar (Sheet is source of truth). Waiting stays in the queue. */
const CALENDAR_STATUSES = new Set<SheetStatus>([
  "Scheduled",
  "Tech confirmed",
  "En route",
  "On site",
  "Completed",
  "Cancelled",
  "No-show",
]);

export function isCalendarSheetStatus(status: SheetStatus): boolean {
  return CALENDAR_STATUSES.has(status);
}

type LeadRow = {
  id: string;
  name?: string | null;
  phone?: string | null;
  zip?: string | null;
  address?: string | null;
  stage?: string | null;
  message?: string | null;
  deal_title?: string | null;
  deal_price?: string | null;
  lead_type?: string | null;
  metadata?: unknown;
  assigned_to?: string | null;
  created_at?: string;
};

type Tech = { id: string; name: string };

/**
 * Build calendar entries from Sheet leads.
 * Date = metadata.sheetDate (fallback created_at).
 * Time = linked job, else metadata.sheetTime.
 */
export function calendarEntriesFromSheet(input: {
  leads: LeadRow[];
  jobs: Array<
    FieldJob & {
      lead_id?: string | null;
      job_number?: number | string | null;
    }
  >;
  technicians: Tech[];
}): CalendarSheetEntry[] {
  const techById = new Map(input.technicians.map((t) => [t.id, t.name]));
  const techByName = new Map(
    input.technicians.map((t) => [t.name.trim().toLowerCase(), t.id]),
  );

  const jobByLead = new Map<
    string,
    FieldJob & { lead_id?: string | null; job_number?: number | string | null }
  >();
  for (const job of input.jobs) {
    const leadId = String(job.lead_id || "");
    if (!leadId || job.status === "cancelled") continue;
    const prev = jobByLead.get(leadId);
    if (!prev) {
      jobByLead.set(leadId, job);
      continue;
    }
    const prevT = prev.scheduled_start ? new Date(prev.scheduled_start).getTime() : 0;
    const nextT = job.scheduled_start ? new Date(job.scheduled_start).getTime() : 0;
    if (nextT >= prevT) jobByLead.set(leadId, job);
  }

  const out: CalendarSheetEntry[] = [];
  for (const lead of input.leads) {
    const meta = asMeta(lead.metadata);
    const status = sheetStatusFromLead({ stage: lead.stage, metadata: lead.metadata });
    if (!isCalendarSheetStatus(status)) continue;

    const date =
      pick(meta, "sheetDate", "date") ||
      (lead.created_at ? String(lead.created_at).slice(0, 10) : "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const technicianName =
      pick(meta, "technician", "tech_name") ||
      (lead.assigned_to ? techById.get(lead.assigned_to) || "" : "");
    const technicianId =
      (lead.assigned_to && techById.has(lead.assigned_to) ? lead.assigned_to : null) ||
      (technicianName ? techByName.get(technicianName.trim().toLowerCase()) || null : null);

    const linked = jobByLead.get(lead.id);
    const title =
      lead.name ||
      pick(meta, "clientName", "client_name") ||
      linked?.title ||
      "Client";

    const sheetTime = normalizeSheetTime(pick(meta, "sheetTime", "time"));
    const fromSheet =
      !linked?.scheduled_start && sheetTime
        ? sheetDateTimeToStart(date, sheetTime)
        : null;

    out.push({
      id: lead.id,
      date,
      title,
      technicianName,
      technicianId,
      status,
      address:
        (typeof lead.address === "string" ? lead.address : "") ||
        pick(meta, "clientAddress", "address"),
      zip: lead.zip || pick(meta, "zip") || "",
      jobNumber: pick(meta, "jobNumber", "job_number"),
      service: pick(meta, "service"),
      jobId: linked?.id || null,
      scheduled_start:
        linked?.scheduled_start || (fromSheet ? fromSheet.toISOString() : null),
      scheduled_end: linked?.scheduled_end || null,
    });
  }

  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const ta = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
    const tb = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
    return ta - tb || a.title.localeCompare(b.title);
  });
}

export function entriesForDay(entries: CalendarSheetEntry[], dayKey: string) {
  return entries.filter((e) => e.date === dayKey);
}

/** Match arrival window by start hour (Sheet times may not be :00). */
export function entryMatchesWindow(
  entry: CalendarSheetEntry,
  windowStartHour: number,
): boolean {
  if (!entry.scheduled_start) return false;
  const start = new Date(entry.scheduled_start);
  if (Number.isNaN(start.getTime())) return false;
  return start.getHours() === windowStartHour;
}

export function entriesForTechWindow(
  entries: CalendarSheetEntry[],
  dayKey: string,
  techId: string | null,
  windowStartHour: number,
): CalendarSheetEntry[] {
  return entriesForDay(entries, dayKey).filter((e) => {
    if (techId) {
      if (e.technicianId !== techId) return false;
    } else if (e.technicianId) {
      return false;
    }
    return entryMatchesWindow(e, windowStartHour);
  });
}

export function untimedEntriesForDay(
  entries: CalendarSheetEntry[],
  dayKey: string,
  techId?: string | "all",
): CalendarSheetEntry[] {
  return entriesForDay(entries, dayKey).filter((e) => {
    if (techId && techId !== "all" && e.technicianId !== techId) return false;
    return !e.scheduled_start;
  });
}
