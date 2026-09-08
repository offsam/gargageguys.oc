import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStockReceiveHistory } from "./receive-history";
import type { StockItem, StockMovement } from "./store";

const items: StockItem[] = [
  {
    id: "i1",
    sku: "MSC-ENDPL",
    name: "End plates",
    category: "Misc",
    unitCostCents: 0,
    unit: "ea",
    reorderAt: 0,
    active: true,
  },
  {
    id: "i2",
    sku: "SPR-218-28-RED",
    name: "218*28 (red)",
    category: "Springs",
    unitCostCents: 0,
    unit: "ea",
    reorderAt: 0,
    active: true,
  },
];

describe("buildStockReceiveHistory", () => {
  it("groups receives by Pacific day and totals qty", () => {
    const movements: StockMovement[] = [
      {
        id: "m1",
        itemId: "i1",
        qty: 2,
        kind: "receive_supplier_to_tech",
        toTechnicianId: "tech-a",
        createdBy: "tech-a",
        createdAt: "2026-09-08T18:00:00.000Z",
      },
      {
        id: "m2",
        itemId: "i2",
        qty: 1,
        kind: "receive_supplier_to_tech",
        toTechnicianId: "tech-a",
        createdBy: "tech-a",
        createdAt: "2026-09-08T19:00:00.000Z",
      },
      {
        id: "m3",
        itemId: "i1",
        qty: 5,
        kind: "receive_supplier_to_warehouse",
        createdBy: "owner-1",
        createdAt: "2026-09-07T20:00:00.000Z",
      },
      {
        id: "m4",
        itemId: "i1",
        qty: 1,
        kind: "install_on_job",
        createdAt: "2026-09-08T12:00:00.000Z",
      },
    ];

    const days = buildStockReceiveHistory({
      movements,
      items,
      technicians: [{ id: "tech-a", label: "Sam" }],
    });

    assert.equal(days.length, 2);
    assert.equal(days[0]!.date, "2026-09-08");
    assert.equal(days[0]!.totalQty, 3);
    assert.equal(days[0]!.lineCount, 2);
    assert.equal(days[1]!.date, "2026-09-07");
    assert.equal(days[1]!.totalQty, 5);
  });

  it("filters to one technician van receives", () => {
    const movements: StockMovement[] = [
      {
        id: "m1",
        itemId: "i1",
        qty: 2,
        kind: "receive_supplier_to_tech",
        toTechnicianId: "tech-a",
        createdAt: "2026-09-08T18:00:00.000Z",
      },
      {
        id: "m2",
        itemId: "i1",
        qty: 9,
        kind: "receive_supplier_to_tech",
        toTechnicianId: "tech-b",
        createdAt: "2026-09-08T18:00:00.000Z",
      },
    ];
    const days = buildStockReceiveHistory({
      movements,
      items,
      technicians: [
        { id: "tech-a", label: "Sam" },
        { id: "tech-b", label: "Alex" },
      ],
      technicianId: "tech-a",
    });
    assert.equal(days[0]!.totalQty, 2);
  });
});
