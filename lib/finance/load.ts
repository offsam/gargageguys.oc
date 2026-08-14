import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatJobNumber } from "@/lib/field/job-invoice-types";
import { normalizeWorkSource } from "@/lib/sheet/work-source";
import { sheetStatusFromLead } from "@/lib/leads/stage-sync";
import type { FinanceRow, FinanceSourceKind } from "@/lib/finance/types";

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

function dateKey(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateLabel(key: string): string {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function moneyToCents(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function sourceFromLead(
  lead:
    | {
        source?: string | null;
        metadata?: unknown;
      }
    | null
    | undefined,
): { kind: FinanceSourceKind; label: string } {
  if (!lead) return { kind: "unknown", label: "Unknown" };
  const meta = asMeta(lead.metadata);
  const workSource = normalizeWorkSource(
    pick(meta, "workSource", "work_source", "owner") || "Garage Guys",
  );
  if (workSource === "Partner") {
    const partner = pick(meta, "partnerName", "partner_name", "partner") || "Partner";
    return { kind: "partner", label: partner };
  }
  const leadSource =
    String(lead.source || "").trim() || pick(meta, "leadSource", "lead_source") || "Unknown";
  return { kind: workSource === "Garage Guys" ? "garage_guys" : "unknown", label: leadSource };
}

function clientEmail(
  customer?: { email?: string | null } | Record<string, unknown> | null,
  lead?: { metadata?: unknown } | Record<string, unknown> | null,
) {
  const fromCust =
    customer && typeof customer === "object" && "email" in customer && typeof customer.email === "string"
      ? customer.email.trim()
      : "";
  if (fromCust) return fromCust;
  return pick(asMeta(lead && "metadata" in lead ? lead.metadata : null), "email", "clientEmail", "client_email");
}

async function fetchByIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: "leads" | "jobs" | "customers",
  select: string,
  ids: Array<string | null | undefined>,
) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const slice = unique.slice(i, i + 100);
    const { data } = await supabase.from(table).select(select).in("id", slice);
    if (data) rows.push(...(data as unknown as Record<string, unknown>[]));
  }
  return rows;
}

export async function loadFinanceRows(): Promise<FinanceRow[]> {
  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const [invoicesRes, jobInvoicesRes, completedLeadsRes] = await Promise.all([
    supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(400),
    admin.from("job_invoices").select("*").order("created_at", { ascending: false }).limit(400),
    supabase
      .from("leads")
      .select("id, name, phone, source, stage, metadata, deal_price, created_at")
      .eq("stage", "completed")
      .order("updated_at", { ascending: false })
      .limit(300),
  ]);

  const invoiceList = invoicesRes.data || [];
  const completedLeads = completedLeadsRes.data || [];
  const jobInvoiceList = ((jobInvoicesRes.data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    job_id: String(row.job_id),
    lead_id: (row.lead_id as string) || null,
    customer_id: (row.customer_id as string) || null,
    finance_invoice_id: (row.finance_invoice_id as string) || null,
    public_token: String(row.public_token || ""),
    client_name: (row.client_name as string) || null,
    completed_at: (row.completed_at as string) || null,
    status: String(row.status || "draft"),
    total_cents: Number(row.total_cents) || 0,
    payment_type: (row.payment_type as string) || null,
    job_number:
      row.job_number == null || row.job_number === "" ? null : Number(row.job_number),
  })) as Array<{
    id: string;
    job_id: string;
    lead_id: string | null;
    customer_id: string | null;
    finance_invoice_id: string | null;
    public_token: string;
    client_name: string | null;
    completed_at: string | null;
    status: string;
    total_cents: number | null;
    payment_type: string | null;
    job_number: number | null;
  }>;

  const [leads, jobs, customers] = await Promise.all([
    fetchByIds(
      supabase,
      "leads",
      "id, name, phone, source, stage, metadata, deal_price, created_at",
      [
        ...invoiceList.map((i) => i.lead_id),
        ...jobInvoiceList.map((j) => j.lead_id),
      ],
    ),
    fetchByIds(supabase, "jobs", "id, scheduled_start, title, address, status", [
      ...invoiceList.map((i) => i.job_id),
      ...jobInvoiceList.map((j) => j.job_id),
    ]),
    fetchByIds(supabase, "customers", "id, name, phone, email", [
      ...invoiceList.map((i) => i.customer_id),
      ...jobInvoiceList.map((j) => j.customer_id),
    ]),
  ]);

  const leadById = new Map(leads.map((l) => [String(l.id), l]));
  const jobById = new Map(jobs.map((j) => [String(j.id), j]));
  const customerById = new Map(customers.map((c) => [String(c.id), c]));
  const jobInvByFinanceId = new Map(
    jobInvoiceList.filter((j) => j.finance_invoice_id).map((j) => [j.finance_invoice_id!, j]),
  );
  const jobInvByJobId = new Map(jobInvoiceList.map((j) => [j.job_id, j]));

  const usedLeadIds = new Set<string>();
  const usedJobInvIds = new Set<string>();
  const rows: FinanceRow[] = [];

  for (const inv of invoiceList) {
    const jobInv =
      (inv.id && jobInvByFinanceId.get(inv.id)) ||
      (inv.job_id && jobInvByJobId.get(inv.job_id)) ||
      null;
    if (jobInv) usedJobInvIds.add(jobInv.id);

    const lead = inv.lead_id ? leadById.get(inv.lead_id) : jobInv?.lead_id ? leadById.get(jobInv.lead_id) : null;
    if (lead) usedLeadIds.add(String(lead.id));
    const job = inv.job_id ? jobById.get(inv.job_id) : jobInv ? jobById.get(jobInv.job_id) : null;
    const customer = inv.customer_id
      ? customerById.get(inv.customer_id)
      : jobInv?.customer_id
        ? customerById.get(jobInv.customer_id)
        : null;
    const meta = asMeta(lead?.metadata);
    const source = sourceFromLead(lead as { source?: string | null; metadata?: unknown } | null);
    const workDate =
      dateKey(jobInv?.completed_at) ||
      dateKey(pick(meta, "sheetDate", "date")) ||
      dateKey(inv.paid_at) ||
      dateKey(typeof job?.scheduled_start === "string" ? job.scheduled_start : "") ||
      dateKey(inv.created_at);
    const jobNumberRaw =
      jobInv?.job_number ??
      (typeof job?.job_number === "number" ? job.job_number : Number(job?.job_number) || null);
    const clientName =
      jobInv?.client_name ||
      (typeof lead?.name === "string" ? lead.name : "") ||
      (typeof customer?.name === "string" ? customer.name : "") ||
      (typeof customer?.phone === "string" ? customer.phone : "") ||
      "Client";

    rows.push({
      id: inv.id,
      invoiceId: inv.id,
      clientName,
      jobNumber: formatJobNumber(jobNumberRaw) === "—" ? null : formatJobNumber(jobNumberRaw),
      workDate,
      workDateLabel: dateLabel(workDate),
      sourceKind: source.kind,
      sourceLabel: source.label,
      amountCents: Number(inv.amount_cents) || Number(jobInv?.total_cents) || 0,
      status: inv.status,
      invoiceUrl: jobInv?.public_token ? `/i/${jobInv.public_token}` : null,
      publicToken: jobInv?.public_token || null,
      clientEmail: clientEmail(customer, lead),
      description: inv.description || "",
      paymentType: jobInv?.payment_type || pick(meta, "paymentType", "payment_type"),
    });
  }

  for (const jobInv of jobInvoiceList) {
    if (usedJobInvIds.has(jobInv.id)) continue;
    const lead = jobInv.lead_id ? leadById.get(jobInv.lead_id) : null;
    if (lead) usedLeadIds.add(String(lead.id));
    const job = jobById.get(jobInv.job_id);
    const customer = jobInv.customer_id ? customerById.get(jobInv.customer_id) : null;
    const meta = asMeta(lead?.metadata);
    const source = sourceFromLead(lead as { source?: string | null; metadata?: unknown } | null);
    const workDate =
      dateKey(jobInv.completed_at) ||
      dateKey(pick(meta, "sheetDate", "date")) ||
      dateKey(typeof job?.scheduled_start === "string" ? job.scheduled_start : "") ||
      "";
    const jobNumberLabel = formatJobNumber(jobInv.job_number);
    const clientName =
      jobInv.client_name ||
      (typeof lead?.name === "string" ? lead.name : "") ||
      (typeof customer?.name === "string" ? customer.name : "") ||
      "Client";

    rows.push({
      id: `jobinv-${jobInv.id}`,
      invoiceId: jobInv.finance_invoice_id,
      clientName,
      jobNumber: jobNumberLabel === "—" ? null : jobNumberLabel,
      workDate,
      workDateLabel: dateLabel(workDate),
      sourceKind: source.kind,
      sourceLabel: source.label,
      amountCents: Number(jobInv.total_cents) || 0,
      status: jobInv.status.replace(/_/g, " "),
      invoiceUrl: jobInv.public_token ? `/i/${jobInv.public_token}` : null,
      publicToken: jobInv.public_token || null,
      clientEmail: clientEmail(customer, lead),
      description: "",
      paymentType: jobInv.payment_type || "",
    });
  }

  for (const lead of completedLeads || []) {
    if (usedLeadIds.has(lead.id)) continue;
    const meta = asMeta(lead.metadata);
    const source = sourceFromLead(lead);
    const status = sheetStatusFromLead(lead);
    const workDate = dateKey(pick(meta, "sheetDate", "date")) || dateKey(lead.created_at);
    const amountCents =
      moneyToCents(pick(meta, "jobCost", "job_cost")) || moneyToCents(lead.deal_price || "");
    if (status !== "Completed") continue;
    if (source.kind !== "partner" && !amountCents) continue;

    rows.push({
      id: `lead-${lead.id}`,
      invoiceId: null,
      clientName: lead.name || "Client",
      jobNumber: null,
      workDate,
      workDateLabel: dateLabel(workDate),
      sourceKind: source.kind,
      sourceLabel: source.label,
      amountCents,
      status: source.kind === "partner" ? "partner" : "completed",
      invoiceUrl: null,
      publicToken: null,
      clientEmail: clientEmail(undefined, lead),
      description: source.kind === "partner" ? "Partner job — no Garage Guys invoice" : "",
      paymentType: pick(meta, "paymentType", "payment_type"),
    });
  }

  rows.sort((a, b) => (a.workDate < b.workDate ? 1 : a.workDate > b.workDate ? -1 : 0));
  return rows;
}
