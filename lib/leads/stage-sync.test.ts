import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeSheetStatus,
  statusBlockedReason,
  COMPLETE_NEEDS_PRICE,
  ESTIMATE_NEEDS_PRICE,
  ESTIMATE_NEEDS_TECH,
} from "./stage-sync.ts";

describe("Estimate status", () => {
  it("normalizes Estimate", () => {
    assert.equal(normalizeSheetStatus("Estimate"), "Estimate");
    assert.equal(normalizeSheetStatus("estimate"), "Estimate");
  });

  it("requires price and technician", () => {
    assert.equal(
      statusBlockedReason("Estimate", { jobCost: "", technician: "Sam" }),
      ESTIMATE_NEEDS_PRICE,
    );
    assert.equal(
      statusBlockedReason("Estimate", { jobCost: "250", technician: "" }),
      ESTIMATE_NEEDS_TECH,
    );
    assert.equal(
      statusBlockedReason("Estimate", { jobCost: "250", technician: "Sam" }),
      null,
    );
  });

  it("still requires price for Completed", () => {
    assert.equal(statusBlockedReason("Completed", { jobCost: "" }), COMPLETE_NEEDS_PRICE);
    assert.equal(statusBlockedReason("Completed", { jobCost: "100" }), null);
  });
});

describe("No win status", () => {
  it("normalizes No win", () => {
    assert.equal(normalizeSheetStatus("No win"), "No win");
    assert.equal(normalizeSheetStatus("No Win"), "No win");
  });
});
