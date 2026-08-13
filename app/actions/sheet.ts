"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { stageFromSheetStatus } from "@/lib/leads/stage-sync";

export type SheetSaveInput = {
  id: string;
  workSource: string;
  partnerName: string;
  leadSource: string;
  leadCost: string;
  date: string;
  clientName: string;
  clientAddress: string;
  jobStatus: string;
  jobType: string;
  parts: string;
  paymentType: string;
  checkNumber: string;
  jobCost: string;
  bankFee: string;
  partsCost: string;
  technician: string;
  techSalary: string;
};

function sheetMeta(input: SheetSaveInput) {
  return {
    workSource: input.workSource,
    partnerName: input.partnerName,
    leadSource: input.leadSource,
    leadCost: input.leadCost,
    sheetDate: input.date,
    clientName: input.clientName,
    clientAddress: input.clientAddress,
    jobStatus: input.jobStatus,
    jobType: input.jobType,
    parts: input.parts,
    paymentType: input.paymentType,
    checkNumber: input.checkNumber,
    jobCost: input.jobCost,
    bankFee: input.bankFee,
    partsCost: input.partsCost,
    technician: input.technician,
    techSalary: input.techSalary,
  };
}

function leadSourceForDb(input: SheetSaveInput) {
  if (/^partner$/i.test(input.workSource) || input.workSource === "Partner") {
    return input.partnerName.trim() || "Partner";
  }
  return input.leadSource || "sheet";
}

function isTempId(id: string) {
  return id.startsWith("new-");
}

function revalidateSheetSurfaces() {
  revalidatePath("/sheet");
  revalidatePath("/crm");
  revalidatePath("/dispatch");
  revalidatePath("/owner");
  revalidatePath("/field");
}

export async function saveSheetRowAction(
  input: SheetSaveInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Not signed in" };

  const hasContent = [
    input.workSource,
    input.partnerName,
    input.leadSource,
    input.leadCost,
    input.clientName,
    input.clientAddress,
    input.jobStatus,
    input.jobType,
    input.parts,
    input.paymentType,
    input.checkNumber,
    input.jobCost,
    input.bankFee,
    input.partsCost,
    input.technician,
    input.techSalary,
  ].some((v) => String(v || "").trim());

  if (!hasContent && isTempId(input.id)) {
    return { ok: true, id: input.id };
  }

  try {
    const admin = getSupabaseAdmin();
    const meta = sheetMeta(input);
    const stage = stageFromSheetStatus(input.jobStatus) || (isTempId(input.id) ? "new" : undefined);

    let assignedTo: string | null | undefined;
    if (input.technician.trim()) {
      const { data: techs } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "technician");
      const needle = input.technician.trim().toLowerCase();
      const match = (techs || []).find(
        (t) =>
          (t.full_name || "").trim().toLowerCase() === needle ||
          (t.email || "").trim().toLowerCase() === needle,
      );
      assignedTo = match?.id || null;
    } else {
      assignedTo = null;
    }

    if (isTempId(input.id)) {
      const insertPayload = {
        name: input.clientName || null,
        address: input.clientAddress || null,
        source: leadSourceForDb(input),
        lead_type: input.jobType || "sheet_row",
        message: input.jobType || input.parts || null,
        deal_title: input.jobType || null,
        deal_price: input.jobCost || null,
        stage: stage || "new",
        assigned_to: assignedTo ?? null,
        metadata: meta,
      };
      let { data, error } = await admin.from("leads").insert(insertPayload).select("id").single();

      if (error && /address/i.test(error.message)) {
        const { address: _a, ...rest } = insertPayload;
        const retry = await admin.from("leads").insert(rest).select("id").single();
        data = retry.data;
        error = retry.error;
      }

      if (error) return { ok: false, error: error.message };
      revalidateSheetSurfaces();
      return { ok: true, id: data!.id };
    }

    const { data: existing } = await admin
      .from("leads")
      .select("id, metadata")
      .eq("id", input.id)
      .maybeSingle();

    if (!existing) return { ok: false, error: "Row not found" };

    const prev =
      existing.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const update: Record<string, unknown> = {
      name: input.clientName || null,
      address: input.clientAddress || null,
      source: leadSourceForDb(input),
      lead_type: input.jobType || null,
      deal_title: input.jobType || null,
      deal_price: input.jobCost || null,
      message: input.jobType || input.parts || null,
      metadata: { ...prev, ...meta },
      updated_at: new Date().toISOString(),
    };
    if (stage) update.stage = stage;
    if (assignedTo !== undefined) update.assigned_to = assignedTo;

    let { error } = await admin.from("leads").update(update).eq("id", input.id);

    if (error && /address/i.test(error.message)) {
      const { address: _a, ...rest } = update;
      const retry = await admin.from("leads").update(rest).eq("id", input.id);
      error = retry.error;
    }

    if (error) return { ok: false, error: error.message };
    revalidateSheetSurfaces();
    return { ok: true, id: input.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function deleteSheetRowAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Not signed in" };

  if (isTempId(id)) return { ok: true };

  try {
    const admin = getSupabaseAdmin();

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("id, customer_id")
      .eq("id", id)
      .maybeSingle();

    if (leadErr) return { ok: false, error: leadErr.message };
    if (!lead) return { ok: false, error: "Row not found" };

    const customerId = lead.customer_id as string | null;

    const { data: jobs } = await admin.from("jobs").select("id").eq("lead_id", id);
    const jobIds = (jobs || []).map((j) => j.id);

    if (jobIds.length) {
      const { error: invJobErr } = await admin.from("invoices").delete().in("job_id", jobIds);
      if (invJobErr) return { ok: false, error: invJobErr.message };
    }

    const { error: invLeadErr } = await admin.from("invoices").delete().eq("lead_id", id);
    if (invLeadErr) return { ok: false, error: invLeadErr.message };

    const { error: jobsErr } = await admin.from("jobs").delete().eq("lead_id", id);
    if (jobsErr) return { ok: false, error: jobsErr.message };

    const { error: inboxErr } = await admin.from("inbox_items").delete().eq("lead_id", id);
    if (inboxErr) return { ok: false, error: inboxErr.message };

    const { error: chatErr } = await admin.from("chat_sessions").delete().eq("lead_id", id);
    if (chatErr) return { ok: false, error: chatErr.message };

    const { error: delLeadErr } = await admin.from("leads").delete().eq("id", id);
    if (delLeadErr) return { ok: false, error: delLeadErr.message };

    if (customerId) {
      const [{ count: otherLeads }, { count: otherJobs }, { count: otherInvoices }] =
        await Promise.all([
          admin
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("customer_id", customerId),
          admin
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .eq("customer_id", customerId),
          admin
            .from("invoices")
            .select("*", { count: "exact", head: true })
            .eq("customer_id", customerId),
        ]);

      if (!(otherLeads || 0) && !(otherJobs || 0) && !(otherInvoices || 0)) {
        await admin.from("customers").delete().eq("id", customerId);
      }
    }

    revalidateSheetSurfaces();
    revalidatePath("/finance");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
}
