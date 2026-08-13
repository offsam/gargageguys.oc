import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type SeoMetricsPayload = {
  period: { startDate: string; endDate: string };
  source?: string;
  searchConsole?: Record<string, unknown>;
  ga4?: Record<string, unknown>;
  syncedAt?: string;
};

export async function upsertSeoSnapshot(payload: SeoMetricsPayload) {
  const supabase = getSupabaseAdmin();
  const periodStart = payload.period.startDate;
  const periodEnd = payload.period.endDate;

  const { data, error } = await supabase
    .from("seo_snapshots")
    .upsert(
      {
        period_start: periodStart,
        period_end: periodEnd,
        source: payload.source || "seo-sync",
        search_console: payload.searchConsole || null,
        ga4: payload.ga4 || null,
        synced_at: payload.syncedAt || new Date().toISOString(),
      },
      { onConflict: "period_start,period_end" },
    )
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function listSeoSnapshots(limit = 12) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("seo_snapshots")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
