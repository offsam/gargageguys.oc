"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/supabase/types";
import { JOB_STATUS_TO_SHEET, stageFromSheetStatus } from "@/lib/leads/stage-sync";

export async function createJobFromLeadAction(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  if (!leadId) return;
  const supabase = await createSupabaseServerClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return;

  await supabase.from("jobs").insert({
    lead_id: lead.id,
    customer_id: lead.customer_id,
    title: `${lead.name || "Job"} — ${lead.zip || ""}`.trim(),
    status: "queued",
    zip: lead.zip,
    notes: lead.message,
  });

  revalidatePath("/dispatch");
  revalidatePath("/field");
  revalidatePath("/crm");
  revalidatePath("/sheet");
}

export async function assignJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "");
  const technicianId = String(formData.get("technicianId") || "") || null;
  if (!jobId) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("jobs")
    .update({
      technician_id: technicianId,
      status: technicianId ? "assigned" : "queued",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  revalidatePath("/dispatch");
  revalidatePath("/field");
}

export async function updateJobStatusAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "");
  const status = String(formData.get("status") || "") as JobStatus;
  if (!jobId || !status) return;
  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, lead_id")
    .eq("id", jobId)
    .maybeSingle();

  await supabase
    .from("jobs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (job?.lead_id) {
    const sheetStatus = JOB_STATUS_TO_SHEET[status];
    if (sheetStatus) {
      const { data: lead } = await supabase
        .from("leads")
        .select("metadata")
        .eq("id", job.lead_id)
        .maybeSingle();
      const prev =
        lead?.metadata && typeof lead.metadata === "object"
          ? (lead.metadata as Record<string, unknown>)
          : {};
      await supabase
        .from("leads")
        .update({
          stage: stageFromSheetStatus(sheetStatus),
          metadata: { ...prev, jobStatus: sheetStatus },
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.lead_id);
    }
  }

  revalidatePath("/dispatch");
  revalidatePath("/field");
  revalidatePath("/owner");
  revalidatePath("/crm");
  revalidatePath("/sheet");
}
