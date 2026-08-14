import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { renumberAllJobNumbers } from "@/lib/field/job-number-assign";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${cronSecret}`;
}

/** One-shot: rewrite every job # to GGYY-MM### (month from job created_at, LA). */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  try {
    const result = await renumberAllJobNumbers();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Renumber failed" },
      { status: 500 },
    );
  }
}
