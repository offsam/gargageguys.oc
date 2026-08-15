import { NextRequest, NextResponse } from "next/server";
import { syncGoogleReviews } from "@/lib/reviews/sync";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const result = await syncGoogleReviews();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
