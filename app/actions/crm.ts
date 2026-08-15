"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeSheetStatus,
  stageFromSheetStatus,
  sheetStatusFromLead,
  STATUS_TO_JOB_STATUS,
  STAGE_TO_STATUS,
  completeBlockedReason,
  type SheetStatus,
} from "@/lib/leads/stage-sync";
import { parseLocalDateTime } from "@/lib/datetime";
import type { LeadStage } from "@/lib/supabase/types";
import { deleteSheetRowAction, saveSheetRowAction, type SheetSaveInput } from "@/app/actions/sheet";
import { ensureJobInvoice } from "@/lib/field/job-invoice";

function revalidateCrmAndSheet() {
  revalidatePath("/crm");
  revalidatePath("/clients");
  revalidatePath("/sheet");
  revalidatePath("/dispatch");
  revalidatePath("/owner");
  revalidatePath("/field");
  revalidatePath("/finance");
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function crmSheetInput(formData: FormData, id: string, jobStatus: string): SheetSaveInput {
  return {
    id,
    workSource: String(formData.get("workSource") || "").trim() || "Garage Guys",
    partnerName: String(formData.get("partnerName") || "").trim(),
    leadSource: String(formData.get("leadSource") || "").trim(),
    leadCost: String(formData.get("leadCost") || "").trim(),
    date: String(formData.get("date") || "").trim() || todayISO(),
    clientName: String(formData.get("clientName") || "").trim(),
    clientAddress: String(formData.get("clientAddress") || "").trim(),
    jobStatus,
    jobType: String(formData.get("jobType") || "").trim(),
    service: String(formData.get("service") || "").trim(),
    parts: String(formData.get("parts") || "").trim(),
    paymentType: String(formData.get("paymentType") || "").trim(),
    checkNumber: String(formData.get("checkNumber") || "").trim(),
    jobCost: String(formData.get("jobCost") || "").trim(),
    bankFee: String(formData.get("bankFee") || "").trim(),
    partsCost: String(formData.get("partsCost") || "").trim(),
    technician: String(formData.get("technician") || "").trim(),
    techSalary: String(formData.get("techSalary") || "").trim(),
    description: String(formData.get("description") || "").trim(),
  };
}

async function patchLeadPhoneZip(leadId: string, phone: string, zip: string) {
  if (!phone && !zip) return;
  const admin = getSupabaseAdmin();
  const { data: lead } = await admin
    .from("leads")
    .select("id, metadata, phone, zip")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return;
  const prev =
    lead.metadata && typeof lead.metadata === "object"
      ? (lead.metadata as Record<string, unknown>)
      : {};
  await admin
    .from("leads")
    .update({
      phone: phone || lead.phone || null,
      zip: zip || lead.zip || null,
      metadata: { ...prev, phone: phone || prev.phone || "", zip: zip || prev.zip || "" },
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
}

/** Create a client from CRM — same fields as Sheet, appears in both. */
export async function createCrmClientAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const phone = String(formData.get("phone") || "").trim();
  const zip = String(formData.get("zip") || "").trim();
  const rawStatus = String(formData.get("jobStatus") || "").trim() || "Waiting";
  const jobStatus = rawStatus === "Scheduled" ? "Waiting" : rawStatus;
  const input = crmSheetInput(formData, `new-crm-${Date.now()}`, jobStatus);

  if (!input.clientName && !phone && !input.clientAddress) {
    return { ok: false as const, error: "Name, phone, or address is required" };
  }

  const result = await saveSheetRowAction(input);
  if (!result.ok || !result.id) {
    return { ok: false as const, error: result.error || "Could not create client" };
  }

  await patchLeadPhoneZip(result.id, phone, zip);
  revalidateCrmAndSheet();
  return { ok: true as const, id: result.id };
}

/** Save Sheet fields from a CRM card double-click. */
export async function updateCrmClientAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const leadId = String(formData.get("leadId") || "").trim();
  if (!leadId) return { ok: false as const, error: "Missing client" };

  const phone = String(formData.get("phone") || "").trim();
  const zip = String(formData.get("zip") || "").trim();
  const jobStatus = String(formData.get("jobStatus") || "").trim() || "Waiting";

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("leads")
    .select("id, metadata, stage")
    .eq("id", leadId)
    .maybeSingle();
  if (!existing) return { ok: false as const, error: "Lead not found" };

  const prevStatus = sheetStatusFromLead({ stage: existing.stage, metadata: existing.metadata });
  if (jobStatus === "Scheduled" && prevStatus !== "Scheduled") {
    return { ok: false as const, error: "Pick time and technician from the card status menu" };
  }

  const input = crmSheetInput(formData, leadId, jobStatus);
  const result = await saveSheetRowAction(input);
  if (!result.ok) {
    return { ok: false as const, error: result.error || "Could not save client" };
  }

  await patchLeadPhoneZip(leadId, phone, zip);
  revalidateCrmAndSheet();
  return { ok: true as const, id: leadId };
}

/** Move a lead in the CRM funnel — keeps Sheet Status (+ linked jobs) in sync. */
export async function updateLeadJobStatusAction(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  const rawStatus = String(formData.get("jobStatus") || "").trim();
  const jobStatus = normalizeSheetStatus(rawStatus);
  if (!leadId || !jobStatus) {
    return { ok: false as const, error: "Invalid status" };
  }

  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };

  if (jobStatus === "Scheduled") {
    return { ok: false as const, error: "Pick time and technician first" };
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("leads")
    .select("id, metadata, deal_price")
    .eq("id", leadId)
    .maybeSingle();

  if (!existing) return { ok: false as const, error: "Lead not found" };

  const prev =
    existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const blocked = completeBlockedReason(
    jobStatus,
    prev.jobCost,
    prev.job_cost,
    existing.deal_price,
  );
  if (blocked) return { ok: false as const, error: blocked };

  const stage = stageFromSheetStatus(jobStatus) as LeadStage;
  const { error } = await admin
    .from("leads")
    .update({
      stage,
      updated_at: new Date().toISOString(),
      metadata: { ...prev, jobStatus },
    })
    .eq("id", leadId);

  if (error) return { ok: false as const, error: error.message };

  const linkedJobStatus = STATUS_TO_JOB_STATUS[jobStatus];
  if (linkedJobStatus) {
    await admin
      .from("jobs")
      .update({ status: linkedJobStatus, updated_at: new Date().toISOString() })
      .eq("lead_id", leadId)
      .neq("status", "cancelled");
  }

  revalidateCrmAndSheet();
  return { ok: true as const, jobStatus };
}

export async function scheduleCrmLeadAction(formData: FormData) {
  const leadId = String(formData.get("leadId") || "").trim();
  const technicianId = String(formData.get("technicianId") || "").trim();
  const start = parseLocalDateTime(String(formData.get("startAt") || ""));
  const endRaw = parseLocalDateTime(String(formData.get("endAt") || ""));

  if (!leadId) return { ok: false as const, error: "Missing lead" };
  if (!technicianId) return { ok: false as const, error: "Pick a technician" };
  if (!start) return { ok: false as const, error: "Pick a start time" };

  const end =
    endRaw && endRaw.getTime() > start.getTime()
      ? endRaw
      : new Date(start.getTime() + 60 * 60 * 1000);

  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const admin = getSupabaseAdmin();
  const [{ data: lead }, { data: tech }] = await Promise.all([
    admin.from("leads").select("*").eq("id", leadId).maybeSingle(),
    admin.from("profiles").select("id, full_name, email").eq("id", technicianId).maybeSingle(),
  ]);

  if (!lead) return { ok: false as const, error: "Lead not found" };
  if (!tech) return { ok: false as const, error: "Technician not found" };

  const techName = tech.full_name || tech.email || "Technician";
  const prev =
    lead.metadata && typeof lead.metadata === "object"
      ? (lead.metadata as Record<string, unknown>)
      : {};
  const address =
    (typeof (lead as { address?: string | null }).address === "string"
      ? (lead as { address?: string | null }).address
      : "") ||
    String(prev.clientAddress || prev.address || "").trim();
  const zip = lead.zip || String(prev.zip || "").trim() || null;
  const title = `${lead.name || "Job"}${zip ? ` — ${zip}` : ""}`.trim();

  const { error: leadErr } = await admin
    .from("leads")
    .update({
      stage: "scheduled",
      assigned_to: technicianId,
      scheduled_at: start.toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        ...prev,
        jobStatus: "Scheduled",
        technician: techName,
        sheetDate: start.toISOString().slice(0, 10),
      },
    })
    .eq("id", leadId);

  if (leadErr) return { ok: false as const, error: leadErr.message };

  const { data: existingJobs } = await admin
    .from("jobs")
    .select("id")
    .eq("lead_id", leadId)
    .neq("status", "cancelled")
    .limit(1);

  const existingJobId = existingJobs?.[0]?.id;
  const jobPayload = {
    technician_id: technicianId,
    title,
    status: "assigned" as const,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    address: address || null,
    zip,
    notes: lead.message || null,
    updated_at: new Date().toISOString(),
  };

  let jobId = existingJobId || "";
  if (existingJobId) {
    const { error: jobErr } = await admin.from("jobs").update(jobPayload).eq("id", existingJobId);
    if (jobErr) return { ok: false as const, error: jobErr.message };
  } else {
    const { data: created, error: jobErr } = await admin
      .from("jobs")
      .insert({
        ...jobPayload,
        lead_id: leadId,
        customer_id: lead.customer_id,
      })
      .select("id")
      .single();
    if (jobErr || !created) {
      return { ok: false as const, error: jobErr?.message || "Could not create job" };
    }
    jobId = created.id;
  }

  try {
    await ensureJobInvoice({ jobId, createdBy: session.id });
  } catch (err) {
    console.error("[scheduleCrmLeadAction] invoice", err);
  }

  revalidateCrmAndSheet();
  return {
    ok: true as const,
    jobStatus: "Scheduled" as const,
    technician: techName,
    date: start.toISOString().slice(0, 10),
  };
}

export async function deleteCrmLeadAction(leadId: string) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!leadId.trim()) return { ok: false as const, error: "Missing lead" };

  const result = await deleteSheetRowAction(leadId.trim());
  if (!result.ok) return { ok: false as const, error: result.error || "Delete failed" };
  revalidateCrmAndSheet();
  return { ok: true as const };
}

/** @deprecated use updateLeadJobStatusAction — kept for old forms */
export async function updateLeadStageAction(formData: FormData) {
  const stage = String(formData.get("stage") || "");
  const jobStatus = STAGE_TO_STATUS[stage];
  if (!jobStatus) return;
  const next = new FormData();
  next.set("leadId", String(formData.get("leadId") || ""));
  next.set("jobStatus", jobStatus);
  if (jobStatus === "Scheduled") return;
  await updateLeadJobStatusAction(next);
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
