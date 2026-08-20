import { randomUUID } from "crypto";
import {
  getBalanceQty,
  loadStockState,
  partnerQty,
  saveStockState,
  setBalanceQty,
  techQty,
  warehouseQty,
  type StockItem,
  type StockLocationType,
  type StockMovementKind,
  type StockState,
} from "@/lib/stock/store";
import { SEED_STOCK_ITEMS } from "@/lib/stock/seed-catalog";
import type { ChampionPaperCount } from "@/lib/stock/champion-paper-count";

export type StockOpResult = { ok: true; state: StockState } | { ok: false; error: string };

function applyDelta(
  state: StockState,
  itemId: string,
  locationType: "warehouse" | "tech" | "partner",
  delta: number,
  technicianId?: string,
  partnerId?: string,
): string | null {
  const current = getBalanceQty(state, itemId, locationType, technicianId, partnerId);
  const next = current + delta;
  if (next < 0) {
    return `Insufficient stock (have ${current}, need ${Math.abs(delta)})`;
  }
  // Never persist negative — belt and suspenders with get/set clamps.
  setBalanceQty(state, itemId, locationType, Math.max(0, next), technicianId, partnerId);
  return null;
}

function pushMovement(
  state: StockState,
  input: {
    itemId: string;
    qty: number;
    kind: StockMovementKind;
    fromLocationType?: "warehouse" | "tech" | "partner";
    fromTechnicianId?: string;
    toLocationType?: "warehouse" | "tech" | "partner";
    toTechnicianId?: string;
    partnerId?: string;
    jobId?: string;
    note?: string;
    createdBy?: string;
  },
) {
  state.movements.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  });
  // keep last 500
  if (state.movements.length > 500) state.movements.length = 500;
}

export async function issueWarehouseToTech(input: {
  itemId: string;
  qty: number;
  technicianId: string;
  createdBy?: string;
  note?: string;
  partnerId?: string;
}): Promise<StockOpResult> {
  if (input.qty <= 0) return { ok: false, error: "Qty must be > 0" };
  const state = await loadStockState();
  if (!state.items.some((i) => i.id === input.itemId)) {
    return { ok: false, error: "Item not found" };
  }
  const fromType = input.partnerId ? "partner" : "warehouse";
  const err =
    applyDelta(state, input.itemId, fromType, -input.qty, undefined, input.partnerId) ||
    applyDelta(state, input.itemId, "tech", input.qty, input.technicianId, input.partnerId);
  if (err) return { ok: false, error: err };
  pushMovement(state, {
    itemId: input.itemId,
    qty: input.qty,
    kind: "issue_warehouse_to_tech",
    fromLocationType: fromType,
    toLocationType: "tech",
    toTechnicianId: input.technicianId,
    partnerId: input.partnerId,
    createdBy: input.createdBy,
    note: input.note,
  });
  await saveStockState(state);
  return { ok: true, state: await loadStockState() };
}

export async function receiveSupplier(input: {
  itemId: string;
  qty: number;
  destination: "warehouse" | "tech";
  technicianId?: string;
  createdBy?: string;
  note?: string;
  partnerId?: string;
}): Promise<StockOpResult> {
  if (input.qty <= 0) return { ok: false, error: "Qty must be > 0" };
  if (input.destination === "tech" && !input.technicianId) {
    return { ok: false, error: "Technician required" };
  }
  const state = await loadStockState();
  if (!state.items.some((i) => i.id === input.itemId)) {
    return { ok: false, error: "Item not found" };
  }
  const locationType =
    input.partnerId && input.destination === "warehouse" ? "partner" : input.destination;
  const kind = input.partnerId
    ? input.destination === "warehouse"
      ? "receive_supplier_to_partner"
      : "receive_supplier_to_tech"
    : input.destination === "warehouse"
      ? "receive_supplier_to_warehouse"
      : "receive_supplier_to_tech";
  const err = applyDelta(
    state,
    input.itemId,
    locationType,
    input.qty,
    input.technicianId,
    input.partnerId,
  );
  if (err) return { ok: false, error: err };
  pushMovement(state, {
    itemId: input.itemId,
    qty: input.qty,
    kind,
    toLocationType: locationType,
    toTechnicianId: input.technicianId,
    partnerId: input.partnerId,
    createdBy: input.createdBy,
    note: input.note,
  });
  await saveStockState(state);
  return { ok: true, state: await loadStockState() };
}

export async function installOnJob(input: {
  itemId: string;
  qty: number;
  technicianId: string;
  jobId?: string;
  createdBy?: string;
  note?: string;
  owner?: "gg" | string;
}): Promise<StockOpResult> {
  if (input.qty <= 0) return { ok: false, error: "Qty must be > 0" };
  const state = await loadStockState();
  if (!state.items.some((i) => i.id === input.itemId)) {
    return { ok: false, error: "Item not found" };
  }
  const partnerId =
    input.owner && input.owner !== "gg" ? input.owner : undefined;
  const err = applyDelta(
    state,
    input.itemId,
    "tech",
    -input.qty,
    input.technicianId,
    partnerId,
  );
  if (err) return { ok: false, error: err };
  pushMovement(state, {
    itemId: input.itemId,
    qty: input.qty,
    kind: partnerId ? "install_partner" : "install_on_job",
    fromLocationType: "tech",
    fromTechnicianId: input.technicianId,
    partnerId,
    jobId: input.jobId,
    createdBy: input.createdBy,
    note: input.note,
  });
  await saveStockState(state);
  return { ok: true, state: await loadStockState() };
}

export async function updateItemCost(input: {
  itemId: string;
  unitCostCents: number;
}): Promise<StockOpResult> {
  if (input.unitCostCents < 0) return { ok: false, error: "Cost cannot be negative" };
  const state = await loadStockState();
  const idx = state.items.findIndex((i) => i.id === input.itemId);
  if (idx < 0) return { ok: false, error: "Item not found" };
  state.items[idx] = { ...state.items[idx], unitCostCents: input.unitCostCents };
  await saveStockState(state);
  return { ok: true, state: await loadStockState() };
}

export async function receivePartnerStock(input: {
  itemId: string;
  qty: number;
  partnerId: string;
  createdBy?: string;
  note?: string;
}): Promise<StockOpResult> {
  if (input.qty <= 0) return { ok: false, error: "Qty must be > 0" };
  if (!input.partnerId) return { ok: false, error: "Partner required" };
  const state = await loadStockState();
  if (!state.items.some((i) => i.id === input.itemId)) {
    return { ok: false, error: "Item not found" };
  }
  const err = applyDelta(state, input.itemId, "partner", input.qty, undefined, input.partnerId);
  if (err) return { ok: false, error: err };
  pushMovement(state, {
    itemId: input.itemId,
    qty: input.qty,
    kind: "receive_supplier_to_partner",
    toLocationType: "partner",
    partnerId: input.partnerId,
    createdBy: input.createdBy,
    note: input.note || "Partner stock receive",
  });
  await saveStockState(state);
  return { ok: true, state: await loadStockState() };
}

export type SheetStockPullLeg = {
  locationType: StockLocationType;
  technicianId?: string;
  qty: number;
};

export type SheetStockPull = {
  itemId: string;
  itemName: string;
  qty: number;
  owner: "gg" | string;
  /** Where qty was taken from — used to restock the same places. */
  legs?: SheetStockPullLeg[];
};

function findItemByName(state: StockState, name: string) {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    state.items.find((i) => i.active !== false && i.name.trim().toLowerCase() === needle) || null
  );
}

function restockPull(state: StockState, pull: SheetStockPull): string | null {
  if (pull.legs?.length) {
    for (const leg of pull.legs) {
      const partnerId = pull.owner === "gg" ? undefined : pull.owner;
      const err = applyDelta(
        state,
        pull.itemId,
        leg.locationType,
        leg.qty,
        leg.technicianId,
        leg.locationType === "partner" || (leg.locationType === "tech" && partnerId)
          ? partnerId
          : undefined,
      );
      if (err) return err;
    }
    return null;
  }
  if (pull.owner === "gg") {
    return applyDelta(state, pull.itemId, "warehouse", pull.qty);
  }
  return applyDelta(state, pull.itemId, "partner", pull.qty, undefined, pull.owner);
}

function planConsumeLegs(
  state: StockState,
  owner: "gg" | string,
  itemId: string,
  qty: number,
  preferredTechId?: string,
): SheetStockPullLeg[] | null {
  let left = qty;
  const legs: SheetStockPullLeg[] = [];

  const take = (
    locationType: StockLocationType,
    available: number,
    technicianId?: string,
  ) => {
    if (left <= 0 || available <= 0) return;
    const n = Math.min(available, left);
    legs.push({ locationType, technicianId, qty: n });
    left -= n;
  };

  if (owner === "gg") {
    take("warehouse", warehouseQty(state, itemId));
    if (preferredTechId) {
      take("tech", techQty(state, itemId, preferredTechId), preferredTechId);
    }
    for (const balance of state.balances) {
      if (left <= 0) break;
      if (balance.itemId !== itemId || balance.locationType !== "tech" || balance.partnerId) {
        continue;
      }
      if (preferredTechId && balance.technicianId === preferredTechId) continue;
      take("tech", Number(balance.qty) || 0, balance.technicianId);
    }
  } else {
    take("partner", partnerQty(state, itemId, owner));
    if (preferredTechId) {
      take("tech", techQty(state, itemId, preferredTechId, owner), preferredTechId);
    }
    for (const balance of state.balances) {
      if (left <= 0) break;
      if (
        balance.itemId !== itemId ||
        balance.locationType !== "tech" ||
        balance.partnerId !== owner
      ) {
        continue;
      }
      if (preferredTechId && balance.technicianId === preferredTechId) continue;
      take("tech", Number(balance.qty) || 0, balance.technicianId);
    }
  }

  return left > 0 ? null : legs;
}

function consumePull(
  state: StockState,
  pull: SheetStockPull,
  preferredTechId?: string,
): string | null {
  const legs =
    pull.legs ||
    planConsumeLegs(state, pull.owner, pull.itemId, pull.qty, preferredTechId);
  if (!legs) {
    return `Not enough stock for “${pull.itemName}” (need ${pull.qty})`;
  }
  pull.legs = legs;
  const applied: SheetStockPullLeg[] = [];
  for (const leg of legs) {
    const partnerId = pull.owner === "gg" ? undefined : pull.owner;
    const err = applyDelta(
      state,
      pull.itemId,
      leg.locationType,
      -leg.qty,
      leg.technicianId,
      leg.locationType === "partner" || (leg.locationType === "tech" && partnerId)
        ? partnerId
        : undefined,
    );
    if (err) {
      for (const done of applied) {
        applyDelta(
          state,
          pull.itemId,
          done.locationType,
          done.qty,
          done.technicianId,
          done.locationType === "partner" || (done.locationType === "tech" && partnerId)
            ? partnerId
            : undefined,
        );
      }
      return err;
    }
    applied.push(leg);
  }
  return null;
}

export function parseSheetStockPull(raw: unknown): SheetStockPull | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const itemId = String(row.itemId || "");
  const itemName = String(row.itemName || "");
  const qty = Number(row.qty) || 0;
  const owner = String(row.owner || "");
  if (!itemId || qty <= 0 || !owner) return null;
  const legsRaw = Array.isArray(row.legs) ? row.legs : [];
  const legs: SheetStockPullLeg[] = [];
  for (const leg of legsRaw) {
    if (!leg || typeof leg !== "object") continue;
    const r = leg as Record<string, unknown>;
    const locationType = String(r.locationType || "") as StockLocationType;
    const legQty = Number(r.qty) || 0;
    if (!["warehouse", "tech", "partner"].includes(locationType) || legQty <= 0) continue;
    legs.push({
      locationType,
      technicianId: typeof r.technicianId === "string" ? r.technicianId : undefined,
      qty: legQty,
    });
  }
  return { itemId, itemName, qty, owner, legs: legs.length ? legs : undefined };
}

export function parseSheetStockPulls(raw: unknown): SheetStockPull[] {
  if (Array.isArray(raw)) {
    return raw.map((row) => parseSheetStockPull(row)).filter((p): p is SheetStockPull => Boolean(p));
  }
  const one = parseSheetStockPull(raw);
  return one ? [one] : [];
}

function pullsEqual(a: SheetStockPull[], b: SheetStockPull[]): boolean {
  if (a.length !== b.length) return false;
  const key = (p: SheetStockPull) => `${p.itemId}|${p.owner}|${p.qty}`;
  const aa = [...a].map(key).sort();
  const bb = [...b].map(key).sort();
  return aa.every((v, i) => v === bb[i]);
}

/** Sheet Completed rows pull from GG / partner stock (warehouse, then vans). Supports multi-part + qty. */
export async function syncSheetPartStock(input: {
  /** @deprecated use lines — kept for callers that still pass a single name */
  parts?: string;
  lines?: Array<{ name: string; qty: number }>;
  owner: "none" | "gg" | string;
  prevPull?: SheetStockPull | null;
  prevPulls?: SheetStockPull[];
  leadId?: string;
  createdBy?: string;
  technicianId?: string;
}): Promise<{ pull: SheetStockPull | null; pulls: SheetStockPull[]; error?: string }> {
  const state = await loadStockState();
  const prev =
    input.prevPulls && input.prevPulls.length
      ? input.prevPulls
      : input.prevPull
        ? [input.prevPull]
        : [];

  const desiredLines: Array<{ name: string; qty: number }> = [];
  if (input.lines?.length) {
    for (const line of input.lines) {
      const name = String(line.name || "").trim();
      const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
      if (name && qty > 0) desiredLines.push({ name, qty });
    }
  } else if (input.parts?.trim() && input.owner !== "none") {
    desiredLines.push({ name: input.parts.trim(), qty: 1 });
  }

  const nextPulls: SheetStockPull[] = [];
  if (input.owner !== "none") {
    for (const line of desiredLines) {
      const item = findItemByName(state, line.name);
      if (!item) {
        return {
          pull: prev[0] || null,
          pulls: prev,
          error: `Part “${line.name}” not found in stock`,
        };
      }
      nextPulls.push({
        itemId: item.id,
        itemName: item.name,
        qty: line.qty,
        owner: input.owner,
      });
    }
  }

  if (pullsEqual(prev, nextPulls)) {
    return { pull: prev[0] || null, pulls: prev };
  }

  for (const p of prev) {
    const restockErr = restockPull(state, p);
    if (restockErr) return { pull: prev[0] || null, pulls: prev, error: restockErr };
  }

  const applied: SheetStockPull[] = [];
  for (const nextPull of nextPulls) {
    const err = consumePull(state, nextPull, input.technicianId);
    if (err) {
      for (const done of applied) restockPull(state, done);
      for (const p of prev) consumePull(state, p);
      await saveStockState(state);
      return { pull: prev[0] || null, pulls: prev, error: err };
    }
    applied.push(nextPull);
    const fromLeg = nextPull.legs?.[0];
    pushMovement(state, {
      itemId: nextPull.itemId,
      qty: nextPull.qty,
      kind: nextPull.owner === "gg" ? "install_gg_for_partner" : "install_partner",
      fromLocationType: fromLeg?.locationType || (nextPull.owner === "gg" ? "warehouse" : "partner"),
      fromTechnicianId: fromLeg?.technicianId,
      partnerId: nextPull.owner === "gg" ? undefined : nextPull.owner,
      jobId: input.leadId,
      createdBy: input.createdBy,
      note: `Sheet part: ${nextPull.itemName} ×${nextPull.qty}`,
    });
  }

  await saveStockState(state);
  return { pull: nextPulls[0] || null, pulls: nextPulls };
}

/** Move warehouse + van qty onto a partner warehouse. Garage Guys locations go to 0. */
export async function moveGarageGuysStockToPartner(input: {
  partnerId: string;
  createdBy?: string;
  note?: string;
}): Promise<StockOpResult & { movedQty: number; movedItems: number }> {
  if (!input.partnerId) {
    return { ok: false, error: "Partner required", movedQty: 0, movedItems: 0 };
  }
  const state = await loadStockState();
  const byItem = new Map<string, number>();
  for (const balance of [...state.balances]) {
    if (balance.locationType === "partner" || balance.partnerId) continue;
    const qty = Number(balance.qty) || 0;
    if (qty <= 0) continue;
    byItem.set(balance.itemId, (byItem.get(balance.itemId) || 0) + qty);
    setBalanceQty(
      state,
      balance.itemId,
      balance.locationType,
      0,
      balance.technicianId,
    );
  }

  let movedQty = 0;
  for (const [itemId, qty] of byItem.entries()) {
    const err = applyDelta(state, itemId, "partner", qty, undefined, input.partnerId);
    if (err) return { ok: false, error: err, movedQty: 0, movedItems: 0 };
    movedQty += qty;
    pushMovement(state, {
      itemId,
      qty,
      kind: "adjust",
      fromLocationType: "warehouse",
      toLocationType: "partner",
      partnerId: input.partnerId,
      createdBy: input.createdBy,
      note: input.note || "Moved Garage Guys stock to partner warehouse",
    });
  }

  if (movedQty > 0) await saveStockState(state);
  return {
    ok: true,
    state: await loadStockState(),
    movedQty,
    movedItems: byItem.size,
  };
}

/** If partner parts sit only in the warehouse, put them on a tech van (same as GG seed). */
export async function loadPartnerWarehouseOntoTech(input: {
  partnerId: string;
  technicianId: string;
  createdBy?: string;
}): Promise<StockOpResult & { movedQty: number }> {
  const state = await loadStockState();
  const alreadyOnVans = state.balances.some(
    (b) =>
      b.locationType === "tech" &&
      b.partnerId === input.partnerId &&
      (Number(b.qty) || 0) > 0,
  );
  if (alreadyOnVans) {
    return { ok: true, state, movedQty: 0 };
  }

  let movedQty = 0;
  for (const item of state.items) {
    const qty = getBalanceQty(state, item.id, "partner", undefined, input.partnerId);
    if (qty <= 0) continue;
    const err =
      applyDelta(state, item.id, "partner", -qty, undefined, input.partnerId) ||
      applyDelta(state, item.id, "tech", qty, input.technicianId, input.partnerId);
    if (err) return { ok: false, error: err, movedQty: 0 };
    movedQty += qty;
    pushMovement(state, {
      itemId: item.id,
      qty,
      kind: "issue_warehouse_to_tech",
      fromLocationType: "partner",
      toLocationType: "tech",
      toTechnicianId: input.technicianId,
      partnerId: input.partnerId,
      createdBy: input.createdBy,
      note: "Loaded partner warehouse onto van",
    });
  }
  if (movedQty > 0) await saveStockState(state);
  return { ok: true, state: await loadStockState(), movedQty };
}

function skuFromName(name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `CUS-${base || "PART"}`;
}

export async function createStockItem(input: {
  name: string;
  category: string;
  subcategory?: string;
  sku?: string;
  unitCostCents?: number;
  qty?: number;
  partnerId?: string;
  createdBy?: string;
}): Promise<StockOpResult> {
  const name = input.name.trim();
  const category = input.category.trim() || "Misc";
  if (!name) return { ok: false, error: "Name required" };

  const state = await loadStockState();
  let sku = (input.sku || "").trim().toUpperCase() || skuFromName(name);
  if (state.items.some((item) => item.sku.toLowerCase() === sku.toLowerCase())) {
    sku = `${sku}-${randomUUID().slice(0, 4).toUpperCase()}`;
  }
  if (state.items.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That part already exists" };
  }

  const id = randomUUID();
  state.items.push({
    id,
    sku,
    name,
    category,
    subcategory: input.subcategory?.trim() || undefined,
    unitCostCents: Math.max(0, Math.round(input.unitCostCents || 0)),
    unit: "ea",
    reorderAt: 0,
    active: true,
  });

  const qty = Math.max(0, Math.floor(Number(input.qty) || 0));
  if (input.partnerId) {
    setBalanceQty(state, id, "partner", qty, undefined, input.partnerId);
  } else {
    setBalanceQty(state, id, "warehouse", qty);
  }
  if (qty > 0) {
    pushMovement(state, {
      itemId: id,
      qty,
      kind: input.partnerId ? "receive_supplier_to_partner" : "receive_supplier_to_warehouse",
      toLocationType: input.partnerId ? "partner" : "warehouse",
      partnerId: input.partnerId,
      createdBy: input.createdBy,
      note: "New stock item",
    });
  }

  await saveStockState(state);
  return { ok: true, state: await loadStockState() };
}

function normPartName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function findItemByLooseName(state: StockState, name: string): StockItem | undefined {
  const needle = normPartName(name);
  return state.items.find((item) => normPartName(item.name) === needle);
}

/** Overwrite partner warehouse counts. Does not touch Garage Guys stock or job history. */
export async function replacePartnerStockCounts(input: {
  partnerId: string;
  counts: ChampionPaperCount[];
}): Promise<{ ok: true; set: number; created: number } | { ok: false; error: string }> {
  if (!input.partnerId) return { ok: false, error: "Partner required" };
  const state = await loadStockState({ skipRepair: true });

  for (const balance of state.balances) {
    if (balance.partnerId === input.partnerId && balance.locationType === "tech") {
      balance.qty = 0;
    }
  }

  const touched = new Set<string>();
  let created = 0;

  for (const row of input.counts) {
    const qty = Math.max(0, Math.floor(Number(row.qty) || 0));
    let item = findItemByLooseName(state, row.name);
    if (!item) {
      const seed = SEED_STOCK_ITEMS.find((s) => normPartName(s.name) === normPartName(row.name));
      item = {
        id: randomUUID(),
        sku: seed?.sku || `CUS-${randomUUID().slice(0, 8).toUpperCase()}`,
        name: seed?.name || row.name.trim(),
        category: seed?.category || "Misc",
        subcategory: seed?.subcategory,
        unitCostCents: 0,
        unit: "ea",
        reorderAt: 0,
        active: true,
      };
      state.items.push(item);
      created += 1;
    } else {
      item.active = true;
      item.name = row.name.trim();
    }
    setBalanceQty(state, item.id, "partner", qty, undefined, input.partnerId);
    touched.add(item.id);
  }

  for (const item of state.items) {
    if (touched.has(item.id)) continue;
    setBalanceQty(state, item.id, "partner", 0, undefined, input.partnerId);
  }

  await saveStockState(state);
  return { ok: true, set: touched.size, created };
}
