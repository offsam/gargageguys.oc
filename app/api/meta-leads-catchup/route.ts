import { NextRequest, NextResponse } from "next/server";
import { catchUpMetaLeads } from "@/lib/leads/meta-catchup";
import { getMetaAdsConfig } from "@/lib/ads/meta";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) return true;
  }
  return request.headers.get("x-vercel-cron") === "1";
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
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
