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
  locationType: "warehouse" | "tech",
  delta: number,
  technicianId?: string,
): string | null {
  const current = getBalanceQty(state, itemId, locationType, technicianId);
  const next = current + delta;
  if (next < 0) {
    return `Insufficient stock (have ${current}, need ${Math.abs(delta)})`;
  }
  setBalanceQty(state, itemId, locationType, next, technicianId);
  return null;
}

function pushMovement(
  state: StockState,
  input: {
    itemId: string;
    qty: number;
    kind: StockMovementKind;
    fromLocationType?: "warehouse" | "tech";
    fromTechnicianId?: string;
    toLocationType?: "warehouse" | "tech";
    toTechnicianId?: string;
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
