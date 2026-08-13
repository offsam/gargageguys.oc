import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  parseInvoiceLines,
  sumInvoiceLines,
  type InvoiceLine,
  type JobInvoice,
  type JobInvoiceStatus,
} from "@/lib/field/job-invoice-types";

export type { InvoiceLine, JobInvoice, JobInvoiceStatus };
export { money, PAYMENT_OPTIONS } from "@/lib/field/job-invoice-types";

export async function getJobInvoiceByJobId(jobId: string): Promise<JobInvoice | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("job_invoices")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data);
}

export async function getJobInvoiceByToken(token: string): Promise<JobInvoice | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("job_invoices")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data);
}

function mapRow(data: Record<string, unknown>): JobInvoice {
  const lines = parseInvoiceLines(data.lines);
  const total = Number(data.total_cents) || sumInvoiceLines(lines);
  return {
    id: String(data.id),
    job_id: String(data.job_id),
    lead_id: (data.lead_id as string) || null,
    customer_id: (data.customer_id as string) || null,
    public_token: String(data.public_token),
    status: data.status as JobInvoiceStatus,
    client_name: (data.client_name as string) || null,
    client_phone: (data.client_phone as string) || null,
    client_address: (data.client_address as string) || null,
    client_zip: (data.client_zip as string) || null,
    lines,
    subtotal_cents: Number(data.subtotal_cents) || total,
    total_cents: total,
    payment_type: (data.payment_type as string) || null,
    estimate_confirmed_at: (data.estimate_confirmed_at as string) || null,
    payment_confirmed_at: (data.payment_confirmed_at as string) || null,
    signature_data: (data.signature_data as string) || null,
    signed_at: (data.signed_at as string) || null,
    completed_at: (data.completed_at as string) || null,
    finance_invoice_id: (data.finance_invoice_id as string) || null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

export async function ensureJobInvoice(input: {
  jobId: string;
  createdBy?: string;
}): Promise<JobInvoice> {
  const existing = await getJobInvoiceByJobId(input.jobId);
  if (existing) return existing;

  const admin = getSupabaseAdmin();
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select("id, lead_id, customer_id, address, zip, title, notes")
    .eq("id", input.jobId)
    .maybeSingle();
  if (jobErr) throw jobErr;
  if (!job) throw new Error("Job not found");

  let clientName: string | null = null;
  let clientPhone: string | null = null;
  let clientAddress = job.address || null;
  let clientZip = job.zip || null;
  let customerId = job.customer_id || null;

  if (job.lead_id) {
    const { data: lead } = await admin
      .from("leads")
      .select("id, name, phone, zip, address, customer_id, metadata")
      .eq("id", job.lead_id)
      .maybeSingle();
    if (lead) {
      clientName = lead.name;
      clientPhone = lead.phone;
      clientZip = clientZip || lead.zip;
      customerId = customerId || lead.customer_id;
      const meta =
        lead.metadata && typeof lead.metadata === "object"
          ? (lead.metadata as Record<string, unknown>)
          : {};
      const metaAddress =
        typeof meta.clientAddress === "string" ? meta.clientAddress : "";
      clientAddress =
        clientAddress ||
        (typeof (lead as { address?: string | null }).address === "string"
          ? (lead as { address?: string | null }).address
          : null) ||
        metaAddress ||
        null;
    }
  }

  if (customerId && (!clientName || !clientPhone)) {
    const { data: customer } = await admin
      .from("customers")
      .select("name, phone, zip, address")
      .eq("id", customerId)
      .maybeSingle();
    if (customer) {
      clientName = clientName || customer.name;
      clientPhone = clientPhone || customer.phone;
      clientZip = clientZip || customer.zip;
      clientAddress = clientAddress || customer.address;
    }
  }

  const { data, error } = await admin
    .from("job_invoices")
    .insert({
      job_id: job.id,
      lead_id: job.lead_id,
      customer_id: customerId,
      client_name: clientName || job.title || "Customer",
      client_phone: clientPhone,
      client_address: clientAddress,
      client_zip: clientZip,
      status: "draft",
      lines: [],
      created_by: input.createdBy || null,
    })
    .select("*")
    .single();

  if (error) {
    const again = await getJobInvoiceByJobId(input.jobId);
    if (again) return again;
    throw error;
  }
  return mapRow(data);
}

export async function saveJobInvoiceLines(
  invoiceId: string,
  lines: InvoiceLine[],
  status?: JobInvoiceStatus,
): Promise<JobInvoice> {
  const admin = getSupabaseAdmin();
  const total = sumInvoiceLines(lines);
  const patch: Record<string, unknown> = {
    lines,
    subtotal_cents: total,
    total_cents: total,
    updated_at: new Date().toISOString(),
  };
  if (status) patch.status = status;
  else if (lines.length > 0) patch.status = "estimate_ready";

  const { data, error } = await admin
    .from("job_invoices")
    .update(patch)
    .eq("id", invoiceId)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateJobInvoiceFields(
  invoiceId: string,
  patch: Record<string, unknown>,
): Promise<JobInvoice> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("job_invoices")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}
