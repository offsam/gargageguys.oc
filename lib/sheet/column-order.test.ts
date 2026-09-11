import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moveSheetColumnOrder, sheetColumnDropAtX, sheetColumnKeyAtX } from "./column-order";

describe("moveSheetColumnOrder", () => {
  const order = [
    "jobNumber",
    "clientName",
    "date",
    "status",
    "address",
    "technician",
  ] as const;

  it("reorders any columns including Job # and Client", () => {
    const next = moveSheetColumnOrder([...order], "jobNumber", "status", "after");
    assert.deepEqual(next, [
      "clientName",
      "date",
      "status",
      "jobNumber",
      "address",
      "technician",
    ]);
  });

  it("swaps Client past Address", () => {
    const next = moveSheetColumnOrder([...order], "clientName", "address", "before");
    assert.deepEqual(next, [
      "jobNumber",
      "date",
      "status",
      "clientName",
      "address",
      "technician",
    ]);
  });

  it("moves one step right when dropping after the next column", () => {
    const next = moveSheetColumnOrder([...order], "date", "status", "after");
    assert.deepEqual(next, [
      "jobNumber",
      "clientName",
      "status",
      "date",
      "address",
      "technician",
    ]);
  });

  it("returns null for a no-op adjacent before-drop", () => {
    assert.equal(moveSheetColumnOrder([...order], "date", "status", "before"), null);
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

  it("can drop Job # onto scroll columns", () => {
    const hit = sheetColumnKeyAtX(400, "jobNumber", [...headers]);
    assert.equal(hit, "status");
  });

  it("moves date one step right when past status midpoint", () => {
    const drop = sheetColumnDropAtX(420, "date", [...headers]);
    assert.ok(drop);
    const next = moveSheetColumnOrder(
      ["jobNumber", "clientName", "date", "status", "address"],
      "date",
      drop.key,
      drop.place,
    );
    assert.deepEqual(next, ["jobNumber", "clientName", "status", "date", "address"]);
  });

  it("places before when pointer is left of target midpoint", () => {
    const drop = sheetColumnDropAtX(370, "address", [...headers]);
    assert.deepEqual(drop, { key: "status", place: "before" });
  });
});
