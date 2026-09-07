import { revalidatePath } from "next/cache";
import { ingestLead } from "@/lib/leads/ingest";
import { canonicalLeadSource } from "@/lib/leads/source";
import { escapeHtml, sendTelegram } from "@/lib/notify/channels";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { MetaLeadRow } from "@/lib/ads/meta";
import { listAdsSnapshots } from "@/lib/ads/snapshots";
import {
  buildMetaPricingIndex,
  formatLeadCostUsd,
  resolveMetaLeadCost,
} from "@/lib/ads/meta-lead-cost";

export type MetaIngestFields = {
  leadgenId: string;
  name: string;
  phone: string;
  email?: string;
  zip?: string;
  address?: string;
  message?: string;
  formId?: string | null;
  adId?: string | null;
  adsetId?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  adName?: string | null;
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

export async function findLeadIdByMetaLeadgen(leadgenId: string): Promise<string | null> {
  if (!leadgenId) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("leads")
    .select("id")
    .contains("metadata", { metaLeadgenId: leadgenId })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export function metaLeadRowToIngest(lead: MetaLeadRow): MetaIngestFields {
  return {
    leadgenId: lead.id,
    name: lead.name || "Meta lead",
    phone: lead.phone,
    email: lead.email,
    zip: lead.zip,
    address: lead.address,
    message: lead.message,
    formId: lead.formId,
    adId: lead.adId,
    campaignId: lead.campaignId,
    campaignName: lead.campaignName,
    adName: lead.adName,
    createdTime: lead.createdTime,
    fields: lead.fields,
  };
}

export function resolveMetaChannelSource(input: {
  campaignName?: string | null;
  adName?: string | null;
  formId?: string | null;
  fields?: Record<string, string>;
}): "Facebook" | "Instagram" {
  const fieldBlob = Object.entries(input.fields || {})
    .map(([k, v]) => `${k} ${v}`)
    .join(" ");
  const source = canonicalLeadSource("Meta Ads", {
    campaignName: `${input.campaignName || ""} ${input.formId || ""} ${fieldBlob}`,
    adName: input.adName || "",
  });
  return source === "Instagram" ? "Instagram" : "Facebook";
}

async function notifyNewMetaLead(input: MetaIngestFields, leadId: string, channel: string) {
  const campaign = input.campaignName || input.campaignId || "";
  const ad = input.adName || input.adId || "";
  const hasRealPhone = Boolean(input.phone && !input.phone.startsWith("meta-"));
  const lines = [
    `<b>Garage Guys — new ${escapeHtml(channel)} lead</b>`,
    "",
    `<b>Name:</b> ${escapeHtml(input.name || "Unknown")}`,
    `<b>Phone:</b> ${escapeHtml(hasRealPhone ? input.phone : "— (missing)")}`,
  ];
  if (input.email) lines.push(`<b>Email:</b> ${escapeHtml(input.email)}`);
  lines.push(`<b>ZIP:</b> ${escapeHtml(input.zip || "—")}`);
  if (input.address) lines.push(`<b>Address:</b> ${escapeHtml(input.address)}`);
  if (input.message) lines.push(`<b>Details:</b> ${escapeHtml(input.message)}`);
  if (campaign) lines.push(`<b>Campaign:</b> ${escapeHtml(campaign)}`);
  if (ad) lines.push(`<b>Ad:</b> ${escapeHtml(ad)}`);
  if (!hasRealPhone) {
    lines.push("", "<i>Form had no phone — still saved to CRM Waiting.</i>");
  }
  lines.push("", `<a href="${siteBase()}/crm">Open CRM Waiting</a>`);
  void leadId;
  await sendTelegram(lines.join("\n"));
}

function revalidateLeadPaths() {
  revalidatePath("/crm");
  revalidatePath("/dispatch");
  revalidatePath("/sheet");
  revalidatePath("/owner");
  revalidatePath("/ads");
}

/** Insert a Meta Instant Form lead as Waiting. Telegram only on first insert. */
export async function ingestMetaLeadToCrm(input: MetaIngestFields): Promise<{
  leadId: string;
  duplicate: boolean;
  missingPhone: boolean;
}> {
  const leadgenId = String(input.leadgenId || "").trim();
  if (!leadgenId) throw new Error("Missing Meta lead id");

  const existing = await findLeadIdByMetaLeadgen(leadgenId);
  if (existing) return { leadId: existing, duplicate: true, missingPhone: false };

  const rawPhone = String(input.phone || "").trim();
  const missingPhone = !rawPhone;
  const phone = rawPhone || `meta-${leadgenId}`;
  const channel = resolveMetaChannelSource(input);

  const metaSnapshots = await listAdsSnapshots(1, "meta").catch(() => []);
  const metaPricing = buildMetaPricingIndex(metaSnapshots[0]);
  const leadMeta = {
    metaLeadgenId: leadgenId,
    metaFormId: input.formId || null,
    metaAdId: input.adId || null,
    metaAdsetId: input.adsetId || null,
    metaCampaignId: input.campaignId || null,
    metaCampaignName: input.campaignName || null,
    metaAdName: input.adName || null,
    metaCreatedTime: input.createdTime || null,
    metaEmail: input.email || null,
    metaMissingPhone: missingPhone,
    leadSource: channel,
    ...(input.fields ? { metaFields: input.fields } : {}),
  };
  const leadCost = resolveMetaLeadCost(leadMeta, metaPricing);

  const details = [
    String(input.message || "").trim(),
    missingPhone ? "Meta form submitted without a phone number." : "",
    input.email ? `Email: ${input.email}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const created = await ingestLead({
    name: String(input.name || "").trim() || `${channel} lead`,
    phone,
    zip: String(input.zip || "").trim() || "00000",
    address: String(input.address || "").trim() || undefined,
    message: details || undefined,
    source: channel,
    leadType: "meta_lead_ad",
    dealTitle: String(input.message || "").trim() || `${channel} Lead Ad`,
    jobStatus: "Waiting",
    metadata: {
      ...leadMeta,
      ...(leadCost ? { leadCost } : {}),
      ...(metaPricing.accountCpl != null
        ? { metaAccountCpl: formatLeadCostUsd(metaPricing.accountCpl) }
        : {}),
      ...(input.campaignId && metaPricing.campaigns.get(input.campaignId)?.cpl != null
        ? {
            metaCampaignCpl: formatLeadCostUsd(
              metaPricing.campaigns.get(input.campaignId)!.cpl,
            ),
          }
        : {}),
      metaLeadCostSyncedAt: metaPricing.syncedAt || new Date().toISOString(),
    },
  });

  try {
    await notifyNewMetaLead({ ...input, phone }, created.leadId, channel);
  } catch (error) {
    console.error("[meta-lead] telegram failed", error);
  }

  revalidateLeadPaths();
  return { leadId: created.leadId, duplicate: false, missingPhone };
}
