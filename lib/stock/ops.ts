import { randomUUID } from "crypto";
import {
  getBalanceQty,
  loadStockState,
  saveStockState,
  setBalanceQty,
  type StockMovementKind,
  type StockState,
} from "@/lib/stock/store";

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
  setBalanceQty(state, itemId, locationType, next, technicianId, partnerId);
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
}): Promise<StockOpResult> {
  if (input.qty <= 0) return { ok: false, error: "Qty must be > 0" };
  const state = await loadStockState();
  if (!state.items.some((i) => i.id === input.itemId)) {
    return { ok: false, error: "Item not found" };
  }
  const err =
    applyDelta(state, input.itemId, "warehouse", -input.qty) ||
    applyDelta(state, input.itemId, "tech", input.qty, input.technicianId);
  if (err) return { ok: false, error: err };
  pushMovement(state, {
    itemId: input.itemId,
    qty: input.qty,
    kind: "issue_warehouse_to_tech",
    fromLocationType: "warehouse",
    toLocationType: "tech",
    toTechnicianId: input.technicianId,
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
}): Promise<StockOpResult> {
  if (input.qty <= 0) return { ok: false, error: "Qty must be > 0" };
  if (input.destination === "tech" && !input.technicianId) {
    return { ok: false, error: "Technician required" };
  }
  const state = await loadStockState();
  if (!state.items.some((i) => i.id === input.itemId)) {
    return { ok: false, error: "Item not found" };
  }
  const kind =
    input.destination === "warehouse"
      ? "receive_supplier_to_warehouse"
      : "receive_supplier_to_tech";
  const err = applyDelta(
    state,
    input.itemId,
    input.destination,
    input.qty,
    input.technicianId,
  );
  if (err) return { ok: false, error: err };
  pushMovement(state, {
    itemId: input.itemId,
    qty: input.qty,
    kind,
    toLocationType: input.destination,
    toTechnicianId: input.technicianId,
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
}): Promise<StockOpResult> {
  if (input.qty <= 0) return { ok: false, error: "Qty must be > 0" };
  const state = await loadStockState();
  if (!state.items.some((i) => i.id === input.itemId)) {
    return { ok: false, error: "Item not found" };
  }
  const err = applyDelta(state, input.itemId, "tech", -input.qty, input.technicianId);
  if (err) return { ok: false, error: err };
  pushMovement(state, {
    itemId: input.itemId,
    qty: input.qty,
    kind: "install_on_job",
    fromLocationType: "tech",
    fromTechnicianId: input.technicianId,
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

export type SheetStockPull = {
  itemId: string;
  itemName: string;
  qty: number;
  owner: "gg" | string;
};

function findItemByName(state: StockState, name: string) {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    state.items.find((i) => i.active !== false && i.name.trim().toLowerCase() === needle) || null
  );
}

function restockPull(state: StockState, pull: SheetStockPull): string | null {
  if (pull.owner === "gg") {
    return applyDelta(state, pull.itemId, "warehouse", pull.qty);
  }
  return applyDelta(state, pull.itemId, "partner", pull.qty, undefined, pull.owner);
}

function consumePull(state: StockState, pull: SheetStockPull): string | null {
  if (pull.owner === "gg") {
    return applyDelta(state, pull.itemId, "warehouse", -pull.qty);
  }
  return applyDelta(state, pull.itemId, "partner", -pull.qty, undefined, pull.owner);
}

export function parseSheetStockPull(raw: unknown): SheetStockPull | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const itemId = String(row.itemId || "");
  const itemName = String(row.itemName || "");
  const qty = Number(row.qty) || 0;
  const owner = String(row.owner || "");
  if (!itemId || qty <= 0 || !owner) return null;
  return { itemId, itemName, qty, owner };
}

/** Partner Sheet jobs consume GG warehouse or that partner's warehouse. Own GG jobs stay on Field vans. */
export async function syncSheetPartStock(input: {
  parts: string;
  owner: "none" | "gg" | string;
  prevPull: SheetStockPull | null;
  leadId?: string;
  createdBy?: string;
}): Promise<{ pull: SheetStockPull | null }> {
  const state = await loadStockState();
  const prev = input.prevPull;
  const desiredName = input.parts.trim();
  const desiredItem =
    input.owner !== "none" && desiredName ? findItemByName(state, desiredName) : null;
  const nextPull: SheetStockPull | null =
    desiredItem && input.owner !== "none"
      ? {
          itemId: desiredItem.id,
          itemName: desiredItem.name,
          qty: 1,
          owner: input.owner,
        }
      : null;

  const same =
    prev &&
    nextPull &&
    prev.itemId === nextPull.itemId &&
    prev.owner === nextPull.owner &&
    prev.qty === nextPull.qty;
  if (same) return { pull: prev };

  if (prev) restockPull(state, prev);
  if (nextPull) {
    const err = consumePull(state, nextPull);
    if (err) {
      if (prev) consumePull(state, prev);
      return { pull: prev };
    }
    pushMovement(state, {
      itemId: nextPull.itemId,
      qty: nextPull.qty,
      kind: nextPull.owner === "gg" ? "install_gg_for_partner" : "install_partner",
      fromLocationType: nextPull.owner === "gg" ? "warehouse" : "partner",
      partnerId: nextPull.owner === "gg" ? undefined : nextPull.owner,
      jobId: input.leadId,
      createdBy: input.createdBy,
      note: `Sheet part: ${nextPull.itemName}`,
    });
  }

  await saveStockState(state);
  return { pull: nextPull };
}
