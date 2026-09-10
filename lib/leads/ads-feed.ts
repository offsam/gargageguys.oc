import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isMetaLeadSource } from "@/lib/ads/meta-lead-cost";
import { canonicalLeadSource, sheetLeadCostFor } from "@/lib/leads/source";
import { sheetStatusFromLead } from "@/lib/leads/stage-sync";
import { isPartnerWork } from "@/lib/sheet/work-source";

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

/** Paid ad channels that belong on Ads → Lead feed (not Partner / Champion jobs). */
export function isPaidAdsFeedLead(input: {
  source: string;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const meta = asMeta(input.metadata);
  const workSource = metaString(meta, "workSource", "work_source", "owner");
  if (isPartnerWork(workSource)) return false;

  const partner = metaString(meta, "partnerName", "partner_name", "partner");
  const source = String(input.source || "").trim();
  if (/champion/i.test(partner) || /champion/i.test(source)) return false;

  const canonical = canonicalLeadSource(source, {
    campaignName: metaString(meta, "metaCampaignName", "googleCampaignName", "campaignName"),
    adName: metaString(meta, "metaAdName", "adName"),
  });
  if (isMetaLeadSource(canonical) || isMetaLeadSource(source)) return true;
  const key = canonical.toLowerCase();
  return (
    key === "thumbtack" ||
    key === "google" ||
    key === "yelp" ||
    key.includes("thumbtack") ||
    key.includes("google") ||
    key.includes("yelp")
  );
}

/** Chronological paid inbound lead feed for Ads — newest first. Excludes Champion / Partner. */
export async function listAdsLeadFeed(input: {
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<AdsFeedLead[]> {
  const limit = Math.min(Math.max(input.limit ?? 80, 1), 200);
  const admin = getSupabaseAdmin();
  // Over-fetch, then keep only paid ads leads (Partner/Champion rows share the leads table).
  const { data, error } = await admin
    .from("leads")
    .select(
      "id, name, phone, zip, address, message, deal_title, stage, created_at, metadata, source",
    )
    .gte("created_at", startOfDayIso(input.periodStart))
    .lte("created_at", endOfDayIso(input.periodEnd))
    .order("created_at", { ascending: false })
    .limit(Math.min(limit * 4, 400));
  if (error) throw error;

  const out: AdsFeedLead[] = [];
  for (const row of data || []) {
    const meta = asMeta(row.metadata);
    const campaign =
      metaString(meta, "metaCampaignName", "googleCampaignName", "campaignName") || "";
    const adName = metaString(meta, "metaAdName", "adName") || "";
    const formName = metaString(meta, "metaFormName", "formName") || "";
    const source = canonicalLeadSource(String(row.source || meta.leadSource || ""), {
      campaignName: campaign,
      adName,
    });
    if (!isPaidAdsFeedLead({ source, metadata: { ...meta, leadSource: source } })) continue;

    const channelDetail = [campaign, adName || formName].filter(Boolean).join(" · ");
    const leadCost = sheetLeadCostFor(source, metaString(meta, "leadCost") || null);
    const sheetStatus = sheetStatusFromLead({
      stage: row.stage,
      metadata: row.metadata,
    });

    out.push({
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
    });
    if (out.length >= limit) break;
  }
  return out;
}
