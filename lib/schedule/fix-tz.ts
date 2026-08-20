import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  dayKeyInBusinessTz,
  parseLocalDateTime,
  timeHmInBusinessTz,
} from "@/lib/datetime";
import { normalizeSheetTime, sheetDateTimeToStart } from "@/lib/sheet/sync-job-from-sheet";
import { formatBusinessTime } from "@/lib/datetime";

type FixRow = {
  jobId: string;
  leadId: string | null;
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  source: "sheetTime" | "utc-as-pacific";
};

/**
 * Jobs saved before Pacific parsing treated datetime-local as UTC.
 * Rebuild scheduled_start/end from sheetDate+sheetTime when they disagree,
 * else reinterpret the stored UTC clock as Pacific wall time (one-shot).
 */
export async function fixMisalignedScheduleTimes(): Promise<{
  ok: true;
  scanned: number;
  fixed: number;
  samples: FixRow[];
}> {
  const admin = getSupabaseAdmin();
  const { data: jobs, error } = await admin
    .from("jobs")
    .select("id, lead_id, scheduled_start, scheduled_end, status, updated_at")
    .not("scheduled_start", "is", null)
    .neq("status", "cancelled")
    .order("scheduled_start", { ascending: false })
    .limit(800);
  if (error) throw error;

  const leadIds = [...new Set((jobs || []).map((j) => j.lead_id).filter(Boolean))] as string[];
  const metaByLead = new Map<string, Record<string, unknown>>();
  if (leadIds.length) {
    const { data: leads } = await admin
      .from("leads")
      .select("id, metadata")
      .in("id", leadIds);
    for (const lead of leads || []) {
      const meta =
        lead.metadata && typeof lead.metadata === "object"
          ? (lead.metadata as Record<string, unknown>)
          : {};
      metaByLead.set(lead.id, meta);
    }
  }

  const samples: FixRow[] = [];
  let fixed = 0;

  for (const job of jobs || []) {
    const startIso = String(job.scheduled_start || "");
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) continue;

    const endIso = job.scheduled_end ? String(job.scheduled_end) : "";
    const end = endIso ? new Date(endIso) : null;
    const durationMs =
      end && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()
        ? end.getTime() - start.getTime()
        : 2 * 60 * 60 * 1000;

    const meta = job.lead_id ? metaByLead.get(String(job.lead_id)) || {} : {};
    const sheetDate =
      (typeof meta.sheetDate === "string" && meta.sheetDate.slice(0, 10)) ||
      dayKeyInBusinessTz(start);
    const sheetTime = normalizeSheetTime(
      typeof meta.sheetTime === "string" ? meta.sheetTime : "",
    );

    let nextStart: Date | null = null;
    let source: FixRow["source"] | null = null;

    if (sheetTime && /^\d{4}-\d{2}-\d{2}$/.test(sheetDate)) {
      const displayed = timeHmInBusinessTz(start);
      if (displayed !== sheetTime) {
        nextStart = sheetDateTimeToStart(sheetDate, sheetTime);
        source = "sheetTime";
      }
    }

    // Pre-fix rows with no sheetTime: UTC clock was the intended Pacific wall time.
    if (!nextStart) {
      const CUTOFF = Date.parse("2026-08-20T20:30:00.000Z");
      const touched = job.updated_at ? Date.parse(String(job.updated_at)) : NaN;
      if (Number.isFinite(touched) && touched < CUTOFF) {
        const y = start.getUTCFullYear();
        const mo = start.getUTCMonth() + 1;
        const d = start.getUTCDate();
        const hh = start.getUTCHours();
        const mm = start.getUTCMinutes();
        const reinterpreted = parseLocalDateTime(
          `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        );
        if (reinterpreted && reinterpreted.toISOString() !== startIso) {
          nextStart = reinterpreted;
          source = "utc-as-pacific";
        }
      }
    }

    if (!nextStart || !source) continue;
    const nextIso = nextStart.toISOString();
    if (nextIso === startIso) continue;

    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const { error: upErr } = await admin
      .from("jobs")
      .update({
        scheduled_start: nextIso,
        scheduled_end: nextEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (upErr) continue;

    if (job.lead_id) {
      const leadMeta = metaByLead.get(String(job.lead_id)) || {};
      const nextMeta = {
        ...leadMeta,
        sheetDate: dayKeyInBusinessTz(nextStart),
        sheetTime: timeHmInBusinessTz(nextStart),
      };
      await admin
        .from("leads")
        .update({
          metadata: nextMeta,
          scheduled_at: nextIso,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.lead_id);
      metaByLead.set(String(job.lead_id), nextMeta);
    }

    fixed += 1;
    if (samples.length < 12) {
      samples.push({
        jobId: job.id,
        leadId: job.lead_id ? String(job.lead_id) : null,
        before: startIso,
        after: nextIso,
        beforeLabel: formatBusinessTime(startIso),
        afterLabel: formatBusinessTime(nextIso),
        source,
      });
    }
  }

  return { ok: true, scanned: (jobs || []).length, fixed, samples };
}
