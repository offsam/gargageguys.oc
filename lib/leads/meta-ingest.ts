import { revalidatePath } from "next/cache";
import { ingestLead } from "@/lib/leads/ingest";
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

async function notifyNewMetaLead(input: MetaIngestFields, leadId: string) {
  const campaign = input.campaignName || input.campaignId || "";
  const ad = input.adName || input.adId || "";
  const lines = [
    "<b>Garage Guys — new Meta lead</b>",
    "",
    `<b>Name:</b> ${escapeHtml(input.name || "Unknown")}`,
    `<b>Phone:</b> ${escapeHtml(input.phone || "—")}`,
    `<b>ZIP:</b> ${escapeHtml(input.zip || "—")}`,
  ];
  if (input.address) lines.push(`<b>Address:</b> ${escapeHtml(input.address)}`);
  if (input.message) lines.push(`<b>Details:</b> ${escapeHtml(input.message)}`);
  if (campaign) lines.push(`<b>Campaign:</b> ${escapeHtml(campaign)}`);
  if (ad) lines.push(`<b>Ad:</b> ${escapeHtml(ad)}`);
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
}> {
  const leadgenId = String(input.leadgenId || "").trim();
  if (!leadgenId) throw new Error("Missing Meta lead id");
  if (!String(input.phone || "").trim()) throw new Error("Lead has no phone");

  const existing = await findLeadIdByMetaLeadgen(leadgenId);
  if (existing) return { leadId: existing, duplicate: true };

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
    leadSource: "Facebook",
    ...(input.fields ? { metaFields: input.fields } : {}),
  };
  const leadCost = resolveMetaLeadCost(leadMeta, metaPricing);

  const created = await ingestLead({
    name: String(input.name || "").trim() || "Meta lead",
    phone: String(input.phone).trim(),
    zip: String(input.zip || "").trim() || "00000",
    address: String(input.address || "").trim() || undefined,
    message: String(input.message || "").trim() || undefined,
    source: "Meta Ads",
    leadType: "meta_lead_ad",
    dealTitle: String(input.message || "").trim() || "Meta Lead Ad",
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
    await notifyNewMetaLead(input, created.leadId);
  } catch (error) {
    console.error("[meta-lead] telegram failed", error);
  }

  revalidateLeadPaths();
  return { leadId: created.leadId, duplicate: false };
}
