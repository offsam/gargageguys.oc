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
    // Old bug: insert-before on the right neighbor always returned null.
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
    // scrolled column visually under sticky zone (left is off-screen-ish)
    { key: "date", left: -40, right: 80 },
    { key: "status", left: 260, right: 360 },
    { key: "address", left: 360, right: 500 },
  ] as const;

  it("does not drop a scroll column onto sticky when X is over Client", () => {
    const hit = sheetColumnKeyAtX(180, "status", [...headers], STICKY_SHEET_COLUMNS);
    // Same-group nearest is date (scrolled under sticky), never clientName.
    assert.equal(hit, "date");
    assert.notEqual(hit, "clientName");
  });

  it("hits the visible scroll column under the pointer", () => {
    const hit = sheetColumnKeyAtX(300, "address", [...headers], STICKY_SHEET_COLUMNS);
    assert.equal(hit, "status");
  });

  it("places after when pointer is on the right half of the target", () => {
    const drop = sheetColumnDropAtX(330, "date", [...headers], STICKY_SHEET_COLUMNS);
    assert.deepEqual(drop, { key: "status", place: "after" });
  });

  it("places before when pointer is on the left half of the target", () => {
    const drop = sheetColumnDropAtX(280, "address", [...headers], STICKY_SHEET_COLUMNS);
    assert.deepEqual(drop, { key: "status", place: "before" });
  });
});
