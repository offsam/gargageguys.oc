import { NextRequest, NextResponse } from "next/server";
import { upsertSeoSnapshot, type SeoMetricsPayload } from "@/lib/seo/snapshots";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const secret = process.env.SEO_INGEST_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "SEO_INGEST_SECRET / CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SeoMetricsPayload;
  try {
    body = (await request.json()) as SeoMetricsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.period?.startDate || !body?.period?.endDate) {
    return NextResponse.json({ error: "period.startDate and period.endDate required" }, { status: 400 });
  }

  try {
    const row = await upsertSeoSnapshot(body);
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    console.error("[seo-metrics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 500 },
    );
  }
}
