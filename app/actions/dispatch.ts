"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { JobStatus } from "@/lib/supabase/types";
import { JOB_STATUS_TO_SHEET, stageFromSheetStatus } from "@/lib/leads/stage-sync";
import { notifyTechnicianJobAssigned } from "@/lib/notify/tech-job";
import { SCHEDULE_WINDOWS } from "@/lib/schedule/windows";
import { dayKeyInBusinessTz, timeHmInBusinessTz } from "@/lib/datetime";
import { isValidFieldAdvance, nextFieldStatus } from "@/lib/field/job-status";
import { getSessionUser } from "@/lib/auth/session";

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
  const { data: job } = await supabase
    .from("jobs")
    .select("id, lead_id, title, address, zip, scheduled_start, scheduled_end")
    .eq("id", jobId)
    .maybeSingle();

  await supabase
    .from("jobs")
    .update({
      technician_id: technicianId,
      status: technicianId ? "assigned" : "queued",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (technicianId && job) {
    let phone = "";
    let clientName = job.title || "Client";
    let service = "";
    if (job.lead_id) {
      const admin = getSupabaseAdmin();
      const { data: lead } = await admin
        .from("leads")
        .select("name, phone, metadata")
        .eq("id", job.lead_id)
        .maybeSingle();
      if (lead?.name) clientName = lead.name;
      if (lead?.phone) phone = lead.phone;
      const meta =
        lead?.metadata && typeof lead.metadata === "object"
          ? (lead.metadata as Record<string, unknown>)
          : {};
      if (typeof meta.service === "string") service = meta.service;
    }
    const start = job.scheduled_start ? new Date(job.scheduled_start) : null;
    const localDate =
      start && !Number.isNaN(start.getTime()) ? dayKeyInBusinessTz(start) : "";
    const localTime =
      start && !Number.isNaN(start.getTime()) ? timeHmInBusinessTz(start) : "";
    const startHour = localTime ? Number(localTime.slice(0, 2)) : NaN;
    const windowLabel =
      start && !Number.isNaN(start.getTime())
        ? SCHEDULE_WINDOWS.find((w) => w.startHour === startHour)?.label || localTime
        : "";
    void notifyTechnicianJobAssigned({
      technicianId,
      clientName,
      address: job.address,
      zip: job.zip,
      phone,
      date: localDate,
      timeLabel: windowLabel,
      service,
    }).catch((err) => console.error("[assignJobAction] telegram", err));
  }

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
  revalidatePath(`/field/jobs/${jobId}`);
  revalidatePath("/crm");
  revalidatePath("/sheet");
}

async function applyJobStatus(jobId: string, status: JobStatus) {
  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, lead_id, status, technician_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false as const, error: "Job not found" };

  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (
    session.role === "technician" &&
    job.technician_id &&
    job.technician_id !== session.id
  ) {
    return { ok: false as const, error: "Not your job" };
  }

  const { error } = await supabase
    .from("jobs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) return { ok: false as const, error: error.message };

  if (job.lead_id) {
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
  revalidatePath(`/field/jobs/${jobId}`);
  revalidatePath("/crm");
  revalidatePath("/sheet");
  return { ok: true as const, status };
}

/** Tech presses one button → only the next status in the Field flow. */
export async function advanceJobStatusAction(jobId: string) {
  const id = String(jobId || "").trim();
  if (!id) return { ok: false as const, error: "Missing job" };

  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!job) return { ok: false as const, error: "Job not found" };

  const next = nextFieldStatus(String(job.status || ""));
  if (!next || !isValidFieldAdvance(String(job.status || ""), next)) {
    return { ok: false as const, error: "No next step for this job" };
  }

  return applyJobStatus(id, next);
}

export async function cancelJobStatusAction(jobId: string) {
  const id = String(jobId || "").trim();
  if (!id) return { ok: false as const, error: "Missing job" };
  return applyJobStatus(id, "cancelled");
}
