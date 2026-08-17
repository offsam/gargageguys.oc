"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import {
  loadServices,
  updateServicePrice,
  upsertService,
} from "@/lib/field/service-store";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session) return null;
  if (session.role === "technician") return session;
  return session;
}

function revalidateServicePages() {
  revalidatePath("/stock");
  revalidatePath("/sheet");
  revalidatePath("/crm");
  revalidatePath("/field");
}

export async function listServicesAction() {
  const session = await requireStaff();
  if (!session) return [];
  return loadServices();
}

export async function upsertServiceAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "Service").trim() || "Service";
  const dollars = Number(formData.get("unitCost") || formData.get("price") || 0);
  if (!name) return { ok: false as const, error: "Name required" };
  const canSetPrice = session.role !== "technician";
  const service = await upsertService({
    name,
    category,
    unitPriceCents:
      canSetPrice && Number.isFinite(dollars) && dollars > 0
        ? Math.round(dollars * 100)
        : undefined,
  });
  revalidateServicePages();
  return { ok: true as const, service };
}

export async function saveServicePriceAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (session.role !== "owner") {
    return { ok: false as const, error: "Not allowed" };
  }
  const id = String(formData.get("itemId") || formData.get("id") || "");
  const dollars = Number(formData.get("unitCost") || 0);
  if (!id) return { ok: false as const, error: "Missing service" };
  if (!Number.isFinite(dollars) || dollars < 0) {
    return { ok: false as const, error: "Invalid price" };
  }
  await updateServicePrice(id, Math.round(dollars * 100));
  revalidateServicePages();
  return { ok: true as const };
}
