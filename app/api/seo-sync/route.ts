import { NextRequest, NextResponse } from "next/server";
import {
  fetchGa4Metrics,
  fetchSearchConsoleMetrics,
  getDefaultPeriod,
} from "@/lib/google-seo";
import { upsertSeoSnapshot } from "@/lib/seo/snapshots";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const siteUrl = process.env.GSC_SITE_URL?.trim() || "sc-domain:garageguysoc.com";
  const ga4PropertyId = process.env.GA4_PROPERTY_ID?.trim() || "";
  const period = getDefaultPeriod(Number(process.env.SEO_SYNC_DAYS || 28));

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "GOOGLE_SERVICE_ACCOUNT_JSON is not configured" },
      { status: 503 },
    );
  }

  const tasks: Promise<Record<string, unknown>>[] = [
    fetchSearchConsoleMetrics(siteUrl, period).then((searchConsole) => ({ searchConsole })),
  ];
  if (ga4PropertyId) {
    tasks.push(fetchGa4Metrics(ga4PropertyId, period).then((ga4) => ({ ga4 })));
  }

  const chunks = await Promise.all(tasks);
  const merged = Object.assign({}, ...chunks) as {
    searchConsole?: Record<string, unknown>;
    ga4?: Record<string, unknown>;
  };

  if (!merged.searchConsole && !merged.ga4) {
    return NextResponse.json({ error: "No SEO metrics fetched" }, { status: 502 });
  }

  const payload = {
    period,
    source: "garageguysoc.com",
    syncedAt: new Date().toISOString(),
    searchConsole: merged.searchConsole,
    ga4: merged.ga4,
  };

  const row = await upsertSeoSnapshot(payload);

  return NextResponse.json({
    ok: true,
    period,
    snapshotId: row.id,
    hasSearchConsole: Boolean(merged.searchConsole),
    hasGa4: Boolean(merged.ga4),
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    console.error("[seo-sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SEO sync failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
