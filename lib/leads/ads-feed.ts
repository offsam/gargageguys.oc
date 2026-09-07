import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canonicalLeadSource, sheetLeadCostFor } from "@/lib/leads/source";
import { sheetStatusFromLead } from "@/lib/leads/stage-sync";

export type AdsFeedLead = {
  id: string;
  createdAt: string;
  source: string;
  /** Extra channel detail (campaign, form, etc.). */
  channelDetail: string;
  name: string;
  phone: string;
  zip: string;
  address: string;
  job: string;
  stage: string;
  sheetStatus: string;
  leadCost: string;
};

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function metaString(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function endOfDayIso(ymd: string): string {
  return `${ymd}T23:59:59.999Z`;
}

function startOfDayIso(ymd: string): string {
  return `${ymd}T00:00:00.000Z`;
}

/** Chronological inbound lead feed for Ads — all sources, newest first. */
export async function listAdsLeadFeed(input: {
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<AdsFeedLead[]> {
  const limit = Math.min(Math.max(input.limit ?? 80, 1), 200);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("leads")
    .select(
      "id, name, phone, zip, address, message, deal_title, stage, created_at, metadata, source",
    )
    .gte("created_at", startOfDayIso(input.periodStart))
    .lte("created_at", endOfDayIso(input.periodEnd))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data || []).map((row) => {
    const meta = asMeta(row.metadata);
    const campaign =
      metaString(meta, "metaCampaignName", "googleCampaignName", "campaignName") || "";
    const adName = metaString(meta, "metaAdName", "adName") || "";
    const formName = metaString(meta, "metaFormName", "formName") || "";
    const source = canonicalLeadSource(String(row.source || meta.leadSource || ""), {
      campaignName: campaign,
      adName,
    });
    const channelDetail = [campaign, adName || formName].filter(Boolean).join(" · ");
    const leadCost = sheetLeadCostFor(source, metaString(meta, "leadCost") || null);
    const sheetStatus = sheetStatusFromLead({
      stage: row.stage,
      metadata: row.metadata,
    });

    return {
      id: row.id,
      createdAt: row.created_at,
      source,
      channelDetail,
      name: row.name || "Lead",
      phone: row.phone || "",
      zip: row.zip || "",
      address: row.address || metaString(meta, "clientAddress") || "",
      job: (row.deal_title || row.message || "").slice(0, 100),
      stage: row.stage || "",
      sheetStatus,
      leadCost,
    };
  });
}
