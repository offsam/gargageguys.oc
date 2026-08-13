"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { installOnJob } from "@/lib/stock/ops";
import { loadStockState } from "@/lib/stock/store";
import { findFieldService } from "@/lib/field/services-catalog";
import {
  ensureJobInvoice,
  getJobInvoiceByJobId,
  saveJobInvoiceLines,
  updateJobInvoiceFields,
  type InvoiceLine,
  type JobInvoiceStatus,
} from "@/lib/field/job-invoice";

function revalidateJob(jobId: string) {
  revalidatePath(`/field/jobs/${jobId}`);
  revalidatePath("/field");
  revalidatePath("/finance");
  revalidatePath("/sheet");
  revalidatePath("/crm");
  revalidatePath("/owner");
}

async function requireTechOrStaff() {
  const session = await getSessionUser();
  if (!session) return null;
  return session;
}

export async function ensureFieldInvoiceAction(jobId: string) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };
  try {
    const invoice = await ensureJobInvoice({ jobId, createdBy: session.id });
    return { ok: true as const, invoice };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Could not open invoice",
    };
  }
}

export async function addPartToInvoiceAction(formData: FormData) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const jobId = String(formData.get("jobId") || "");
  const itemId = String(formData.get("itemId") || "");
  const qty = Math.max(1, Number(formData.get("qty") || 1));
  if (!jobId || !itemId) return { ok: false as const, error: "Missing job or part" };

  const technicianId =
    session.role === "technician"
      ? session.id
      : String(formData.get("technicianId") || session.id);

  const stock = await installOnJob({
    itemId,
    qty,
    technicianId,
    jobId,
    createdBy: session.id,
  });
  if (!stock.ok) return { ok: false as const, error: stock.error };

  const state = await loadStockState();
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { ok: false as const, error: "Part not found" };

  const invoice = await ensureJobInvoice({ jobId, createdBy: session.id });
  if (["signed", "complete"].includes(invoice.status)) {
    return { ok: false as const, error: "Invoice already finalized" };
  }

  const unitCents = item.unitCostCents || 0;
  const line: InvoiceLine = {
    id: randomUUID(),
    kind: "part",
    refId: item.id,
    name: item.name,
    qty,
    unitCents,
    totalCents: unitCents * qty,
  };
  const lines = [...invoice.lines, line];
  const next = await saveJobInvoiceLines(invoice.id, lines, "estimate_ready");
  revalidateJob(jobId);
  return { ok: true as const, invoice: next };
}

export async function addServiceToInvoiceAction(formData: FormData) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const jobId = String(formData.get("jobId") || "");
  const serviceId = String(formData.get("serviceId") || "");
  const qty = Math.max(1, Number(formData.get("qty") || 1));
  const customName = String(formData.get("customName") || "").trim();
  const customDollars = Number(formData.get("customPrice") || 0);

  if (!jobId || !serviceId) return { ok: false as const, error: "Missing service" };

  const service = findFieldService(serviceId);
  if (!service) return { ok: false as const, error: "Unknown service" };

  const invoice = await ensureJobInvoice({ jobId, createdBy: session.id });
  if (["signed", "complete"].includes(invoice.status)) {
    return { ok: false as const, error: "Invoice already finalized" };
  }

  const isCustom = serviceId === "svc-custom";
  const name = isCustom ? customName || "Custom service" : service.name;
  const unitCents = isCustom
    ? Math.round((Number.isFinite(customDollars) ? customDollars : 0) * 100)
    : service.unitPriceCents;

  if (isCustom && unitCents <= 0) {
    return { ok: false as const, error: "Set a price for custom service" };
  }

  const line: InvoiceLine = {
    id: randomUUID(),
    kind: "service",
    refId: service.id,
    name,
    qty,
    unitCents,
    totalCents: unitCents * qty,
  };
  const next = await saveJobInvoiceLines(
    invoice.id,
    [...invoice.lines, line],
    "estimate_ready",
  );
  revalidateJob(jobId);
  return { ok: true as const, invoice: next };
}

export async function removeInvoiceLineAction(formData: FormData) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const jobId = String(formData.get("jobId") || "");
  const lineId = String(formData.get("lineId") || "");
  if (!jobId || !lineId) return { ok: false as const, error: "Missing line" };

  const invoice = await getJobInvoiceByJobId(jobId);
  if (!invoice) return { ok: false as const, error: "Invoice not found" };
  if (["payment_confirmed", "signed", "complete"].includes(invoice.status)) {
    return { ok: false as const, error: "Cannot edit after payment" };
  }

  const lines = invoice.lines.filter((l) => l.id !== lineId);
  const status: JobInvoiceStatus = lines.length ? "estimate_ready" : "draft";
  const next = await saveJobInvoiceLines(invoice.id, lines, status);
  revalidateJob(jobId);
  return { ok: true as const, invoice: next };
}

export async function confirmEstimateAction(jobId: string) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const invoice = await getJobInvoiceByJobId(jobId);
  if (!invoice) return { ok: false as const, error: "Invoice not found" };
  if (!invoice.lines.length) return { ok: false as const, error: "Add parts or services first" };

  const next = await updateJobInvoiceFields(invoice.id, {
    status: "estimate_confirmed",
    estimate_confirmed_at: new Date().toISOString(),
  });
  revalidateJob(jobId);
  return { ok: true as const, invoice: next };
}

export async function startPaymentAction(jobId: string) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const invoice = await getJobInvoiceByJobId(jobId);
  if (!invoice) return { ok: false as const, error: "Invoice not found" };
  if (invoice.status !== "estimate_confirmed" && invoice.status !== "payment_pending") {
    return { ok: false as const, error: "Confirm estimate first" };
  }

  const next = await updateJobInvoiceFields(invoice.id, {
    status: "payment_pending",
  });
  revalidateJob(jobId);
  return { ok: true as const, invoice: next };
}

export async function confirmPaymentAction(formData: FormData) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const jobId = String(formData.get("jobId") || "");
  const paymentType = String(formData.get("paymentType") || "").trim();
  if (!jobId || !paymentType) return { ok: false as const, error: "Select payment type" };

  const invoice = await getJobInvoiceByJobId(jobId);
  if (!invoice) return { ok: false as const, error: "Invoice not found" };

  const next = await updateJobInvoiceFields(invoice.id, {
    status: "payment_confirmed",
    payment_type: paymentType,
    payment_confirmed_at: new Date().toISOString(),
  });
  revalidateJob(jobId);
  return { ok: true as const, invoice: next };
}

export async function saveSignatureAction(formData: FormData) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const jobId = String(formData.get("jobId") || "");
  const signatureData = String(formData.get("signatureData") || "").trim();
  if (!jobId || !signatureData.startsWith("data:image")) {
    return { ok: false as const, error: "Signature required" };
  }
  if (signatureData.length > 900_000) {
    return { ok: false as const, error: "Signature too large" };
  }

  const invoice = await getJobInvoiceByJobId(jobId);
  if (!invoice) return { ok: false as const, error: "Invoice not found" };
  if (invoice.status !== "payment_confirmed" && invoice.status !== "signed") {
    return { ok: false as const, error: "Confirm payment before signature" };
  }

  const next = await updateJobInvoiceFields(invoice.id, {
    status: "signed",
    signature_data: signatureData,
    signed_at: new Date().toISOString(),
  });
  revalidateJob(jobId);
  return { ok: true as const, invoice: next };
}

export async function completeInvoiceAction(jobId: string) {
  const session = await requireTechOrStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const invoice = await getJobInvoiceByJobId(jobId);
  if (!invoice) return { ok: false as const, error: "Invoice not found" };
  if (!invoice.signature_data) return { ok: false as const, error: "Signature required" };

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  let financeInvoiceId = invoice.finance_invoice_id;
  if (!financeInvoiceId) {
    const description = [
      `Job invoice ${invoice.id.slice(0, 8)}`,
      ...invoice.lines.map((l) => `${l.qty}× ${l.name}`),
    ]
      .join(" · ")
      .slice(0, 500);

    const { data: fin, error: finErr } = await admin
      .from("invoices")
      .insert({
        customer_id: invoice.customer_id,
        lead_id: invoice.lead_id,
        job_id: jobId,
        amount_cents: invoice.total_cents,
        status: "paid",
        description,
        paid_at: now,
      })
      .select("id")
      .single();
    if (finErr) return { ok: false as const, error: finErr.message };
    financeInvoiceId = fin.id;
  }

  const next = await updateJobInvoiceFields(invoice.id, {
    status: "complete",
    completed_at: now,
    finance_invoice_id: financeInvoiceId,
  });

  await admin
    .from("jobs")
    .update({ status: "done", updated_at: now })
    .eq("id", jobId);

  if (invoice.lead_id) {
    const { data: lead } = await admin
      .from("leads")
      .select("metadata")
      .eq("id", invoice.lead_id)
      .maybeSingle();
    const prev =
      lead?.metadata && typeof lead.metadata === "object"
        ? (lead.metadata as Record<string, unknown>)
        : {};
    await admin
      .from("leads")
      .update({
        stage: "completed",
        metadata: {
          ...prev,
          jobStatus: "Completed",
          paymentType: invoice.payment_type || prev.paymentType || "",
          jobCost: (invoice.total_cents / 100).toFixed(2),
          partsCost: (
            invoice.lines
              .filter((l) => l.kind === "part")
              .reduce((s, l) => s + l.totalCents, 0) / 100
          ).toFixed(2),
          parts: invoice.lines
            .filter((l) => l.kind === "part")
            .map((l) => l.name)
            .join(", "),
        },
        updated_at: now,
      })
      .eq("id", invoice.lead_id);
  }

  revalidateJob(jobId);
  return { ok: true as const, invoice: next };
}
