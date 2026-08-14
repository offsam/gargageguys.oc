import { revalidatePath } from "next/cache";
import { ingestLead } from "@/lib/leads/ingest";
import { escapeHtml, sendTelegram } from "@/lib/notify/channels";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { GoogleLeadRow } from "@/lib/ads/google";

export type GoogleIngestFields = {
  googleLeadId: string;
  name: string;
  phone: string;
  zip?: string;
  address?: string;
  message?: string;
  email?: string;
  sourceKind: "google_ads" | "google_lsa";
  campaignId?: string | null;
  campaignName?: string | null;
  createdTime?: string | null;
  fields?: Record<string, string>;
};

function siteBase() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "https://garageguysoc.com"
  ).replace(/\/$/, "");
}

export async function findLeadIdByGoogleLead(googleLeadId: string): Promise<string | null> {
  if (!googleLeadId) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("leads")
    .select("id")
    .contains("metadata", { googleLeadId })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export function googleLeadRowToIngest(lead: GoogleLeadRow): GoogleIngestFields {
  return {
    googleLeadId: lead.id,
    name: lead.name || "Google lead",
    phone: lead.phone,
    zip: lead.zip,
    address: lead.address,
    message: lead.message,
    email: lead.email,
    sourceKind: lead.source,
    campaignId: lead.campaignId,
    campaignName: lead.campaignName,
    createdTime: lead.createdTime,
    fields: lead.fields,
  };
}

async function notifyNewGoogleLead(input: GoogleIngestFields) {
  const kind = input.sourceKind === "google_lsa" ? "Google Local Services" : "Google Ads";
  const lines = [
    `<b>Garage Guys — new ${escapeHtml(kind)} lead</b>`,
    "",
    `<b>Name:</b> ${escapeHtml(input.name || "Unknown")}`,
    `<b>Phone:</b> ${escapeHtml(input.phone || "—")}`,
    `<b>ZIP:</b> ${escapeHtml(input.zip || "—")}`,
  ];
  if (input.address) lines.push(`<b>Address:</b> ${escapeHtml(input.address)}`);
  if (input.message) lines.push(`<b>Details:</b> ${escapeHtml(input.message)}`);
  if (input.campaignName) lines.push(`<b>Campaign:</b> ${escapeHtml(input.campaignName)}`);
  lines.push("", `<a href="${siteBase()}/crm">Open CRM Waiting</a>`);
  await sendTelegram(lines.join("\n"));
}

function revalidateLeadPaths() {
  revalidatePath("/crm");
  revalidatePath("/dispatch");
  revalidatePath("/sheet");
  revalidatePath("/owner");
  revalidatePath("/ads");
}

export async function ingestGoogleLeadToCrm(input: GoogleIngestFields): Promise<{
  leadId: string;
  duplicate: boolean;
}> {
  const googleLeadId = String(input.googleLeadId || "").trim();
  if (!googleLeadId) throw new Error("Missing Google lead id");
  if (!String(input.phone || "").trim()) throw new Error("Lead has no phone");

  const existing = await findLeadIdByGoogleLead(googleLeadId);
  if (existing) return { leadId: existing, duplicate: true };

  const created = await ingestLead({
    name: String(input.name || "").trim() || "Google lead",
    phone: String(input.phone).trim(),
    zip: String(input.zip || "").trim() || "00000",
    address: String(input.address || "").trim() || undefined,
    message: String(input.message || "").trim() || undefined,
    source: "Google",
    leadType: input.sourceKind === "google_lsa" ? "google_lsa_lead" : "google_ads_lead",
    dealTitle: String(input.message || "").trim() || "Google lead",
    jobStatus: "Waiting",
    metadata: {
      googleLeadId,
      googleSource: input.sourceKind,
      googleCampaignId: input.campaignId || null,
      googleCampaignName: input.campaignName || null,
      googleCreatedTime: input.createdTime || null,
      googleEmail: input.email || "",
      leadSource: "Google",
      ...(input.fields ? { googleFields: input.fields } : {}),
    },
  });

  try {
    await notifyNewGoogleLead(input);
  } catch (error) {
    console.error("[google-lead] telegram failed", error);
  }

  revalidateLeadPaths();
  return { leadId: created.leadId, duplicate: false };
}
