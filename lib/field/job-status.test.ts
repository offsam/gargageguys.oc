import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAddJobItems,
  isValidFieldAdvance,
  nextFieldStatus,
  fieldFlowIndex,
} from "./job-status";

describe("nextFieldStatus", () => {
  it("advances queued → assigned → en_route → on_site", () => {
    assert.equal(nextFieldStatus("queued"), "assigned");
    assert.equal(nextFieldStatus("assigned"), "en_route");
    assert.equal(nextFieldStatus("en_route"), "on_site");
    assert.equal(nextFieldStatus("on_site"), null);
  });

  it("stops at done/cancelled", () => {
    assert.equal(nextFieldStatus("done"), null);
    assert.equal(nextFieldStatus("cancelled"), null);
  });
});

describe("isValidFieldAdvance", () => {
  it("allows only the next step", () => {
    assert.equal(isValidFieldAdvance("assigned", "en_route"), true);
    assert.equal(isValidFieldAdvance("assigned", "on_site"), false);
    assert.equal(isValidFieldAdvance("assigned", "done"), false);
  });
});

describe("canAddJobItems", () => {
  it("unlocks parts/services on site", () => {
    assert.equal(canAddJobItems("assigned"), false);
    assert.equal(canAddJobItems("en_route"), false);
    assert.equal(canAddJobItems("on_site"), true);
    assert.equal(canAddJobItems("done"), true);
  });
});

describe("fieldFlowIndex", () => {
  it("treats queued as before step 1", () => {
    assert.equal(fieldFlowIndex("queued"), -1);
    assert.equal(fieldFlowIndex("assigned"), 0);
    assert.equal(fieldFlowIndex("on_site"), 2);
  });
});
