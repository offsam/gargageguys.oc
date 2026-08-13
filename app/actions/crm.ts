"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeSheetStatus,
  stageFromSheetStatus,
  STATUS_TO_JOB_STATUS,
  type SheetStatus,
} from "@/lib/leads/stage-sync";
import type { LeadStage } from "@/lib/supabase/types";
import { deleteSheetRowAction, saveSheetRowAction, type SheetSaveInput } from "@/app/actions/sheet";

function revalidateCrmAndSheet() {
  revalidatePath("/crm");
  revalidatePath("/sheet");
  revalidatePath("/dispatch");
  revalidatePath("/owner");
  revalidatePath("/field");
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Create a client from CRM — same fields as Sheet, appears in both. */
export async function createCrmClientAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const phone = String(formData.get("phone") || "").trim();
  const zip = String(formData.get("zip") || "").trim();

  const input: SheetSaveInput = {
    id: `new-crm-${Date.now()}`,
    leadSource: String(formData.get("leadSource") || "").trim(),
    leadCost: String(formData.get("leadCost") || "").trim(),
    date: String(formData.get("date") || "").trim() || todayISO(),
    clientName: String(formData.get("clientName") || "").trim(),
    clientAddress: String(formData.get("clientAddress") || "").trim(),
    jobStatus: String(formData.get("jobStatus") || "").trim() || "Waiting",
    jobType: String(formData.get("jobType") || "").trim(),
    parts: String(formData.get("parts") || "").trim(),
    paymentType: String(formData.get("paymentType") || "").trim(),
    checkNumber: String(formData.get("checkNumber") || "").trim(),
    jobCost: String(formData.get("jobCost") || "").trim(),
    bankFee: String(formData.get("bankFee") || "").trim(),
    partsCost: String(formData.get("partsCost") || "").trim(),
    technician: String(formData.get("technician") || "").trim(),
    techSalary: String(formData.get("techSalary") || "").trim(),
  };

  if (!input.clientName && !phone && !input.clientAddress) {
    return { ok: false as const, error: "Name, phone, or address is required" };
  }

  const result = await saveSheetRowAction(input);
  if (!result.ok || !result.id) {
    return { ok: false as const, error: result.error || "Could not create client" };
  }

  if (phone || zip) {
    const admin = getSupabaseAdmin();
    const { data: lead } = await admin
      .from("leads")
      .select("id, metadata, phone, zip")
      .eq("id", result.id)
      .maybeSingle();
    if (lead) {
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
        .eq("id", result.id);
    }
  }

  revalidateCrmAndSheet();
  return { ok: true as const, id: result.id };
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

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("leads")
    .select("id, metadata")
    .eq("id", leadId)
    .maybeSingle();

  if (!existing) return { ok: false as const, error: "Lead not found" };

  const prev =
    existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};

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
  const mapped: Record<string, SheetStatus> = {
    new: "Waiting",
    qualified: "Waiting",
    scheduled: "Scheduled",
    in_progress: "Tech confirmed",
    completed: "Completed",
    won: "Completed",
    cancelled: "Cancelled",
    lost: "No-show",
  };
  const jobStatus = mapped[stage];
  if (!jobStatus) return;
  const next = new FormData();
  next.set("leadId", String(formData.get("leadId") || ""));
  next.set("jobStatus", jobStatus);
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
