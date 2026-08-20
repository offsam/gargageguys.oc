import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeSheetStatus,
  STATUS_TO_JOB_STATUS,
  type SheetStatus,
} from "@/lib/leads/stage-sync";
import { parseLocalDateTime } from "@/lib/datetime";

const DEFAULT_TIME = "09:00";

const SYNCABLE: SheetStatus[] = [
  "Scheduled",
  "Tech confirmed",
  "En route",
  "On site",
  "Completed",
  "Cancelled",
];

export function normalizeSheetTime(raw: string | null | undefined): string {
  const v = String(raw || "").trim();
  if (!v) return "";

  const ampm = v.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const meridiem = ampm[3].toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  const hm = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  return "";
}

/** Build local datetime from Sheet Date + Time (default 09:00). */
export function sheetDateTimeToStart(
  date: string,
  time?: string | null,
): Date | null {
  const day = String(date || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const hhmm = normalizeSheetTime(time) || DEFAULT_TIME;
  return parseLocalDateTime(`${day}T${hhmm}`);
}

export function timeFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function shouldSyncSheetStatusToJob(status: string): boolean {
  const normalized = normalizeSheetStatus(status);
  return Boolean(normalized && SYNCABLE.includes(normalized));
}

/**
 * Upsert a Field calendar job from Sheet date/time/technician/status.
 * Without scheduled_start, Field never shows the row — this is the bridge.
 */
export async function syncSheetLeadToFieldJob(input: {
  leadId: string;
  date: string;
  time?: string;
  technicianId?: string | null;
  technicianName?: string;
  jobStatus: string;
  clientName?: string;
  clientAddress?: string;
  zip?: string | null;
  notes?: string | null;
  customerId?: string | null;
}): Promise<{ ok: true; jobId?: string } | { ok: false; error: string }> {
  const status = normalizeSheetStatus(input.jobStatus);
  if (!status || !SYNCABLE.includes(status)) {
    return { ok: true };
  }

  const start = sheetDateTimeToStart(input.date, input.time);
  if (!start) {
    return { ok: true };
  }

  const technicianId = input.technicianId || null;
  if (!technicianId && status !== "Cancelled") {
    // Past/completed Sheet rows still need a tech to appear on someone's Field calendar.
    return { ok: true };
  }

  const jobStatus = STATUS_TO_JOB_STATUS[status];
  if (!jobStatus) return { ok: true };

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const zip = input.zip || null;
  const title = `${input.clientName || "Job"}${zip ? ` — ${zip}` : ""}`.trim();
  const admin = getSupabaseAdmin();

  const { data: existingJobs, error: findErr } = await admin
    .from("jobs")
    .select("id, scheduled_start, technician_id")
    .eq("lead_id", input.leadId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);

  if (findErr) return { ok: false, error: findErr.message };

  const existing = existingJobs?.[0];
  const payload: Record<string, unknown> = {
    title,
    status: jobStatus,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    address: input.clientAddress || null,
    zip,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };
  if (technicianId) payload.technician_id = technicianId;

  if (existing?.id) {
    // Keep an already-precise Field time if Sheet Time is blank and dates match.
    const existingStart = existing.scheduled_start
      ? new Date(String(existing.scheduled_start))
      : null;
    const sheetHasExplicitTime = Boolean(normalizeSheetTime(input.time));
    if (
      !sheetHasExplicitTime &&
      existingStart &&
      !Number.isNaN(existingStart.getTime()) &&
      existingStart.toISOString().slice(0, 10) === start.toISOString().slice(0, 10)
    ) {
      payload.scheduled_start = existingStart.toISOString();
      payload.scheduled_end = new Date(
        existingStart.getTime() + 60 * 60 * 1000,
      ).toISOString();
    }

    const { error } = await admin.from("jobs").update(payload).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, jobId: existing.id };
  }

  if (jobStatus === "cancelled") {
    return { ok: true };
  }

  const { data: created, error } = await admin
    .from("jobs")
    .insert({
      ...payload,
      lead_id: input.leadId,
      customer_id: input.customerId || null,
      technician_id: technicianId,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message || "Could not create job" };
  }
  return { ok: true, jobId: created.id };
}

/** Backfill Field jobs for a technician from their Sheet leads that have a date. */
export async function ensureTechFieldJobsFromSheet(input: {
  technicianId: string;
  technicianName: string;
}): Promise<number> {
  const admin = getSupabaseAdmin();
  const techName = input.technicianName.trim().toLowerCase();

  const [{ data: leads, error }, { data: existingJobs }] = await Promise.all([
    admin
      .from("leads")
      .select(
        "id, name, address, zip, message, customer_id, assigned_to, stage, metadata, scheduled_at",
      )
      .order("updated_at", { ascending: false })
      .limit(400),
    admin
      .from("jobs")
      .select("id, lead_id, scheduled_start")
      .eq("technician_id", input.technicianId)
      .neq("status", "cancelled")
      .limit(800),
  ]);

  if (error || !leads?.length) return 0;

  const scheduledLeadIds = new Set(
    (existingJobs || [])
      .filter((j) => j.lead_id && j.scheduled_start)
      .map((j) => String(j.lead_id)),
  );

  let synced = 0;
  for (const lead of leads) {
    if (scheduledLeadIds.has(lead.id)) continue;

    const meta =
      lead.metadata && typeof lead.metadata === "object"
        ? (lead.metadata as Record<string, unknown>)
        : {};
    const metaTech = String(meta.technician || "").trim().toLowerCase();
    const mine =
      lead.assigned_to === input.technicianId ||
      (Boolean(techName) && metaTech === techName);
    if (!mine) continue;

    const status =
      normalizeSheetStatus(String(meta.jobStatus || "")) ||
      (lead.stage === "completed" || lead.stage === "won"
        ? "Completed"
        : lead.stage === "scheduled"
          ? "Scheduled"
          : lead.stage === "in_progress"
            ? "Tech confirmed"
            : lead.stage === "cancelled"
              ? "Cancelled"
              : null);
    if (!status || !SYNCABLE.includes(status)) continue;

    const date =
      String(meta.sheetDate || meta.date || "").trim().slice(0, 10) ||
      (lead.scheduled_at ? String(lead.scheduled_at).slice(0, 10) : "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const time =
      normalizeSheetTime(String(meta.sheetTime || meta.time || "")) ||
      timeFromIso(lead.scheduled_at ? String(lead.scheduled_at) : null);

    const result = await syncSheetLeadToFieldJob({
      leadId: lead.id,
      date,
      time,
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      jobStatus: status,
      clientName: lead.name || String(meta.clientName || ""),
      clientAddress:
        lead.address || String(meta.clientAddress || meta.address || ""),
      zip: lead.zip || String(meta.zip || "") || null,
      notes: lead.message || null,
      customerId: lead.customer_id || null,
    });
    if (result.ok && result.jobId) {
      synced += 1;
      scheduledLeadIds.add(lead.id);
    }
  }

  return synced;
}
