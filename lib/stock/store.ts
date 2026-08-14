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
  const removedDupes = stripDuplicatedPartnerWarehouse(state);
  const splitPairs = splitSpringPairs(state);
  if (removedDupes <= 0 && splitPairs <= 0) return state;
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

function springColorFromName(name: string): { size: string; color: "pair" | "red" | "black" } | null {
  const match = name.trim().match(/^(.+?)\s*\((pair|red|blk|black)\)\s*$/i);
  if (!match) return null;
  const label = match[2].toLowerCase();
  const color = label === "pair" ? "pair" : label === "red" ? "red" : "black";
  return { size: match[1].trim(), color };
}

function springSku(size: string, color: "red" | "black") {
  const stem = size.replace(/\*/g, "-").replace(/\s+/g, "");
  return `SPR-${stem}-${color === "red" ? "RED" : "BLK"}`;
}

function ensureSpringColorItem(
  state: StockState,
  size: string,
  color: "red" | "black",
  template: StockItem,
): StockItem {
  const existing = state.items.find((item) => {
    const parsed = springColorFromName(item.name);
    return parsed?.size === size && parsed.color === color;
  });
  if (existing) {
    existing.name = `${size} (${color})`;
    existing.active = true;
    return existing;
  }
  const item: StockItem = {
    id: randomUUID(),
    sku: springSku(size, color),
    name: `${size} (${color})`,
    category: "Springs",
    unitCostCents: Math.round((template.unitCostCents || 0) / 2),
    unit: template.unit || "ea",
    reorderAt: template.reorderAt || 0,
    active: true,
  };
  state.items.push(item);
  return item;
}

/** Drop (pair) spring SKUs: each pair becomes +1 red and +1 black at the same location. */
export function splitSpringPairs(state: StockState): number {
  let renamed = 0;
  for (const item of state.items) {
    const parsed = springColorFromName(item.name);
    if (!parsed || parsed.color === "pair") continue;
    const nextName = `${parsed.size} (${parsed.color})`;
    if (item.name !== nextName) {
      item.name = nextName;
      renamed += 1;
    }
  }

  const pairs = state.items.filter((item) => {
    if (/-PAIR$/i.test(item.sku)) return true;
    return springColorFromName(item.name)?.color === "pair";
  });
  if (pairs.length === 0) return renamed;

  const pairIds = new Set(pairs.map((item) => item.id));
  let movedPairs = 0;

  for (const pair of pairs) {
    const parsed = springColorFromName(pair.name);
    const size =
      parsed?.size ||
      pair.name.replace(/\s*\(pair\)\s*$/i, "").trim() ||
      pair.sku.replace(/^SPR-/, "").replace(/-PAIR$/i, "").replace(/-/g, "*");
    const red = ensureSpringColorItem(state, size, "red", pair);
    const black = ensureSpringColorItem(state, size, "black", pair);
    if (!red.unitCostCents && pair.unitCostCents) {
      red.unitCostCents = Math.round(pair.unitCostCents / 2);
    }
    if (!black.unitCostCents && pair.unitCostCents) {
      black.unitCostCents = Math.round(pair.unitCostCents / 2);
    }

    for (const balance of state.balances) {
      if (balance.itemId !== pair.id) continue;
      const qty = Number(balance.qty) || 0;
      if (qty <= 0) continue;
      const currentRed = getBalanceQty(
        state,
        red.id,
        balance.locationType,
        balance.technicianId,
        balance.partnerId,
      );
      const currentBlack = getBalanceQty(
        state,
        black.id,
        balance.locationType,
        balance.technicianId,
        balance.partnerId,
      );
      setBalanceQty(
        state,
        red.id,
        balance.locationType,
        currentRed + qty,
        balance.technicianId,
        balance.partnerId,
      );
      setBalanceQty(
        state,
        black.id,
        balance.locationType,
        currentBlack + qty,
        balance.technicianId,
        balance.partnerId,
      );
      movedPairs += qty;
    }
  }

  state.items = state.items.filter((item) => !pairIds.has(item.id));
  state.balances = state.balances.filter((b) => !pairIds.has(b.itemId));
  state.movements.unshift({
    id: randomUUID(),
    itemId: pairs[0]?.id || "stock",
    qty: movedPairs,
    kind: "adjust",
    note: "Split spring pairs into red and black (1 pair = 1 red + 1 black)",
    createdAt: new Date().toISOString(),
  });
  if (state.movements.length > 500) state.movements.length = 500;
  return pairs.length + renamed;
}

export async function ensureStockSeeded(technicianId: string): Promise<StockState> {
  const state = await loadStockState();
  if (state.items.length > 0) return state;
  const seeded = buildSeedState(technicianId);
  await saveStockState(seeded);
  return loadStockState();
}
