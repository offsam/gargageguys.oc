"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { stageFromSheetStatus, completeBlockedReason, normalizeSheetStatus, sheetStatusFromLead } from "@/lib/leads/stage-sync";
import { isOwnWork, isPartnerWork } from "@/lib/sheet/work-source";
import { listPartnersAction } from "@/app/actions/partners";
import { parseSheetStockPulls, syncSheetPartStock } from "@/lib/stock/ops";
import { parseInvoiceLines } from "@/lib/field/job-invoice-types";
import { parsePartsLines } from "@/lib/sheet/parts-lines";
import { ensureLeadWorkOrder } from "@/lib/field/job-invoice";
import { formatJobNumber } from "@/lib/field/job-invoice-types";
import {
  normalizeSheetTime,
  shouldSyncSheetStatusToJob,
  syncSheetLeadToFieldJob,
} from "@/lib/sheet/sync-job-from-sheet";

export type SheetSaveInput = {
  id: string;
  workSource: string;
  partnerName: string;
  leadSource: string;
  leadCost: string;
  date: string;
  time: string;
  clientName: string;
  clientAddress: string;
  jobStatus: string;
  jobType: string;
  service: string;
  parts: string;
  paymentType: string;
  checkNumber: string;
  jobCost: string;
  bankFee: string;
  partsCost: string;
  technician: string;
  techSalary: string;
  description: string;
};

function sheetMeta(input: SheetSaveInput) {
  const partsLines = parsePartsLines(undefined, input.parts);
  return {
    workSource: input.workSource,
    partnerName: input.partnerName,
    leadSource: input.leadSource,
    leadCost: input.leadCost,
    sheetDate: input.date,
    sheetTime: normalizeSheetTime(input.time),
    clientName: input.clientName,
    clientAddress: input.clientAddress,
    jobStatus: input.jobStatus,
    jobType: input.jobType,
    issue: input.jobType,
    service: input.service,
    parts: input.parts,
    partsLines,
    paymentType: input.paymentType,
    checkNumber: input.checkNumber,
    jobCost: input.jobCost,
    bankFee: input.bankFee,
    partsCost: input.partsCost,
    technician: input.technician,
    techSalary: input.techSalary,
    description: input.description,
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

async function fieldInvoiceAlreadyHasParts(leadId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data: jobs } = await admin.from("jobs").select("id").eq("lead_id", leadId);
  if (!jobs?.length) return false;
  const { data: invoices } = await admin
    .from("job_invoices")
    .select("lines")
    .in(
      "job_id",
      jobs.map((j) => j.id),
    );
  for (const inv of invoices || []) {
    if (parseInvoiceLines(inv.lines).some((line) => line.kind === "part" && line.qty > 0)) {
      return true;
    }
  }
  return false;
}

async function resolveTechnicianId(technicianName: string): Promise<string | undefined> {
  const needle = technicianName.trim().toLowerCase();
  if (!needle) return undefined;
  const admin = getSupabaseAdmin();
  const { data: techs } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "technician");
  const match = (techs || []).find(
    (t) =>
      (t.full_name || "").trim().toLowerCase() === needle ||
      (t.email || "").trim().toLowerCase() === needle,
  );
  return match?.id;
}

/**
 * Deduct stock only when the Sheet row is Completed.
 * Skip if Field already added parts on the invoice (avoid double pull).
 * GG → our warehouse/vans; partner with own stock → their warehouse/vans; else GG stock.
 */
async function syncPartnerSheetStock(input: {
  leadId: string;
  workSource: string;
  partnerName: string;
  parts: string;
  jobStatus: string;
  technician: string;
  prevMeta: Record<string, unknown>;
  createdBy: string;
}): Promise<{ ok: true; deducted: boolean } | { ok: false; error: string }> {
  const lines = parsePartsLines(undefined, input.parts);
  let owner: "none" | "gg" | string = "none";
  const completed = normalizeSheetStatus(input.jobStatus) === "Completed";
  if (completed && lines.length) {
    const fieldDidParts = await fieldInvoiceAlreadyHasParts(input.leadId);
    if (!fieldDidParts) {
      if (isPartnerWork(input.workSource) && input.partnerName.trim()) {
        const partners = await listPartnersAction();
        const match = partners.find(
          (p) => p.name.trim().toLowerCase() === input.partnerName.trim().toLowerCase(),
        );
        owner =
          match?.has_own_stock && !match.id.startsWith("seed-") ? match.id : "gg";
      } else if (isOwnWork(input.workSource)) {
        owner = "gg";
      }
    }
  }

  const technicianId = await resolveTechnicianId(input.technician);
  const prevPulls = parseSheetStockPulls(
    input.prevMeta.stockPulls ?? input.prevMeta.stockPull,
  );
  const { pull, pulls, error } = await syncSheetPartStock({
    lines: completed ? lines : [],
    owner: completed ? owner : "none",
    prevPulls,
    leadId: input.leadId,
    createdBy: input.createdBy,
    technicianId,
  });
  if (error) return { ok: false, error };

  const admin = getSupabaseAdmin();
  const { data: lead } = await admin
    .from("leads")
    .select("metadata")
    .eq("id", input.leadId)
    .maybeSingle();
  const meta =
    lead?.metadata && typeof lead.metadata === "object"
      ? (lead.metadata as Record<string, unknown>)
      : {};
  await admin
    .from("leads")
    .update({
      metadata: { ...meta, stockPull: pull, stockPulls: pulls },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.leadId);

  return { ok: true, deducted: pulls.length > 0 && completed };
}

function revalidateSheetSurfaces() {
  revalidatePath("/sheet");
  revalidatePath("/crm");
  revalidatePath("/clients");
  revalidatePath("/dispatch");
  revalidatePath("/owner");
  revalidatePath("/field");
}

/** Soft revalidate — skip /sheet so the live grid isn't yanked mid-edit. */
function revalidateRelatedSurfaces() {
  revalidatePath("/crm");
  revalidatePath("/clients");
  revalidatePath("/dispatch");
  revalidatePath("/owner");
  revalidatePath("/field");
  revalidatePath("/stock");
}

async function workOrderNumber(leadId: string): Promise<string> {
  try {
    const wo = await ensureLeadWorkOrder({ leadId });
    const label = formatJobNumber(wo.jobNumber);
    return label === "—" ? "" : label;
  } catch {
    return "";
  }
}

async function syncFieldJobFromSheetSave(
  leadId: string,
  input: SheetSaveInput,
  assignedTo: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!shouldSyncSheetStatusToJob(input.jobStatus)) return { ok: true };
  if (!input.date.trim()) return { ok: true };

  const admin = getSupabaseAdmin();
  const { data: lead } = await admin
    .from("leads")
    .select("id, name, address, zip, message, customer_id")
    .eq("id", leadId)
    .maybeSingle();

  const result = await syncSheetLeadToFieldJob({
    leadId,
    date: input.date,
    time: input.time,
    technicianId: assignedTo || undefined,
    technicianName: input.technician,
    jobStatus: input.jobStatus,
    clientName: input.clientName || lead?.name || "",
    clientAddress: input.clientAddress || lead?.address || "",
    zip: lead?.zip || null,
    notes: lead?.message || input.description || null,
    customerId: lead?.customer_id || null,
  });
  if (!result.ok) return result;
  return { ok: true };
}

export async function saveSheetRowAction(
  input: SheetSaveInput,
  opts?: { silent?: boolean },
): Promise<{
  ok: boolean;
  id?: string;
  error?: string;
  jobNumber?: string;
  jobStatus?: string;
}> {
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
    input.service,
    input.parts,
    input.paymentType,
    input.checkNumber,
    input.jobCost,
    input.bankFee,
    input.partsCost,
    input.technician,
    input.techSalary,
    input.description,
  ].some((v) => String(v || "").trim());

  if (!hasContent && isTempId(input.id)) {
    return { ok: true, id: input.id };
  }

  const blocked = completeBlockedReason(input.jobStatus, input.jobCost);
  if (blocked) return { ok: false, error: blocked };

  const requestedStatus = normalizeSheetStatus(input.jobStatus);
  if (requestedStatus === "Scheduled" && isTempId(input.id)) {
    const canInlineSchedule =
      Boolean(input.date.trim()) &&
      Boolean(normalizeSheetTime(input.time)) &&
      Boolean(input.technician.trim());
    if (!canInlineSchedule) {
      return {
        ok: false,
        error: "Pick time and technician to schedule",
        jobStatus: "Waiting",
      };
    }
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
      try {
        const stock = await syncPartnerSheetStock({
          leadId: data!.id,
          workSource: input.workSource,
          partnerName: input.partnerName,
          parts: input.parts,
          jobStatus: input.jobStatus,
          technician: input.technician,
          prevMeta: {},
          createdBy: session.id,
        });
        if (!stock.ok) {
          return { ok: false, error: stock.error, id: data!.id };
        }
      } catch (err) {
        return {
          ok: false,
          id: data!.id,
          error: err instanceof Error ? err.message : "Stock update failed",
        };
      }
      const fieldSync = await syncFieldJobFromSheetSave(data!.id, input, assignedTo);
      if (!fieldSync.ok) {
        return { ok: false, id: data!.id, error: fieldSync.error };
      }
      const jobNumber = await workOrderNumber(data!.id);
      if (!opts?.silent) revalidateRelatedSurfaces();
      return { ok: true, id: data!.id, jobNumber };
    }

    const { data: existing } = await admin
      .from("leads")
      .select("id, metadata, stage")
      .eq("id", input.id)
      .maybeSingle();

    if (!existing) return { ok: false, error: "Row not found" };

    const prevStatus = sheetStatusFromLead({
      stage: existing.stage,
      metadata: existing.metadata,
    });
    if (requestedStatus === "Scheduled" && prevStatus !== "Scheduled") {
      const canInlineSchedule =
        Boolean(input.date.trim()) &&
        Boolean(normalizeSheetTime(input.time)) &&
        Boolean(input.technician.trim());
      if (!canInlineSchedule) {
        return {
          ok: false,
          error: "Pick time and technician to schedule",
          jobStatus: prevStatus,
        };
      }
    }

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
    try {
      const stock = await syncPartnerSheetStock({
        leadId: input.id,
        workSource: input.workSource,
        partnerName: input.partnerName,
        parts: input.parts,
        jobStatus: input.jobStatus,
        technician: input.technician,
        prevMeta: prev,
        createdBy: session.id,
      });
      if (!stock.ok) {
        // Keep row data, but roll status back so Completed isn't stuck without stock pull.
        const rollbackStatus = String(prev.jobStatus || "Waiting");
        const rollbackStage = stageFromSheetStatus(rollbackStatus);
        await admin
          .from("leads")
          .update({
            metadata: {
              ...prev,
              ...meta,
              jobStatus: rollbackStatus,
              stockPull: prev.stockPull ?? null,
            },
            ...(rollbackStage ? { stage: rollbackStage } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.id);
        return { ok: false, error: stock.error, id: input.id, jobStatus: rollbackStatus };
      }
    } catch (err) {
      return {
        ok: false,
        id: input.id,
        error: err instanceof Error ? err.message : "Stock update failed",
      };
    }
    const fieldSync = await syncFieldJobFromSheetSave(input.id, input, assignedTo);
    if (!fieldSync.ok) {
      return { ok: false, id: input.id, error: fieldSync.error };
    }
    const jobNumber = await workOrderNumber(input.id);
    if (!opts?.silent) revalidateRelatedSurfaces();
    return { ok: true, id: input.id, jobNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function deleteSheetRowAction(
  id: string,
  opts?: { silent?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Not signed in" };

  if (isTempId(id)) return { ok: true };

  try {
    const admin = getSupabaseAdmin();

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("id, customer_id, metadata")
      .eq("id", id)
      .maybeSingle();

    if (leadErr) return { ok: false, error: leadErr.message };
    if (!lead) return { ok: false, error: "Row not found" };

    try {
      const prevMeta =
        lead.metadata && typeof lead.metadata === "object"
          ? (lead.metadata as Record<string, unknown>)
          : {};
      await syncSheetPartStock({
        lines: [],
        owner: "none",
        prevPulls: parseSheetStockPulls(prevMeta.stockPulls ?? prevMeta.stockPull),
        leadId: id,
        createdBy: session.id,
      });
    } catch {
      /* ignore restock failure */
    }

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

    if (!opts?.silent) {
      revalidateSheetSurfaces();
      revalidatePath("/finance");
      revalidatePath("/stock");
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
}
