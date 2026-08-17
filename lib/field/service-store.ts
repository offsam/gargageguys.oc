import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { STOCK_BUCKET } from "@/lib/stock/store";
import { FIELD_SERVICES, type FieldService } from "@/lib/field/services-catalog";

export const SERVICES_OBJECT = "services.json";

type ServicesFile = {
  version: number;
  updatedAt: string;
  items: FieldService[];
};

const SEED = FIELD_SERVICES.filter((s) => s.id !== "svc-custom");

async function ensureBucket() {
  const admin = getSupabaseAdmin();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!(buckets || []).some((b) => b.name === STOCK_BUCKET)) {
    const { error } = await admin.storage.createBucket(STOCK_BUCKET, {
      public: false,
    });
    if (error && !/already exists/i.test(error.message)) {
      throw error;
    }
  }
}

function mergeWithSeed(stored: FieldService[]): FieldService[] {
  const byId = new Map<string, FieldService>();
  const byName = new Map<string, FieldService>();
  for (const item of stored) {
    if (!item?.id || !item.name?.trim()) continue;
    if (item.id === "svc-custom") continue;
    const row: FieldService = {
      id: item.id,
      name: item.name.trim(),
      unitPriceCents: Math.max(0, Math.round(Number(item.unitPriceCents) || 0)),
      category: item.category?.trim() || "Service",
    };
    byId.set(row.id, row);
    byName.set(row.name.toLowerCase(), row);
  }
  for (const seed of SEED) {
    const existing = byId.get(seed.id) || byName.get(seed.name.toLowerCase());
    if (!existing) {
      byId.set(seed.id, { ...seed });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function readFile(): Promise<FieldService[]> {
  await ensureBucket();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(STOCK_BUCKET).download(SERVICES_OBJECT);
  if (error) {
    const status = (error as { statusCode?: string }).statusCode;
    if (/not found|404/i.test(error.message) || status === "404") {
      return mergeWithSeed([]);
    }
    throw error;
  }
  const text = await data.text();
  if (!text.trim()) return mergeWithSeed([]);
  const parsed = JSON.parse(text) as ServicesFile | FieldService[];
  const items = Array.isArray(parsed) ? parsed : parsed.items || [];
  return mergeWithSeed(items);
}

async function writeFile(items: FieldService[]): Promise<FieldService[]> {
  await ensureBucket();
  const merged = mergeWithSeed(items);
  const body: ServicesFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: merged,
  };
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.from(STOCK_BUCKET).upload(
    SERVICES_OBJECT,
    JSON.stringify(body, null, 2),
    { contentType: "application/json", upsert: true },
  );
  if (error) throw error;
  return merged;
}

export async function loadServices(): Promise<FieldService[]> {
  return readFile();
}

export async function upsertService(input: {
  name: string;
  unitPriceCents?: number;
  category?: string;
}): Promise<FieldService> {
  const name = input.name.trim();
  if (!name) throw new Error("Service name required");
  const items = await readFile();
  const existing = items.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    const next: FieldService = {
      ...existing,
      name,
      category: input.category?.trim() || existing.category,
      unitPriceCents:
        input.unitPriceCents == null
          ? existing.unitPriceCents
          : Math.max(0, Math.round(input.unitPriceCents)),
    };
    const saved = await writeFile(items.map((s) => (s.id === existing.id ? next : s)));
    return saved.find((s) => s.id === existing.id) || next;
  }
  const created: FieldService = {
    id: `svc-${randomUUID().slice(0, 8)}`,
    name,
    unitPriceCents: Math.max(0, Math.round(input.unitPriceCents || 0)),
    category: input.category?.trim() || "Service",
  };
  await writeFile([...items, created]);
  return created;
}

export async function updateServicePrice(id: string, unitPriceCents: number): Promise<FieldService> {
  const items = await readFile();
  const idx = items.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Service not found");
  const next = {
    ...items[idx],
    unitPriceCents: Math.max(0, Math.round(unitPriceCents)),
  };
  items[idx] = next;
  await writeFile(items);
  return next;
}

export function findServiceInList(list: FieldService[], idOrName: string) {
  const needle = idOrName.trim().toLowerCase();
  if (!needle) return null;
  return (
    list.find((s) => s.id === idOrName) ||
    list.find((s) => s.name.toLowerCase() === needle) ||
    null
  );
}
