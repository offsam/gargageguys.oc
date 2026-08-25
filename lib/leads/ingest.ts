import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { LeadStage } from "@/lib/supabase/types";
import { stageFromSheetStatus, type SheetStatus } from "@/lib/leads/stage-sync";
import { canonicalLeadSource, sheetLeadCostFor } from "@/lib/leads/source";
import { ensureLeadWorkOrder } from "@/lib/field/job-invoice";
import { formatJobNumber } from "@/lib/field/job-invoice-types";

export type IngestLeadInput = {
  name: string;
  phone: string;
  zip: string;
  address?: string;
  message?: string;
  source?: string;
  leadType?: string;
  dealTitle?: string;
  dealPrice?: string;
  dealId?: string;
  stage?: LeadStage;
  problem?: string;
  jobStatus?: SheetStatus;
  preferredDate?: string;
  timeWindow?: string;
  metadata?: Record<string, unknown>;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function ingestLead(input: IngestLeadInput) {
  const supabase = getSupabaseAdmin();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const zip = input.zip.trim();
  const address = String(input.address || "").trim();

  let customerId: string | null = null;
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing?.id) {
    customerId = existing.id;
    await supabase
      .from("customers")
      .update({
        name,
        zip,
        address: address || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ name, phone, zip, address: address || null })
      .select("id")
      .single();
    if (error) throw error;
    customerId = created.id;
  }

  const extra = input.metadata || {};
  const leadSource = canonicalLeadSource(input.source, {
    campaignName: String(extra.metaCampaignName || extra.googleCampaignName || extra.campaignName || ""),
    adName: String(extra.metaAdName || extra.adName || ""),
  });
  const jobType =
    input.dealTitle ||
    input.leadType ||
    (input.message ? input.message.slice(0, 120) : "") ||
    "Website lead";

  const hasScheduleHint = Boolean(input.preferredDate || input.timeWindow);
  const jobStatus: SheetStatus =
    input.jobStatus || (hasScheduleHint ? "Scheduled" : "Waiting");
  const stage =
    input.stage || stageFromSheetStatus(jobStatus) || ("new" as LeadStage);

  const sheetDate = input.preferredDate || todayISO();
  const leadCost = sheetLeadCostFor(
    leadSource,
    String(extra.leadCost || extra.lead_cost || ""),
  );
  const metadata = {
    partnerName: "",
    service: "",
    parts: "",
    paymentType: "",
    checkNumber: "",
    jobCost: input.dealPrice || "",
    bankFee: "",
    partsCost: "",
    technician: "",
    techSalary: "",
    description: "",
    preferredDate: input.preferredDate || "",
    timeWindow: input.timeWindow || "",
    websiteLeadType: input.leadType || "",
    ...(input.dealId ? { dealId: input.dealId } : {}),
    ...extra,
    workSource: String(extra.workSource || "Garage Guys"),
    leadSource,
    leadCost,
    clientName: name,
    clientAddress: address || String(extra.clientAddress || "") || (zip ? `ZIP ${zip}` : ""),
    jobStatus,
    jobType,
    issue: String(extra.issue || jobType),
    phone,
    zip,
    sheetDate: String(extra.sheetDate || sheetDate),
  };

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      customer_id: customerId,
      name,
      phone,
      zip,
      address: address || null,
      message: input.message || null,
      problem: input.problem || input.message || null,
      source: leadSource,
      lead_type: input.leadType || "callback",
      stage,
      deal_title: input.dealTitle || jobType || null,
      deal_price: input.dealPrice || null,
      scheduled_at: input.preferredDate
        ? `${input.preferredDate}T12:00:00.000Z`
        : null,
      metadata: {
        ...metadata,
        ...(address ? { clientAddress: address } : {}),
      },
    })
    .select("id")
    .single();

  if (leadError) throw leadError;

  let jobNumberLabel = "";
  try {
    const wo = await ensureLeadWorkOrder({ leadId: lead.id });
    const label = formatJobNumber(wo.jobNumber);
    if (label !== "—") jobNumberLabel = label;
  } catch {
    /* numbering is best-effort */
  }

  const title = `Lead: ${name} (${zip || address || "OC"})`;
  const { data: inbox, error: inboxError } = await supabase
    .from("inbox_items")
    .insert({
      lead_id: lead.id,
      item_type: "lead",
      title,
      body: input.message || null,
      source: leadSource,
      payload: { ...input, leadId: lead.id, metadata, jobNumber: jobNumberLabel },
      status: "new",
    })
    .select("id")
    .single();

  if (inboxError) throw inboxError;

  revalidatePath("/sheet");
  revalidatePath("/crm");
  revalidatePath("/clients");

  return { leadId: lead.id, inboxItemId: inbox.id, customerId, jobNumber: jobNumberLabel };
}
