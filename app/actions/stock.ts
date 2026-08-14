"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createStockItem,
  installOnJob,
  issueWarehouseToTech,
  loadPartnerWarehouseOntoTech,
  moveGarageGuysStockToPartner,
  receivePartnerStock,
  receiveSupplier,
  updateItemCost,
} from "@/lib/stock/ops";
import { ensureStockSeeded, loadStockState } from "@/lib/stock/store";
import { listPartnersAction } from "@/app/actions/partners";

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
  const partnerId = String(formData.get("partnerId") || "") || undefined;
  await issueWarehouseToTech({
    itemId,
    technicianId,
    qty,
    createdBy: session.id,
    partnerId,
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
  const partnerId = String(formData.get("partnerId") || "") || undefined;
  await receiveSupplier({
    itemId,
    qty,
    destination,
    technicianId,
    createdBy: session.id,
    partnerId,
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

export async function createStockItemAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (session.role === "technician") return { ok: false as const, error: "Not allowed" };

  const name = String(formData.get("name") || "");
  const category = String(formData.get("category") || "Misc");
  const subcategory = String(formData.get("subcategory") || "");
  const sku = String(formData.get("sku") || "");
  const dollars = Number(formData.get("unitCost") || 0);
  const qty = Number(formData.get("qty") || 0);
  const partnerId = String(formData.get("partnerId") || "") || undefined;
  const result = await createStockItem({
    name,
    category,
    subcategory,
    sku,
    unitCostCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : 0,
    qty: Number.isFinite(qty) ? qty : 0,
    partnerId,
    createdBy: session.id,
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/stock");
  return { ok: true as const };
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

export async function assignCurrentStockToChampionAction(): Promise<{
  ok: boolean;
  error?: string;
  movedQty: number;
  movedItems: number;
  partnerId?: string;
  partnerName?: string;
}> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: "Not signed in", movedQty: 0, movedItems: 0 };
  if (session.role !== "owner") {
    return { ok: false, error: "Only owner can move stock", movedQty: 0, movedItems: 0 };
  }

  const partners = await listPartnersAction();
  const champion = partners.find(
    (p) => /champion/i.test(p.name) && !p.id.startsWith("seed-"),
  );
  if (!champion) {
    return {
      ok: false,
      error: "Champion partner not found. Run the partners SQL in Supabase first.",
      movedQty: 0,
      movedItems: 0,
    };
  }

  const admin = getSupabaseAdmin();
  const { error: flagErr } = await admin
    .from("partners")
    .update({ has_own_stock: true, updated_at: new Date().toISOString() })
    .eq("id", champion.id);
  if (flagErr) {
    return { ok: false, error: flagErr.message, movedQty: 0, movedItems: 0 };
  }

  const existing = await loadStockState();
  const alreadyOnChampion = existing.balances.some(
    (b) => b.partnerId === champion.id && (Number(b.qty) || 0) > 0,
  );
  if (alreadyOnChampion) {
    return {
      ok: true,
      movedQty: 0,
      movedItems: 0,
      partnerId: champion.id,
      partnerName: champion.name,
    };
  }

  const moved = await moveGarageGuysStockToPartner({
    partnerId: champion.id,
    createdBy: session.id,
    note: "Moved existing Garage Guys stock to Champion warehouse",
  });
  if (!moved.ok) {
    return { ok: false, error: moved.error, movedQty: 0, movedItems: 0 };
  }

  const seedTechId = await defaultTechnicianId();
  if (seedTechId) {
    await loadPartnerWarehouseOntoTech({
      partnerId: champion.id,
      technicianId: seedTechId,
      createdBy: session.id,
    });
  }

  revalidatePath("/stock");
  revalidatePath("/partners");
  revalidatePath("/sheet");
  return {
    ok: true,
    movedQty: moved.movedQty,
    movedItems: moved.movedItems,
    partnerId: champion.id,
    partnerName: champion.name,
  };
}
