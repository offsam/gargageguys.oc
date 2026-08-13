import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureStockSeeded } from "@/lib/stock/store";
import { buildAttentionItems } from "@/lib/field/attention";
import type { FieldJob } from "@/lib/field/days";

export async function getFieldAttentionCount(technicianId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const [{ data: jobsRaw }, stock] = await Promise.all([
    supabase.from("jobs").select("*").eq("technician_id", technicianId).limit(300),
    ensureStockSeeded(technicianId),
  ]);
  return buildAttentionItems({
    jobs: (jobsRaw || []) as FieldJob[],
    stock,
    technicianId,
  }).length;
}
