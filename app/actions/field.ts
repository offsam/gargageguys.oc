"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { BUSY_JOB_MARKER } from "@/lib/field/busy";
import { ensureJobInvoice } from "@/lib/field/job-invoice";
import { isSeniorTechnician } from "@/lib/auth/tech-rank";
import { addServiceToInvoiceAction } from "@/app/actions/job-invoice";
import { findServiceInList, loadServices, upsertService } from "@/lib/field/service-store";
import { parseMoney } from "@/lib/sheet/money";

function revalidateField() {
  revalidatePath("/field");
  revalidatePath("/dispatch");
  revalidatePath("/crm");
  revalidatePath("/sheet");
  revalidatePath("/owner");
  revalidatePath("/finance");
}

function parseLocalDateTime(value: string): Date | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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

export async function createFieldClientJobAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (session.role !== "technician" && session.role !== "owner") {
    return { ok: false as const, error: "Only technicians can add field clients" };
  }

  const fullForm = isSeniorTechnician(session);
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const zip = String(formData.get("zip") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const start = parseLocalDateTime(String(formData.get("startAt") || ""));

  if (!name || !phone) return { ok: false as const, error: "Name and phone are required" };
  if (!address) return { ok: false as const, error: "Address is required" };
  if (!start) return { ok: false as const, error: "Visit time is required" };

  const workSource = fullForm
    ? String(formData.get("workSource") || "").trim() || "Garage Guys"
    : "Garage Guys";
  const partnerName = fullForm ? String(formData.get("partnerName") || "").trim() : "";
  const leadSource = fullForm
    ? String(formData.get("leadSource") || "").trim()
    : "Field";
  const leadCost = fullForm ? String(formData.get("leadCost") || "").trim() : "";
  const jobType = fullForm ? String(formData.get("jobType") || "").trim() : "";
  const service = fullForm ? String(formData.get("service") || "").trim() : "";
  const parts = fullForm ? String(formData.get("parts") || "").trim() : "";
  const partsCost = fullForm ? String(formData.get("partsCost") || "").trim() : "";
  const paymentType = fullForm ? String(formData.get("paymentType") || "").trim() : "";
  const checkNumber = fullForm ? String(formData.get("checkNumber") || "").trim() : "";
  const jobCost = fullForm ? String(formData.get("jobCost") || "").trim() : "";
  const bankFee = fullForm ? String(formData.get("bankFee") || "").trim() : "";
  const techSalary = fullForm ? String(formData.get("techSalary") || "").trim() : "";
  const technicianName = fullForm
    ? String(formData.get("technician") || "").trim() || session.fullName || session.email
    : session.fullName || session.email;
  const technicianId = fullForm
    ? (await resolveTechnicianId(technicianName)) || session.id
    : session.id;

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const admin = getSupabaseAdmin();

  const leadPayload = {
    name,
    phone,
    zip: zip || null,
    address: address || null,
    message: message || jobType || null,
    source: workSource === "Partner" ? partnerName || "Partner" : leadSource || "field",
    lead_type: "field_job",
    stage: "scheduled" as const,
    assigned_to: technicianId,
    deal_title: jobType || service || message || "Field job",
    deal_price: jobCost || null,
    scheduled_at: start.toISOString(),
    metadata: {
      clientName: name,
      clientAddress: address,
      phone,
      zip,
      jobStatus: "Scheduled",
      technician: technicianName,
      sheetDate: start.toISOString().slice(0, 10),
      sheetTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      fromField: true,
      workSource,
      partnerName,
      leadSource,
      leadCost,
      jobType,
      issue: jobType,
      service,
      parts,
      partsCost,
      paymentType,
      checkNumber,
      jobCost,
      bankFee,
      techSalary,
      description: message,
    },
  };

  let { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert(leadPayload)
    .select("id")
    .single();

  // DB without leads.address yet — retry storing address only in metadata
  if (leadErr && /address/i.test(leadErr.message)) {
    const { address: _omit, ...withoutAddress } = leadPayload;
    const retry = await admin.from("leads").insert(withoutAddress).select("id").single();
    lead = retry.data;
    leadErr = retry.error;
  }

  if (leadErr || !lead) {
    return { ok: false as const, error: leadErr?.message || "Could not create lead" };
  }

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .insert({
      lead_id: lead.id,
      technician_id: technicianId,
      title: `${name}${zip ? ` — ${zip}` : ""}`.trim(),
      status: "assigned",
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      address,
      zip: zip || null,
      notes: [jobType, service, message].filter(Boolean).join(" · ") || null,
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    return { ok: false as const, error: jobErr?.message || "Could not create job" };
  }

  try {
    await ensureJobInvoice({ jobId: job.id, createdBy: session.id });
  } catch (err) {
    console.error("[createFieldClientJobAction] invoice", err);
  }

  if (service) {
    try {
      const catalog = await loadServices();
      let svc = findServiceInList(catalog, service);
      if (!svc) {
        const cents = Math.round(parseMoney(jobCost) * 100);
        svc = await upsertService({
          name: service,
          unitPriceCents: cents > 0 ? cents : 0,
        });
      }
      const fd = new FormData();
      fd.set("jobId", job.id);
      fd.set("serviceId", svc.id);
      fd.set("qty", "1");
      await addServiceToInvoiceAction(fd);
    } catch (err) {
      console.error("[createFieldClientJobAction] service", err);
    }
  }

  revalidateField();
  return { ok: true as const, jobId: job.id };
}

export async function createBusyBlockAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (session.role !== "technician" && session.role !== "owner") {
    return { ok: false as const, error: "Only technicians can mark busy" };
  }

  const start = parseLocalDateTime(String(formData.get("startAt") || ""));
  const end = parseLocalDateTime(String(formData.get("endAt") || ""));
  const note = String(formData.get("note") || "").trim();

  if (!start || !end) return { ok: false as const, error: "Start and end are required" };
  if (end.getTime() <= start.getTime()) {
    return { ok: false as const, error: "End must be after start" };
  }

  const admin = getSupabaseAdmin();
  const { data: job, error } = await admin
    .from("jobs")
    .insert({
      technician_id: session.id,
      title: "Busy",
      status: "assigned",
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      notes: `${BUSY_JOB_MARKER}${note ? ` ${note}` : ""}`.trim(),
    })
    .select("id")
    .single();

  if (error || !job) {
    return { ok: false as const, error: error?.message || "Could not create busy block" };
  }

  revalidateField();
  return { ok: true as const, jobId: job.id };
}
