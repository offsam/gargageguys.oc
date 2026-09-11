import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { STOCK_BUCKET } from "@/lib/stock/store";

export const TECH_LOCATIONS_OBJECT = "tech-locations.json";

export type TechLocation = {
  technicianId: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  updatedAt: string;
};

type TechLocationsState = {
  version: number;
  updatedAt: string;
  byTech: Record<string, TechLocation>;
};

function emptyState(): TechLocationsState {
  return { version: 0, updatedAt: new Date().toISOString(), byTech: {} };
}

async function readState(): Promise<TechLocationsState> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(STOCK_BUCKET).download(TECH_LOCATIONS_OBJECT);
  if (error || !data) return emptyState();
  try {
    const text = await data.text();
    const parsed = JSON.parse(text) as TechLocationsState;
    if (!parsed || typeof parsed !== "object") return emptyState();
    return {
      version: Number(parsed.version) || 0,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      byTech: parsed.byTech && typeof parsed.byTech === "object" ? parsed.byTech : {},
    };
  } catch {
    return emptyState();
  }
}

async function writeState(state: TechLocationsState): Promise<void> {
  const admin = getSupabaseAdmin();
  const body = JSON.stringify(state);
  const { error } = await admin.storage.from(STOCK_BUCKET).upload(TECH_LOCATIONS_OBJECT, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

export async function getTechLocation(technicianId: string): Promise<TechLocation | null> {
  const id = technicianId.trim();
  if (!id) return null;
  const state = await readState();
  return state.byTech[id] || null;
}

export async function upsertTechLocation(input: {
  technicianId: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
}): Promise<TechLocation> {
  const technicianId = input.technicianId.trim();
  if (!technicianId) throw new Error("technicianId required");
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error("invalid coordinates");
  }
  if (Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
    throw new Error("coordinates out of range");
  }

  const state = await readState();
  const next: TechLocation = {
    technicianId,
    lat: input.lat,
    lng: input.lng,
    accuracyM:
      input.accuracyM != null && Number.isFinite(input.accuracyM) ? Number(input.accuracyM) : null,
    updatedAt: new Date().toISOString(),
  };
  state.byTech[technicianId] = next;
  state.version += 1;
  state.updatedAt = next.updatedAt;
  await writeState(state);
  return next;
}
