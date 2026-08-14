import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { ensureLeadWorkOrder } from "@/lib/field/job-invoice";
import { formatJobNumber } from "@/lib/field/job-number";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${cronSecret}`;
}

/** Diagnose / optionally issue Job # for a sheet/CRM client by name fragment. */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    q?: string;
    fix?: boolean;
  };
  const q = String(body.q || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: leads, error } = await admin
    .from("leads")
    .select("id, name, address, stage, source, deal_price, created_at, metadata")
    .or(`name.ilike.%${q}%,address.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also scan recent metadata clientName
  const { data: recent } = await admin
    .from("leads")
    .select("id, name, address, stage, source, deal_price, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(250);
  const needle = q.toLowerCase();
  const byId = new Map<string, NonNullable<typeof leads>[number]>();
  for (const row of [...(leads || []), ...(recent || [])]) {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const blob = [
      row.name,
      row.address,
      meta.clientName,
      meta.clientAddress,
      meta.partnerName,
    ]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    if (blob.includes(needle)) byId.set(row.id, row);
  }

  const rows = [...byId.values()];
  const report = [];

  for (const lead of rows) {
    const meta =
      lead.metadata && typeof lead.metadata === "object"
        ? (lead.metadata as Record<string, unknown>)
        : {};
    const address =
      lead.address ||
      (typeof meta.clientAddress === "string" ? meta.clientAddress : "") ||
      "";
    const { data: jobs } = await admin
      .from("jobs")
      .select("id, job_number, status, created_at")
      .eq("lead_id", lead.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true });
    const job = jobs?.[0] || null;
    let invoice = null as { id: string; job_number: number | null; status: string } | null;
    if (job) {
      const { data: inv } = await admin
        .from("job_invoices")
        .select("id, job_number, status")
        .eq("job_id", job.id)
        .maybeSingle();
      invoice = inv;
    }

    let fixed: string | null = null;
    let fixError: string | null = null;
    const reason = !String(address).trim()
      ? "no_address"
      : job?.job_number
        ? "has_job_number"
        : job
          ? "job_without_number"
          : "no_job_row";

    if (body.fix && reason !== "has_job_number" && String(address).trim()) {
      try {
        const wo = await ensureLeadWorkOrder({ leadId: lead.id });
        fixed = formatJobNumber(wo.jobNumber);
      } catch (err) {
        fixError = err instanceof Error ? err.message : "fix failed";
      }
    }

    report.push({
      leadId: lead.id,
      name: lead.name || meta.clientName || null,
      address: address || null,
      stage: lead.stage,
      source: lead.source,
      metaJobNumber: meta.jobNumber || null,
      jobId: job?.id || null,
      jobNumberRaw: job?.job_number ?? null,
      jobNumber: job?.job_number != null ? formatJobNumber(Number(job.job_number)) : null,
      invoiceId: invoice?.id || null,
      invoiceNumber:
        invoice?.job_number != null ? formatJobNumber(Number(invoice.job_number)) : null,
      reason,
      fixed,
      fixError,
    });
  }

  return NextResponse.json({ ok: true, q, count: report.length, report });
}
