import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  encodeJobNumber,
  formatJobNumber,
  isLegacyJobNumber,
  yymmFromDate,
} from "@/lib/field/job-number";

async function peekNextMonthlyNumber(at: Date): Promise<number> {
  const admin = getSupabaseAdmin();
  const yymm = yymmFromDate(at);
  const lo = encodeJobNumber(yymm, 0);
  const hi = encodeJobNumber(yymm, 999);
  const { data } = await admin
    .from("jobs")
    .select("job_number")
    .gte("job_number", lo + 1)
    .lte("job_number", hi)
    .order("job_number", { ascending: false })
    .limit(1);
  const top = data?.[0]?.job_number != null ? Number(data[0].job_number) : null;
  const seq = top && !isLegacyJobNumber(top) ? (top % 1000) + 1 : 1;
  if (seq > 999) throw new Error(`Job number overflow for ${yymm}`);
  return encodeJobNumber(yymm, seq);
}

/** Assign/replace job_number using GGYY-MM### encoding (LA month). */
export async function allocateMonthlyJobNumber(jobId: string): Promise<number | null> {
  const admin = getSupabaseAdmin();

  // Prefer DB function once migration 202608140008 is applied
  try {
    const { data, error } = await admin.rpc("ensure_job_number", { p_job_id: jobId });
    if (!error && data != null) {
      const n = Number(data);
      if (Number.isFinite(n) && !isLegacyJobNumber(n)) return n;
    }
  } catch {
    /* fall through to app-side allocation */
  }

  const { data: job } = await admin
    .from("jobs")
    .select("id, job_number, created_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return null;

  const existing = job.job_number == null || job.job_number === "" ? null : Number(job.job_number);
  if (existing && !isLegacyJobNumber(existing)) return existing;

  const at = job.created_at ? new Date(String(job.created_at)) : new Date();
  for (let attempt = 0; attempt < 8; attempt++) {
    const n = await peekNextMonthlyNumber(at);
    const { error } = await admin.from("jobs").update({ job_number: n }).eq("id", jobId);
    if (!error) return n;
    if (!/unique|duplicate/i.test(error.message)) {
      console.error("[allocateMonthlyJobNumber]", jobId, error.message);
      return null;
    }
  }
  return null;
}

async function syncLeadMetaJobNumbers(
  rows: Array<{ lead_id: string | null; job_number: number }>,
) {
  const admin = getSupabaseAdmin();
  for (const row of rows) {
    if (!row.lead_id) continue;
    const { data: lead } = await admin
      .from("leads")
      .select("id, metadata")
      .eq("id", row.lead_id)
      .maybeSingle();
    if (!lead) continue;
    const meta =
      lead.metadata && typeof lead.metadata === "object"
        ? (lead.metadata as Record<string, unknown>)
        : {};
    await admin
      .from("leads")
      .update({
        metadata: { ...meta, jobNumber: String(row.job_number) },
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
  }
}

export async function renumberAllJobNumbers(): Promise<{
  ok: true;
  counted: number;
  via: "rpc" | "app";
  samples: string[];
}> {
  const admin = getSupabaseAdmin();

  try {
    const { data, error } = await admin.rpc("renumber_all_job_numbers");
    if (!error && data != null) {
      const { data: jobs } = await admin
        .from("jobs")
        .select("id, lead_id, job_number")
        .not("job_number", "is", null)
        .neq("status", "cancelled")
        .order("job_number", { ascending: true })
        .limit(500);
      await syncLeadMetaJobNumbers(
        (jobs || []).map((j) => ({
          lead_id: (j.lead_id as string) || null,
          job_number: Number(j.job_number),
        })),
      );
      const samples = (jobs || [])
        .slice(0, 8)
        .map((j) => formatJobNumber(Number(j.job_number)));
      return { ok: true, counted: Number(data), via: "rpc", samples };
    }
  } catch {
    /* app fallback */
  }

  const { data: jobs, error } = await admin
    .from("jobs")
    .select("id, lead_id, created_at, job_number")
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const list = jobs || [];

  // Free unique slots (legacy + modern)
  for (const job of list) {
    if (job.job_number == null) continue;
    await admin.from("jobs").update({ job_number: null }).eq("id", job.id);
  }
  await admin.from("job_invoices").update({ job_number: null }).gte("created_at", "1970-01-01");

  const counters = new Map<number, number>();
  const assigned: Array<{ lead_id: string | null; job_number: number }> = [];
  const samples: string[] = [];

  for (const job of list) {
    const at = job.created_at ? new Date(String(job.created_at)) : new Date();
    const yymm = yymmFromDate(at);
    const seq = (counters.get(yymm) || 0) + 1;
    counters.set(yymm, seq);
    const n = encodeJobNumber(yymm, seq);
    const { error: upErr } = await admin.from("jobs").update({ job_number: n }).eq("id", job.id);
    if (upErr) throw upErr;
    await admin.from("job_invoices").update({ job_number: n }).eq("job_id", job.id);
    assigned.push({ lead_id: (job.lead_id as string) || null, job_number: n });
    if (samples.length < 8) samples.push(formatJobNumber(n));
  }

  await syncLeadMetaJobNumbers(assigned);
  return { ok: true, counted: assigned.length, via: "app", samples };
}
