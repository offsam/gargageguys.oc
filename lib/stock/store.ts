import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SEED_STOCK_ITEMS } from "@/lib/stock/seed-catalog";

export const STOCK_BUCKET = "bos-data";
export const STOCK_OBJECT = "stock.json";

export type StockLocationType = "warehouse" | "tech";

export type StockItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  unitCostCents: number;
  unit: string;
  reorderAt: number;
  active: boolean;
};

export type StockBalance = {
  itemId: string;
  locationType: StockLocationType;
  technicianId?: string;
  qty: number;
};

export type StockMovementKind =
  | "seed"
  | "issue_warehouse_to_tech"
  | "receive_supplier_to_warehouse"
  | "receive_supplier_to_tech"
  | "install_on_job"
  | "adjust";

export type StockMovement = {
  id: string;
  itemId: string;
  qty: number;
  kind: StockMovementKind;
  fromLocationType?: StockLocationType;
  fromTechnicianId?: string;
  toLocationType?: StockLocationType;
  toTechnicianId?: string;
  jobId?: string;
  note?: string;
  createdBy?: string;
  createdAt: string;
};

export type StockState = {
  version: number;
  updatedAt: string;
  items: StockItem[];
  balances: StockBalance[];
  movements: StockMovement[];
};

function emptyState(): StockState {
  return {
    version: 0,
    updatedAt: new Date().toISOString(),
    items: [],
    balances: [],
    movements: [],
  };
}

export function buildSeedState(technicianId: string): StockState {
  const now = new Date().toISOString();
  const items: StockItem[] = [];
  const balances: StockBalance[] = [];
  const movements: StockMovement[] = [];

  for (const seed of SEED_STOCK_ITEMS) {
    const id = randomUUID();
    items.push({
      id,
      sku: seed.sku,
      name: seed.name,
      category: seed.category,
      subcategory: seed.subcategory,
      unitCostCents: 0,
      unit: "ea",
      reorderAt: 0,
      active: true,
    });
    balances.push({
      itemId: id,
      locationType: "warehouse",
      qty: 0,
    });
    balances.push({
      itemId: id,
      locationType: "tech",
      technicianId,
      qty: seed.qty,
    });
    if (seed.qty > 0) {
      movements.push({
        id: randomUUID(),
        itemId: id,
        qty: seed.qty,
        kind: "seed",
        toLocationType: "tech",
        toTechnicianId: technicianId,
        note: "Initial van stock from inventory sheet",
        createdAt: now,
      });
    }
  }

  return {
    version: 1,
    updatedAt: now,
    items,
    balances,
    movements,
  };
}

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

export async function loadStockState(): Promise<StockState> {
  await ensureBucket();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(STOCK_BUCKET).download(STOCK_OBJECT);
  if (error) {
    if (/not found|404/i.test(error.message)) return emptyState();
    // supabase-js sometimes returns StorageApiError with statusCode
    const status = (error as { statusCode?: string }).statusCode;
    if (status === "404") return emptyState();
    throw error;
  }
  const text = await data.text();
  if (!text.trim()) return emptyState();
  return JSON.parse(text) as StockState;
}

export async function saveStockState(state: StockState): Promise<void> {
  await ensureBucket();
  const admin = getSupabaseAdmin();
  const next: StockState = {
    ...state,
    version: state.version + 1,
    updatedAt: new Date().toISOString(),
  };
  const body = JSON.stringify(next, null, 2);
  const { error } = await admin.storage.from(STOCK_BUCKET).upload(STOCK_OBJECT, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw error;
}

export function balanceKey(
  itemId: string,
  locationType: StockLocationType,
  technicianId?: string,
) {
  return locationType === "warehouse"
    ? `${itemId}:warehouse`
    : `${itemId}:tech:${technicianId || ""}`;
}

export function getBalanceQty(
  state: StockState,
  itemId: string,
  locationType: StockLocationType,
  technicianId?: string,
): number {
  const row = state.balances.find((b) => {
    if (b.itemId !== itemId || b.locationType !== locationType) return false;
    if (locationType === "warehouse") return true;
    return b.technicianId === technicianId;
  });
  return row?.qty ?? 0;
}

export function setBalanceQty(
  state: StockState,
  itemId: string,
  locationType: StockLocationType,
  qty: number,
  technicianId?: string,
): void {
  const idx = state.balances.findIndex((b) => {
    if (b.itemId !== itemId || b.locationType !== locationType) return false;
    if (locationType === "warehouse") return true;
    return b.technicianId === technicianId;
  });
  if (idx >= 0) {
    state.balances[idx] = { ...state.balances[idx], qty };
    return;
  }
  state.balances.push({
    itemId,
    locationType,
    technicianId: locationType === "tech" ? technicianId : undefined,
    qty,
  });
}

export function masterQty(state: StockState, itemId: string): number {
  return state.balances
    .filter((b) => b.itemId === itemId)
    .reduce((sum, b) => sum + b.qty, 0);
}

export function warehouseQty(state: StockState, itemId: string): number {
  return getBalanceQty(state, itemId, "warehouse");
}

export function techQty(state: StockState, itemId: string, technicianId: string): number {
  return getBalanceQty(state, itemId, "tech", technicianId);
}

export async function ensureStockSeeded(technicianId: string): Promise<StockState> {
  const state = await loadStockState();
  if (state.items.length > 0) return state;
  const seeded = buildSeedState(technicianId);
  await saveStockState(seeded);
  return loadStockState();
}
