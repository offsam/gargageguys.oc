"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type Partner = {
  id: string;
  name: string;
  notes: string;
  tech_percent: number;
  has_own_stock: boolean;
  active: boolean;
  created_at: string;
};

const SEED_NAME = "Champion Garage Doors Service";
const PARTNER_STOCK_SQL =
  "Run supabase/migrations/202608140007_partner_stock.sql in Supabase SQL Editor (creates partners + own-stock flag)";
const PARTNERS_SQL = PARTNER_STOCK_SQL;
const SELECT_WITH_STOCK = "id, name, notes, tech_percent, has_own_stock, active, created_at";
const SELECT_LEGACY = "id, name, notes, tech_percent, active, created_at";

function mapPartner(row: Record<string, unknown>): Partner {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    notes: typeof row.notes === "string" ? row.notes : "",
    tech_percent: Number(row.tech_percent) || 30,
    has_own_stock: row.has_own_stock === true,
    active: row.active !== false,
    created_at: String(row.created_at || ""),
  };
}

function seedFallback(notes = "Run partners migration to enable editing"): Partner {
  return {
    id: "seed-champion",
    name: SEED_NAME,
    notes,
    tech_percent: 30,
    has_own_stock: false,
    active: true,
    created_at: new Date().toISOString(),
  };
}

function missingTable(message: string) {
  return /partners/i.test(message) && /does not exist|schema cache/i.test(message);
}

function missingStockColumn(message: string) {
  return /has_own_stock/i.test(message);
}

function revalidatePartnerSurfaces() {
  revalidatePath("/partners");
  revalidatePath("/sheet");
  revalidatePath("/stock");
}

export async function listPartnersAction(): Promise<Partner[]> {
  try {
    const admin = getSupabaseAdmin();
    let { data, error } = await admin
      .from("partners")
      .select(SELECT_WITH_STOCK)
      .order("name", { ascending: true });
    if (error && missingStockColumn(error.message)) {
      const retry = await admin
        .from("partners")
        .select(SELECT_LEGACY)
        .order("name", { ascending: true });
      data = (retry.data || []).map((row) => ({ ...row, has_own_stock: false }));
      error = retry.error;
    }
    if (error) {
      if (missingTable(error.message)) return [seedFallback()];
      throw error;
    }
    const rows = (data || []).map((r) => mapPartner(r as Record<string, unknown>));
    if (!rows.length) {
      const seeded = await ensureSeedPartner();
      return seeded ? [seeded] : [];
    }
    return rows;
  } catch {
    return [seedFallback()];
  }
}

async function ensureSeedPartner(): Promise<Partner | null> {
  try {
    const admin = getSupabaseAdmin();
    const payload = {
      name: SEED_NAME,
      notes: "Default partner",
      tech_percent: 30,
      has_own_stock: false,
    };
    let { data, error } = await admin.from("partners").insert(payload).select(SELECT_WITH_STOCK).single();
    if (error && missingStockColumn(error.message)) {
      const { has_own_stock: _h, ...legacy } = payload;
      const retry = await admin.from("partners").insert(legacy).select(SELECT_LEGACY).single();
      data = retry.data ? { ...retry.data, has_own_stock: false } : retry.data;
      error = retry.error;
    }
    if (error) return null;
    return mapPartner(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

function parseHasOwnStock(formData: FormData): boolean {
  const raw = String(formData.get("hasOwnStock") || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export async function createPartnerAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Not signed in" };
  if (session.role !== "owner" && session.role !== "office") {
    return { ok: false, error: "Not allowed" };
  }

  const name = String(formData.get("name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const techPercentRaw = String(formData.get("techPercent") || "30").trim();
  const techPercent = Number(techPercentRaw);
  const hasOwnStock = parseHasOwnStock(formData);
  if (!name) return { ok: false, error: "Partner name is required" };
  if (!Number.isFinite(techPercent) || techPercent < 0 || techPercent > 100) {
    return { ok: false, error: "Tech % must be 0–100" };
  }

  try {
    const admin = getSupabaseAdmin();
    const payload = {
      name,
      notes: notes || null,
      tech_percent: techPercent,
      has_own_stock: hasOwnStock,
      active: true,
    };
    let { error } = await admin.from("partners").insert(payload);
    if (error && missingStockColumn(error.message)) {
      if (hasOwnStock) return { ok: false, error: PARTNER_STOCK_SQL };
      const { has_own_stock: _h, ...legacy } = payload;
      const retry = await admin.from("partners").insert(legacy);
      error = retry.error;
    }
    if (error) {
      if (/unique|duplicate/i.test(error.message)) {
        return { ok: false, error: "Partner with this name already exists" };
      }
      if (missingTable(error.message)) {
        return { ok: false, error: PARTNERS_SQL };
      }
      return { ok: false, error: error.message };
    }
    revalidatePartnerSurfaces();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create partner" };
  }
}

export async function updatePartnerAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Not signed in" };
  if (session.role !== "owner" && session.role !== "office") {
    return { ok: false, error: "Not allowed" };
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const techPercent = Number(String(formData.get("techPercent") || "30").trim());
  const active = String(formData.getAll("active").pop() || "") === "true";
  const hasOwnStock = parseHasOwnStock(formData);

  if (!id || id.startsWith("seed-")) {
    return { ok: false, error: "Run partners migration before editing" };
  }
  if (!name) return { ok: false, error: "Partner name is required" };

  try {
    const admin = getSupabaseAdmin();
    const payload = {
      name,
      notes: notes || null,
      tech_percent: Number.isFinite(techPercent) ? techPercent : 30,
      has_own_stock: hasOwnStock,
      active,
      updated_at: new Date().toISOString(),
    };
    let { error } = await admin.from("partners").update(payload).eq("id", id);
    if (error && missingStockColumn(error.message)) {
      if (hasOwnStock) return { ok: false, error: PARTNER_STOCK_SQL };
      const { has_own_stock: _h, ...legacy } = payload;
      const retry = await admin.from("partners").update(legacy).eq("id", id);
      error = retry.error;
    }
    if (error) return { ok: false, error: error.message };
    revalidatePartnerSurfaces();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update partner" };
  }
}

export async function deletePartnerAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Not signed in" };
  if (session.role !== "owner") return { ok: false, error: "Only owner can delete partners" };

  const id = String(formData.get("id") || "").trim();
  if (!id || id.startsWith("seed-")) {
    return { ok: false, error: "Run partners migration before deleting" };
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("partners").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePartnerSurfaces();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not delete partner" };
  }
}
