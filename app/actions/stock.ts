"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  installOnJob,
  issueWarehouseToTech,
  receivePartnerStock,
  receiveSupplier,
  updateItemCost,
} from "@/lib/stock/ops";
import { ensureStockSeeded } from "@/lib/stock/store";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session) return null;
  return session;
}

async function defaultTechnicianId(): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "technician")
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0]?.id || null;
}

export async function ensureStockReadyAction() {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const techId =
    session.role === "technician" ? session.id : await defaultTechnicianId();
  if (!techId) return { ok: false as const, error: "No technician found to seed van stock" };
  await ensureStockSeeded(techId);
  return { ok: true as const };
}

export async function issueToTechAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) return;
  if (session.role === "technician") return;

  const itemId = String(formData.get("itemId") || "");
  const technicianId = String(formData.get("technicianId") || "");
  const qty = Number(formData.get("qty") || 0);
  await issueWarehouseToTech({
    itemId,
    technicianId,
    qty,
    createdBy: session.id,
  });
  revalidatePath("/stock");
}

export async function receiveStockAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) return;
  if (session.role === "technician") return;

  const itemId = String(formData.get("itemId") || "");
  const destination = String(formData.get("destination") || "warehouse") as
    | "warehouse"
    | "tech";
  const technicianId = String(formData.get("technicianId") || "") || undefined;
  const qty = Number(formData.get("qty") || 0);
  await receiveSupplier({
    itemId,
    qty,
    destination,
    technicianId,
    createdBy: session.id,
  });
  revalidatePath("/stock");
}

export async function receivePartnerStockAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) return;
  if (session.role === "technician") return;

  const itemId = String(formData.get("itemId") || "");
  const partnerId = String(formData.get("partnerId") || "");
  const qty = Number(formData.get("qty") || 0);
  await receivePartnerStock({
    itemId,
    partnerId,
    qty,
    createdBy: session.id,
  });
  revalidatePath("/stock");
}

export async function saveItemCostAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) return;
  if (session.role !== "owner") return;

  const itemId = String(formData.get("itemId") || "");
  const dollars = Number(formData.get("unitCost") || 0);
  await updateItemCost({
    itemId,
    unitCostCents: Math.round(dollars * 100),
  });
  revalidatePath("/stock");
}

export async function installPartsOnJobAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) return;

  const itemId = String(formData.get("itemId") || "");
  const jobId = String(formData.get("jobId") || "") || undefined;
  const qty = Number(formData.get("qty") || 0);
  const technicianId =
    session.role === "technician"
      ? session.id
      : String(formData.get("technicianId") || session.id);

  await installOnJob({
    itemId,
    qty,
    technicianId,
    jobId,
    createdBy: session.id,
  });

  revalidatePath("/stock");
  revalidatePath("/field");
  if (jobId) revalidatePath(`/field/jobs/${jobId}`);
}
