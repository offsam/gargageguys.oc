import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAdsMetrics, getDefaultAdsPeriod, getMetaAdsConfig } from "@/lib/ads/meta";
import { fetchGoogleAdsMetrics, getGoogleAdsConfig } from "@/lib/ads/google";
import { upsertAdsSnapshot } from "@/lib/ads/snapshots";
import { catchUpMetaLeads } from "@/lib/leads/meta-catchup";
import { catchUpGoogleLeads } from "@/lib/leads/google-catchup";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const meta = getMetaAdsConfig();
  const google = getGoogleAdsConfig();
  if (!meta.ok && !google.canQuery) {
    return NextResponse.json(
      { error: "Meta or Google Ads credentials are required" },
      { status: 503 },
    );
  }

  const days = Number(process.env.ADS_SYNC_DAYS || 28);
  const period = getDefaultAdsPeriod(Number.isFinite(days) && days > 0 ? days : 28);

  try {
    const result: Record<string, unknown> = { ok: true, period };

    if (meta.ok) {
      const metrics = await fetchMetaAdsMetrics(period);
      const row = await upsertAdsSnapshot({
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
      let catchup: { ingested: number; skipped: number; scanned: number } | null = null;
      try {
        catchup = await catchUpMetaLeads(3);
      } catch (error) {
        console.error("[ads-sync] meta lead catch-up failed", error);
      }
      result.meta = {
        id: row.id,
        spend: metrics.spend,
        leads: metrics.leads,
        cpl: metrics.cpl,
        ingested: catchup?.ingested ?? 0,
      };
    }

    if (google.canQuery) {
      const metrics = await fetchGoogleAdsMetrics(period);
      const row = await upsertAdsSnapshot({
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
        catchup = await catchUpGoogleLeads(3);
      } catch (error) {
        console.error("[ads-sync] google lead catch-up failed", error);
      }
      result.google = {
        id: row.id,
        spend: metrics.spend,
        leads: metrics.leads,
        cpl: metrics.cpl,
        ingested: catchup?.ingested ?? 0,
        lsaLeadCount: metrics.lsaLeadCount,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ads sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
