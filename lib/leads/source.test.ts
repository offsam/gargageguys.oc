import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalLeadSource, sheetLeadCostFor } from "./source";

describe("canonicalLeadSource", () => {
  it("maps Meta Ads to Facebook", () => {
    assert.equal(canonicalLeadSource("Meta Ads"), "Facebook");
  });

  it("maps Instagram from campaign hint", () => {
    assert.equal(
      canonicalLeadSource("Meta Ads", { campaignName: "IG garage springs", adName: "" }),
      "Instagram",
    );
  });

  it("maps Thumbtack and Google", () => {
    assert.equal(canonicalLeadSource("thumbtack webhook"), "Thumbtack");
    assert.equal(canonicalLeadSource("Google Ads"), "Google");
  });
});

describe("sheetLeadCostFor", () => {
  it("fills Thumbtack $50 and Facebook $25", () => {
    assert.equal(sheetLeadCostFor("Thumbtack", ""), "50.00");
    assert.equal(sheetLeadCostFor("Facebook", ""), "25.00");
    assert.equal(sheetLeadCostFor("Instagram", ""), "25.00");
  });

  it("keeps an explicit cost", () => {
    assert.equal(sheetLeadCostFor("Thumbtack", "12.00"), "12.00");
  });

  it("leaves Website empty", () => {
    assert.equal(sheetLeadCostFor("Website", ""), "");
  });
});
