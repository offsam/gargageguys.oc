"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import {
  fetchMetaAdsMetrics,
  fetchMetaCampaignLeads,
  getDefaultAdsPeriod,
  getMetaAdsConfig,
  type MetaLeadRow,
} from "@/lib/ads/meta";
import { upsertAdsSnapshot } from "@/lib/ads/snapshots";
import {
  snapshotFromUpsert,
  syncMetaLeadCostsFromSnapshot,
} from "@/lib/ads/meta-lead-cost";
import { ingestMetaLeadToCrm, metaLeadRowToIngest } from "@/lib/leads/meta-ingest";
import { catchUpMetaLeads } from "@/lib/leads/meta-catchup";
import { catchUpGoogleLeads } from "@/lib/leads/google-catchup";
import {
  fetchGoogleAdsMetrics,
  getGoogleAdsConfig,
} from "@/lib/ads/google";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function debugMetaAdsTokenAction() {
  const user = await getSessionUser();
  if (!user || (user.role !== "owner" && user.role !== "office")) {
    return { ok: false as const, error: "Not allowed" };
  }

  const cfg = getMetaAdsConfig();
  if (!cfg.token) return { ok: false as const, error: "META_ADS_ACCESS_TOKEN missing" };

  try {
    const url = new URL("https://graph.facebook.com/v21.0/me/permissions");
    url.searchParams.set("access_token", cfg.token);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const json = (await res.json()) as {
      data?: Array<{ permission?: string; status?: string }>;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      return { ok: false as const, error: json.error?.message || "Could not read permissions" };
    }

    const granted = (json.data || [])
      .filter((p) => p.status === "granted")
      .map((p) => String(p.permission || ""))
      .filter(Boolean)
      .sort();

    let pageTokenOk = false;
    let pageError = "";
    if (cfg.pageId) {
      try {
        const pageUrl = new URL(`https://graph.facebook.com/v21.0/${cfg.pageId}`);
        pageUrl.searchParams.set("fields", "id,name,access_token");
        pageUrl.searchParams.set("access_token", cfg.token);
        const pageRes = await fetch(pageUrl.toString(), { cache: "no-store" });
        const pageJson = (await pageRes.json()) as {
          access_token?: string;
          error?: { message?: string };
        };
        pageTokenOk = Boolean(pageJson.access_token);
        if (!pageTokenOk) pageError = pageJson.error?.message || "No page access_token returned";
      } catch (error) {
        pageError = error instanceof Error ? error.message : "Page token check failed";
      }
    }

    return {
      ok: true as const,
      granted,
      hasPagesManageAds: granted.includes("pages_manage_ads"),
      hasLeadsRetrieval: granted.includes("leads_retrieval"),
      hasAdsRead: granted.includes("ads_read"),
      pageId: cfg.pageId || null,
      pageTokenOk,
      pageError: pageError || null,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Debug failed",
    };
  }
}

export async function syncMetaAdsAction() {
  const user = await getSessionUser();
  if (!user || (user.role !== "owner" && user.role !== "office")) {
    return { ok: false as const, error: "Not allowed" };
  }

  const cfg = getMetaAdsConfig();
  if (!cfg.ok) {
    return { ok: false as const, error: "Meta Ads env not configured" };
  }

  try {
    const days = Number(process.env.ADS_SYNC_DAYS || 28);
    const period = getDefaultAdsPeriod(Number.isFinite(days) && days > 0 ? days : 28);
    const metrics = await fetchMetaAdsMetrics(period);
    await upsertAdsSnapshot({
      platform: "meta",
      period,
      accountId: metrics.accountId,
      spend: metrics.spend,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      leads: metrics.leads,
      cpl: metrics.cpl,
      metrics: {
        reach: metrics.reach,
        campaigns: metrics.campaigns,
      },
      raw: metrics.raw,
    });
    try {
      await syncMetaLeadCostsFromSnapshot(
        snapshotFromUpsert({
          platform: "meta",
          period,
          spend: metrics.spend,
          leads: metrics.leads,
          cpl: metrics.cpl,
          metrics: { campaigns: metrics.campaigns },
        }),
      );
    } catch (error) {
      console.error("[ads-sync] meta lead-cost refresh failed", error);
    }
    let catchup: { ingested: number; skipped: number; scanned: number } | null = null;
    try {
      catchup = await catchUpMetaLeads(7);
    } catch (error) {
      console.error("[ads-sync] lead catch-up failed", error);
    }

    revalidatePath("/ads");
    revalidatePath("/serm");
    revalidatePath("/owner");
    revalidatePath("/crm");
    revalidatePath("/dispatch");
    revalidatePath("/sheet");
    return {
      ok: true as const,
      spend: metrics.spend,
      leads: metrics.leads,
      cpl: metrics.cpl,
      campaigns: metrics.campaigns.length,
      ingested: catchup?.ingested ?? 0,
      catchupScanned: catchup?.scanned ?? 0,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

export async function loadMetaCampaignLeadsAction(campaignId: string): Promise<{
  ok: boolean;
  error?: string;
  leads?: Array<
    MetaLeadRow & {
      inCrm: boolean;
      crmLeadId?: string;
      crmStage?: string;
    }
  >;
}> {
  const user = await getSessionUser();
  if (!user || (user.role !== "owner" && user.role !== "office")) {
    return { ok: false, error: "Not allowed" };
  }
  if (!campaignId) return { ok: false, error: "Pick a campaign" };

  try {
    const days = Number(process.env.ADS_SYNC_DAYS || 28);
    const period = getDefaultAdsPeriod(Number.isFinite(days) && days > 0 ? days : 28);
    const leads = await fetchMetaCampaignLeads(campaignId, period);

    const admin = getSupabaseAdmin();
    const { data: crmRows } = await admin
      .from("leads")
      .select("id, name, phone, stage, source, metadata")
      .order("created_at", { ascending: false })
      .limit(800);

    const byLeadgen = new Map<string, { id: string; stage: string }>();
    const byPhone = new Map<string, { id: string; stage: string }>();
    for (const row of crmRows || []) {
      const meta = (row.metadata || {}) as Record<string, unknown>;
      const leadgen = String(meta.metaLeadgenId || "").trim();
      if (leadgen) byLeadgen.set(leadgen, { id: row.id, stage: String(row.stage || "") });
      const digits = String(row.phone || "").replace(/\D/g, "");
      if (digits.length >= 10) {
        byPhone.set(digits.slice(-10), { id: row.id, stage: String(row.stage || "") });
      }
    }

    const enriched = leads.map((lead) => {
      const phoneDigits = lead.phone.replace(/\D/g, "");
      const hit =
        byLeadgen.get(lead.id) ||
        (phoneDigits.length >= 10 ? byPhone.get(phoneDigits.slice(-10)) : undefined);
      return {
        ...lead,
        inCrm: Boolean(hit),
        crmLeadId: hit?.id,
        crmStage: hit?.stage,
      };
    });

    return { ok: true, leads: enriched };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not load leads",
    };
  }
}

/** Import a Meta lead into CRM/Sheet if not already present. */
export async function importMetaLeadAction(lead: MetaLeadRow) {
  const user = await getSessionUser();
  if (!user || (user.role !== "owner" && user.role !== "office")) {
    return { ok: false as const, error: "Not allowed" };
  }
  if (!lead.phone) return { ok: false as const, error: "Lead has no phone" };

  try {
    const created = await ingestMetaLeadToCrm(metaLeadRowToIngest(lead));
    return { ok: true as const, leadId: created.leadId, duplicate: created.duplicate };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Import failed",
    };
  }
}

export async function debugGoogleAdsAction() {
  const user = await getSessionUser();
  if (!user || (user.role !== "owner" && user.role !== "office")) {
    return { ok: false as const, error: "Not allowed" };
  }
  const cfg = getGoogleAdsConfig();
  return {
    ok: true as const,
    hasApiKey: cfg.hasApiKey,
    hasDeveloperToken: Boolean(cfg.developerToken),
    hasCustomerId: Boolean(cfg.customerId),
    hasRefreshToken: Boolean(cfg.refreshToken),
    hasOAuthClient: Boolean(cfg.clientId && cfg.clientSecret),
    hasWebhookKey: Boolean(cfg.webhookKey),
    customerId: cfg.customerId || null,
    canQuery: cfg.canQuery,
    missing: cfg.missing,
    connectUrl: "/api/auth/google-ads",
    leadWebhook: "/api/ads/google-leads",
  };
}

export async function syncGoogleAdsAction() {
  const user = await getSessionUser();
  if (!user || (user.role !== "owner" && user.role !== "office")) {
    return { ok: false as const, error: "Not allowed" };
  }
  const cfg = getGoogleAdsConfig();
  if (!cfg.hasApiKey) {
    return { ok: false as const, error: "GOOGLE_CLOUD_API_KEY missing in Vercel" };
  }
  if (!cfg.canQuery) {
    return {
      ok: false as const,
      error: `Google Ads needs: ${cfg.missing.filter((m) => m !== "GOOGLE_CLOUD_API_KEY").join(", ")}`,
    };
  }

  try {
    const days = Number(process.env.ADS_SYNC_DAYS || 28);
    const period = getDefaultAdsPeriod(Number.isFinite(days) && days > 0 ? days : 28);
    const metrics = await fetchGoogleAdsMetrics(period);
    await upsertAdsSnapshot({
      platform: "google_ads",
      period,
      accountId: metrics.accountId,
      spend: metrics.spend,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      leads: metrics.leads,
      cpl: metrics.cpl,
      metrics: {
        campaigns: metrics.campaigns,
        lsaLeadCount: metrics.lsaLeadCount,
      },
      raw: metrics.raw,
    });
    let catchup: { ingested: number; skipped: number; scanned: number } | null = null;
    try {
      catchup = await catchUpGoogleLeads(7);
    } catch (error) {
      console.error("[google-ads-sync] lead catch-up failed", error);
    }
    revalidatePath("/ads");
    revalidatePath("/crm");
    revalidatePath("/owner");
    return {
      ok: true as const,
      spend: metrics.spend,
      leads: metrics.leads,
      cpl: metrics.cpl,
      campaigns: metrics.campaigns.length,
      ingested: catchup?.ingested ?? 0,
      lsaLeadCount: metrics.lsaLeadCount,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Google Ads sync failed",
    };
  }
}
