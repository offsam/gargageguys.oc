import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  moveSheetColumnOrder,
  sheetColumnDropAtX,
  sheetColumnKeyAtX,
  STICKY_SHEET_COLUMNS,
} from "./column-order";

describe("moveSheetColumnOrder", () => {
  const order = [
    "jobNumber",
    "clientName",
    "date",
    "status",
    "address",
    "technician",
  ] as const;

  it("reorders non-sticky columns before a target", () => {
    const next = moveSheetColumnOrder([...order], "status", "date", STICKY_SHEET_COLUMNS, "before");
    assert.deepEqual(next, [
      "jobNumber",
      "clientName",
      "status",
      "date",
      "address",
      "technician",
    ]);
  });

  it("moves one step right when dropping after the next column", () => {
    const next = moveSheetColumnOrder([...order], "date", "status", STICKY_SHEET_COLUMNS, "after");
    assert.deepEqual(next, [
      "jobNumber",
      "clientName",
      "status",
      "date",
      "address",
      "technician",
    ]);
  });

  it("does not no-op when insert-before would leave adjacent order unchanged", () => {
    assert.equal(
      moveSheetColumnOrder([...order], "date", "status", STICKY_SHEET_COLUMNS, "before"),
      null,
    );
  });

  it("blocks moving a scroll column onto sticky Client", () => {
    assert.equal(moveSheetColumnOrder([...order], "status", "clientName"), null);
  });

  it("allows swapping sticky Job # and Client", () => {
    const next = moveSheetColumnOrder(
      [...order],
      "clientName",
      "jobNumber",
      STICKY_SHEET_COLUMNS,
      "before",
    );
    assert.deepEqual(next?.[0], "clientName");
    assert.deepEqual(next?.[1], "jobNumber");
  });
});

describe("sheetColumnDropAtX", () => {
  const headers = [
    { key: "jobNumber", left: 42, right: 120 },
    { key: "clientName", left: 120, right: 260 },
    { key: "date", left: 260, right: 360 },
    { key: "status", left: 360, right: 460 },
    { key: "address", left: 460, right: 600 },
  ] as const;

  it("does not drop a scroll column onto sticky when X is over Client", () => {
    const hit = sheetColumnKeyAtX(180, "status", [...headers], STICKY_SHEET_COLUMNS);
    assert.equal(hit, "date");
    assert.notEqual(hit, "clientName");
  });

  it("moves date one step right when past status midpoint", () => {
    // status mid = 410 — past it inserts before address (same final order as after status)
    const drop = sheetColumnDropAtX(420, "date", [...headers], STICKY_SHEET_COLUMNS);
    assert.ok(drop);
    const next = moveSheetColumnOrder(
      ["jobNumber", "clientName", "date", "status", "address"],
      "date",
      drop.key,
      STICKY_SHEET_COLUMNS,
      drop.place,
    );
    assert.deepEqual(next, ["jobNumber", "clientName", "status", "date", "address"]);
  });

  it("places before when pointer is left of target midpoint", () => {
    const drop = sheetColumnDropAtX(370, "address", [...headers], STICKY_SHEET_COLUMNS);
    assert.deepEqual(drop, { key: "status", place: "before" });
  });
});
