import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBalanceQty, setBalanceQty, type StockState } from "./store";

function emptyState(): StockState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "atom",
        sku: "ATOM",
        name: "Atom",
        category: "Misc",
        unitCostCents: 100,
        unit: "ea",
        reorderAt: 0,
        active: true,
      },
    ],
    balances: [],
    movements: [],
  };
}

describe("stock balance clamp", () => {
  it("never stores negative qty", () => {
    const state = emptyState();
    setBalanceQty(state, "atom", "tech", -1, "tech-1");
    assert.equal(getBalanceQty(state, "atom", "tech", "tech-1"), 0);
  });

  it("sums duplicate tech buckets and collapses on write", () => {
    const state = emptyState();
    state.balances.push(
      { itemId: "atom", locationType: "tech", technicianId: "tech-1", qty: 1 },
      { itemId: "atom", locationType: "tech", technicianId: "tech-1", qty: 1 },
    );
    assert.equal(getBalanceQty(state, "atom", "tech", "tech-1"), 2);
    setBalanceQty(state, "atom", "tech", 1, "tech-1");
    assert.equal(
      state.balances.filter(
        (b) => b.itemId === "atom" && b.locationType === "tech" && b.technicianId === "tech-1",
      ).length,
      1,
    );
    assert.equal(getBalanceQty(state, "atom", "tech", "tech-1"), 1);
  });

  it("keeps partner van bucket separate from GG van", () => {
    const state = emptyState();
    setBalanceQty(state, "atom", "tech", 2, "tech-1");
    setBalanceQty(state, "atom", "tech", 3, "tech-1", "partner-1");
    assert.equal(getBalanceQty(state, "atom", "tech", "tech-1"), 2);
    assert.equal(getBalanceQty(state, "atom", "tech", "tech-1", "partner-1"), 3);
  });
});
