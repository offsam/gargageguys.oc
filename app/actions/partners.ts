"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type Partner = {
  id: string;
  name: string;
  notes: string;
  tech_percent: number;
  active: boolean;
  created_at: string;
};

const SEED_NAME = "Champion Garage Doors Service";

function mapPartner(row: Record<string, unknown>): Partner {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    notes: typeof row.notes === "string" ? row.notes : "",
    tech_percent: Number(row.tech_percent) || 30,
    active: row.active !== false,
    created_at: String(row.created_at || ""),
  };
}

export async function listPartnersAction(): Promise<Partner[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("partners")
      .select("id, name, notes, tech_percent, active, created_at")
      .order("name", { ascending: true });
    if (error) {
      if (/partners/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
        return [
          {
            id: "seed-champion",
            name: SEED_NAME,
            notes: "Run partners migration to enable editing",
            tech_percent: 30,
            active: true,
            created_at: new Date().toISOString(),
          },
        ];
      }
      throw error;
    }
    const rows = (data || []).map((r) => mapPartner(r as Record<string, unknown>));
    if (!rows.length) {
      const seeded = await ensureSeedPartner();
      return seeded ? [seeded] : [];
    }
    return rows;
  } catch {
    return [
      {
        id: "seed-champion",
        name: SEED_NAME,
        notes: "Run partners migration to enable editing",
        tech_percent: 30,
        active: true,
        created_at: new Date().toISOString(),
      },
    ];
  }
}

async function ensureSeedPartner(): Promise<Partner | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("partners")
      .insert({
        name: SEED_NAME,
        notes: "Default partner",
        tech_percent: 30,
      })
      .select("id, name, notes, tech_percent, active, created_at")
      .single();
    if (error) return null;
    return mapPartner(data as Record<string, unknown>);
  } catch {
    return null;
  }
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
  if (!name) return { ok: false, error: "Partner name is required" };
  if (!Number.isFinite(techPercent) || techPercent < 0 || techPercent > 100) {
    return { ok: false, error: "Tech % must be 0–100" };
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("partners").insert({
      name,
      notes: notes || null,
      tech_percent: techPercent,
      active: true,
    });
    if (error) {
      if (/unique|duplicate/i.test(error.message)) {
        return { ok: false, error: "Partner with this name already exists" };
      }
      if (/partners/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
        return {
          ok: false,
          error: "Run supabase/migrations/202608140005_partners.sql in Supabase SQL Editor",
        };
      }
      return { ok: false, error: error.message };
    }
    revalidatePath("/partners");
    revalidatePath("/sheet");
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

  if (!id || id.startsWith("seed-")) {
    return { ok: false, error: "Run partners migration before editing" };
  }
  if (!name) return { ok: false, error: "Partner name is required" };

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("partners")
      .update({
        name,
        notes: notes || null,
        tech_percent: Number.isFinite(techPercent) ? techPercent : 30,
        active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/partners");
    revalidatePath("/sheet");
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
    revalidatePath("/partners");
    revalidatePath("/sheet");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not delete partner" };
  }
}
