"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/supabase/types";

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

  const prev =
    lead.metadata && typeof lead.metadata === "object"
      ? (lead.metadata as Record<string, unknown>)
      : {};

  await supabase
    .from("leads")
    .update({
      stage: "scheduled",
      metadata: { ...prev, jobStatus: "Scheduled" },
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

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
    const jobToSheet: Partial<Record<JobStatus, string>> = {
      assigned: "Tech confirmed",
      en_route: "En route",
      on_site: "On site",
      done: "Completed",
      cancelled: "Cancelled",
      queued: "Scheduled",
    };
    const sheetStatus = jobToSheet[status];
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
      const stageMap: Record<string, string> = {
        "Tech confirmed": "in_progress",
        "En route": "in_progress",
        "On site": "in_progress",
        Completed: "completed",
        Cancelled: "cancelled",
        Scheduled: "scheduled",
      };
      await supabase
        .from("leads")
        .update({
          stage: stageMap[sheetStatus] || undefined,
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
