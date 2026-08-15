import { NextRequest, NextResponse } from "next/server";
import { catchUpMetaLeads } from "@/lib/leads/meta-catchup";
import { getMetaAdsConfig } from "@/lib/ads/meta";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  if (!getMetaAdsConfig().ok) {
    return NextResponse.json({ error: "Meta Ads env not configured" }, { status: 503 });
  }

  try {
    const result = await catchUpMetaLeads(3);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Catch-up failed" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
