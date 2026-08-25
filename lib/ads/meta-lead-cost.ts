import type { MetaCampaignMetrics } from "@/lib/ads/meta";
import type { AdsSnapshotRow } from "@/lib/ads/snapshots";
import { canonicalLeadSource, sheetLeadCostFor } from "@/lib/leads/source";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type MetaCampaignPricing = {
  id: string;
  name: string;
  spend: number;
  leads: number;
  cpl: number | null;
};

export type MetaPricingIndex = {
  accountCpl: number | null;
  campaigns: Map<string, MetaCampaignPricing>;
  byName: Map<string, MetaCampaignPricing>;
  syncedAt: string | null;
};

export type MetaPricingClient = {
  accountCpl: number | null;
  campaigns: MetaCampaignPricing[];
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatLeadCostUsd(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "";
  return amount.toFixed(2);
}

export function accountCplFromSnapshot(snapshot: AdsSnapshotRow | null | undefined): number | null {
  if (!snapshot) return null;
  const cpl = num(snapshot.cpl);
  if (cpl > 0) return cpl;
  const spend = num(snapshot.spend);
  const leads = num(snapshot.leads);
  if (spend > 0 && leads > 0) return spend / leads;
  return null;
}

function campaignCpl(campaign: MetaCampaignMetrics): number | null {
  const direct = num(campaign.cpl);
  if (direct > 0) return direct;
  if (campaign.spend > 0 && campaign.leads > 0) return campaign.spend / campaign.leads;
  return null;
}

export function buildMetaPricingIndex(
  snapshot: AdsSnapshotRow | null | undefined,
): MetaPricingIndex {
  const campaigns = new Map<string, MetaCampaignPricing>();
  const byName = new Map<string, MetaCampaignPricing>();
  if (!snapshot) {
    return { accountCpl: null, campaigns, byName, syncedAt: null };
  }

  const raw = snapshot.metrics?.campaigns;
  const list = Array.isArray(raw) ? (raw as MetaCampaignMetrics[]) : [];
  for (const row of list) {
    const id = String(row?.id || "").trim();
    if (!id) continue;
    const pricing: MetaCampaignPricing = {
      id,
      name: String(row.name || id).trim() || id,
      spend: num(row.spend),
      leads: Math.round(num(row.leads)),
      cpl: campaignCpl(row),
    };
    campaigns.set(id, pricing);
    if (pricing.name) byName.set(pricing.name.toLowerCase(), pricing);
  }

  return {
    accountCpl: accountCplFromSnapshot(snapshot),
    campaigns,
    byName,
    syncedAt: snapshot.synced_at || null,
  };
}

export function metaPricingForClient(index: MetaPricingIndex): MetaPricingClient {
  return {
    accountCpl: index.accountCpl,
    campaigns: [...index.campaigns.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function isMetaLeadSource(source: string): boolean {
  const s = String(source || "").trim().toLowerCase();
  return s === "facebook" || s === "instagram" || s.includes("meta");
}

export function resolveMetaLeadCost(
  metadata: Record<string, unknown>,
  index: MetaPricingIndex,
): string {
  const campaignId = String(metadata.metaCampaignId || "").trim();
  if (campaignId && index.campaigns.has(campaignId)) {
    return formatLeadCostUsd(index.campaigns.get(campaignId)!.cpl);
  }

  const campaignName = String(metadata.metaCampaignName || "").trim().toLowerCase();
  if (campaignName && index.byName.has(campaignName)) {
    return formatLeadCostUsd(index.byName.get(campaignName)!.cpl);
  }

  return formatLeadCostUsd(index.accountCpl);
}

export function resolveSheetLeadCost(
  leadSource: string,
  metadata: Record<string, unknown>,
  index: MetaPricingIndex | null | undefined,
): string {
  if (index && isMetaLeadSource(leadSource)) {
    const fromMeta = resolveMetaLeadCost(metadata, index);
    if (fromMeta) return fromMeta;
  }
  return sheetLeadCostFor(leadSource, String(metadata.leadCost || metadata.lead_cost || ""));
}

export function snapshotFromUpsert(input: {
  platform: string;
  period: { startDate: string; endDate: string };
  spend?: number | null;
  leads?: number | null;
  cpl?: number | null;
  metrics?: Record<string, unknown>;
  syncedAt?: string;
}): AdsSnapshotRow {
  const now = input.syncedAt || new Date().toISOString();
  return {
    id: "",
    platform: input.platform,
    period_start: input.period.startDate,
    period_end: input.period.endDate,
    account_id: null,
    spend: input.spend ?? null,
    impressions: null,
    clicks: null,
    leads: input.leads ?? null,
    cpl: input.cpl ?? null,
    metrics: input.metrics || {},
    synced_at: now,
    created_at: now,
  };
}

/** Push latest Meta CPL (account + campaign) into CRM / Sheet lead rows. */
export async function syncMetaLeadCostsFromSnapshot(
  snapshot: AdsSnapshotRow | null | undefined,
): Promise<{ updated: number }> {
  if (!snapshot || snapshot.platform !== "meta") return { updated: 0 };

  const index = buildMetaPricingIndex(snapshot);
  if (!index.accountCpl && index.campaigns.size === 0) return { updated: 0 };

  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from("leads")
    .select("id, source, metadata")
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error) throw error;

  let updated = 0;
  for (const row of rows || []) {
    const meta = asObject(row.metadata);
    const hasMeta =
      Boolean(String(meta.metaLeadgenId || "").trim()) ||
      Boolean(String(meta.metaCampaignId || "").trim());
    const source = canonicalLeadSource(String(row.source || meta.leadSource || ""), {
      campaignName: String(meta.metaCampaignName || ""),
      adName: String(meta.metaAdName || ""),
    });
    if (!hasMeta && !isMetaLeadSource(source)) continue;

    const leadCost = resolveMetaLeadCost(meta, index);
    if (!leadCost) continue;

    const campaignId = String(meta.metaCampaignId || "").trim();
    const campaignCpl =
      campaignId && index.campaigns.has(campaignId)
        ? formatLeadCostUsd(index.campaigns.get(campaignId)!.cpl)
        : "";

    const nextMeta = {
      ...meta,
      leadSource: source,
      leadCost,
      metaAccountCpl: formatLeadCostUsd(index.accountCpl),
      metaLeadCostSyncedAt: index.syncedAt || snapshot.synced_at || new Date().toISOString(),
      ...(campaignCpl ? { metaCampaignCpl: campaignCpl } : {}),
    };

    if (
      String(meta.leadCost || "") === leadCost &&
      String(meta.metaAccountCpl || "") === String(nextMeta.metaAccountCpl || "") &&
      String(meta.metaCampaignCpl || "") === String(nextMeta.metaCampaignCpl || "")
    ) {
      continue;
    }

    const { error: updateErr } = await admin
      .from("leads")
      .update({ metadata: nextMeta })
      .eq("id", row.id);
    if (updateErr) throw updateErr;
    updated += 1;
  }

  return { updated };
}
