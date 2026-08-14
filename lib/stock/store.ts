import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SEED_STOCK_ITEMS } from "@/lib/stock/seed-catalog";

export const STOCK_BUCKET = "bos-data";
export const STOCK_OBJECT = "stock.json";

export type StockLocationType = "warehouse" | "tech" | "partner";

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
  partnerId?: string;
  qty: number;
};

export type StockMovementKind =
  | "seed"
  | "issue_warehouse_to_tech"
  | "receive_supplier_to_warehouse"
  | "receive_supplier_to_tech"
  | "receive_supplier_to_partner"
  | "install_on_job"
  | "install_partner"
  | "install_gg_for_partner"
  | "adjust";

export type StockMovement = {
  id: string;
  itemId: string;
  qty: number;
  kind: StockMovementKind;
  fromLocationType?: StockLocationType;
  fromTechnicianId?: string;
  fromPartnerId?: string;
  toLocationType?: StockLocationType;
  toTechnicianId?: string;
  toPartnerId?: string;
  partnerId?: string;
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

export async function loadStockState(options?: {
  skipRepair?: boolean;
}): Promise<StockState> {
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
  const state = JSON.parse(text) as StockState;
  if (options?.skipRepair) return state;
  const removed = stripDuplicatedPartnerWarehouse(state);
  if (removed <= 0) return state;
  await saveStockState(state);
  return {
    ...state,
    version: state.version + 1,
    updatedAt: new Date().toISOString(),
  };
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
  partnerId?: string,
) {
  if (locationType === "warehouse") return `${itemId}:warehouse`;
  if (locationType === "partner") return `${itemId}:partner:${partnerId || ""}`;
  if (partnerId) return `${itemId}:tech:${technicianId || ""}:partner:${partnerId}`;
  return `${itemId}:tech:${technicianId || ""}`;
}

function matchBalance(
  b: StockBalance,
  itemId: string,
  locationType: StockLocationType,
  technicianId?: string,
  partnerId?: string,
) {
  if (b.itemId !== itemId || b.locationType !== locationType) return false;
  if (locationType === "warehouse") return !b.partnerId;
  if (locationType === "partner") return b.partnerId === partnerId;
  if (partnerId) return b.technicianId === technicianId && b.partnerId === partnerId;
  return b.technicianId === technicianId && !b.partnerId;
}

export function getBalanceQty(
  state: StockState,
  itemId: string,
  locationType: StockLocationType,
  technicianId?: string,
  partnerId?: string,
): number {
  const row = state.balances.find((b) =>
    matchBalance(b, itemId, locationType, technicianId, partnerId),
  );
  return row?.qty ?? 0;
}

export function setBalanceQty(
  state: StockState,
  itemId: string,
  locationType: StockLocationType,
  qty: number,
  technicianId?: string,
  partnerId?: string,
): void {
  const idx = state.balances.findIndex((b) =>
    matchBalance(b, itemId, locationType, technicianId, partnerId),
  );
  if (idx >= 0) {
    state.balances[idx] = {
      ...state.balances[idx],
      qty,
      partnerId:
        locationType === "partner" || (locationType === "tech" && partnerId)
          ? partnerId
          : undefined,
    };
    return;
  }
  state.balances.push({
    itemId,
    locationType,
    technicianId: locationType === "tech" ? technicianId : undefined,
    partnerId:
      locationType === "partner" || (locationType === "tech" && partnerId)
        ? partnerId
        : undefined,
    qty,
  });
}

export function masterQty(state: StockState, itemId: string): number {
  return state.balances
    .filter((b) => b.itemId === itemId && b.locationType !== "partner" && !b.partnerId)
    .reduce((sum, b) => sum + b.qty, 0);
}

export function warehouseQty(state: StockState, itemId: string): number {
  return getBalanceQty(state, itemId, "warehouse");
}

export function techQty(
  state: StockState,
  itemId: string,
  technicianId: string,
  partnerId?: string,
): number {
  return getBalanceQty(state, itemId, "tech", technicianId, partnerId);
}

export function partnerQty(state: StockState, itemId: string, partnerId: string): number {
  return getBalanceQty(state, itemId, "partner", undefined, partnerId);
}

export function partnerMasterQty(state: StockState, itemId: string, partnerId: string): number {
  return state.balances
    .filter((b) => b.itemId === itemId && b.partnerId === partnerId)
    .reduce((sum, b) => sum + b.qty, 0);
}

const CHAMPION_LOAD_NOTE = "Loaded partner warehouse onto van";

/** Extra Champion warehouse copies from the Stock page re-running the move. Van qty stays. */
export function stripDuplicatedPartnerWarehouse(state: StockState): number {
  const partnerIds = [
    ...new Set(
      state.balances.map((b) => b.partnerId).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (partnerIds.length === 0) return 0;

  let removed = 0;
  for (const partnerId of partnerIds) {
    const lastLoadAt = state.movements
      .filter((m) => m.note === CHAMPION_LOAD_NOTE && m.partnerId === partnerId)
      .reduce((latest, m) => ((m.createdAt || "") > latest ? m.createdAt : latest), "");

    for (const item of state.items) {
      const warehouse = getBalanceQty(state, item.id, "partner", undefined, partnerId);
      if (warehouse <= 0) continue;
      const van = state.balances
        .filter(
          (b) =>
            b.itemId === item.id &&
            b.locationType === "tech" &&
            b.partnerId === partnerId,
        )
        .reduce((sum, b) => sum + (Number(b.qty) || 0), 0);

      let keep = warehouse;
      if (lastLoadAt) {
        keep = 0;
        for (const m of state.movements) {
          if (m.itemId !== item.id || m.partnerId !== partnerId) continue;
          if ((m.createdAt || "") <= lastLoadAt) continue;
          if (m.kind === "receive_supplier_to_partner") keep += Number(m.qty) || 0;
          if (m.kind === "issue_warehouse_to_tech" && m.fromLocationType === "partner") {
            keep -= Number(m.qty) || 0;
          }
        }
        keep = Math.max(0, keep);
      } else if (van > 0 && warehouse % van === 0) {
        keep = 0;
      } else {
        continue;
      }

      if (keep >= warehouse) continue;
      removed += warehouse - keep;
      setBalanceQty(state, item.id, "partner", keep, undefined, partnerId);
    }
  }

  if (removed > 0) {
    state.movements.unshift({
      id: randomUUID(),
      itemId: state.items[0]?.id || "stock",
      qty: removed,
      kind: "adjust",
      note: "Removed duplicate Champion warehouse counts from repeated Stock page move",
      createdAt: new Date().toISOString(),
    });
    if (state.movements.length > 500) state.movements.length = 500;
  }
  return removed;
}

export async function ensureStockSeeded(technicianId: string): Promise<StockState> {
  const state = await loadStockState();
  if (state.items.length > 0) return state;
  const seeded = buildSeedState(technicianId);
  await saveStockState(seeded);
  return loadStockState();
}
