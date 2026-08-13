"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/supabase/types";

export async function updateLeadStageAction(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  const stage = String(formData.get("stage") || "") as LeadStage;
  if (!leadId || !stage) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("leads")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  revalidatePath("/crm");
  revalidatePath("/dispatch");
  revalidatePath("/owner");
}

export async function updateInboxStatusAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as
    | "new"
    | "reviewed"
    | "done"
    | "ignored";
  if (!id || !status) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("inbox_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/crm");
  revalidatePath("/owner");
}
