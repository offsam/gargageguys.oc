"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { BUSY_JOB_MARKER } from "@/lib/field/busy";

function revalidateField() {
  revalidatePath("/field");
  revalidatePath("/dispatch");
  revalidatePath("/crm");
  revalidatePath("/sheet");
  revalidatePath("/owner");
}

function parseLocalDateTime(value: string): Date | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function createFieldClientJobAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (session.role !== "technician" && session.role !== "owner") {
    return { ok: false as const, error: "Only technicians can add field clients" };
  }

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const zip = String(formData.get("zip") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const start = parseLocalDateTime(String(formData.get("startAt") || ""));

  if (!name || !phone) return { ok: false as const, error: "Name and phone are required" };
  if (!address) return { ok: false as const, error: "Address is required" };
  if (!start) return { ok: false as const, error: "Visit time is required" };

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const admin = getSupabaseAdmin();

  const leadPayload = {
    name,
    phone,
    zip: zip || null,
    address: address || null,
    message: message || null,
    source: "field",
    lead_type: "field_job",
    stage: "scheduled" as const,
    assigned_to: session.id,
    deal_title: message || "Field job",
    scheduled_at: start.toISOString(),
    metadata: {
      clientName: name,
      clientAddress: address,
      phone,
      zip,
      jobStatus: "Scheduled",
      technician: session.fullName || session.email,
      sheetDate: start.toISOString().slice(0, 10),
      fromField: true,
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
      technician_id: session.id,
      title: `${name}${zip ? ` — ${zip}` : ""}`.trim(),
      status: "assigned",
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      address,
      zip: zip || null,
      notes: message || null,
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    return { ok: false as const, error: jobErr?.message || "Could not create job" };
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
