import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPaidAdsFeedLead } from "./ads-feed";

describe("isPaidAdsFeedLead", () => {
  it("keeps Thumbtack / Meta / Google", () => {
    assert.equal(isPaidAdsFeedLead({ source: "Thumbtack" }), true);
    assert.equal(isPaidAdsFeedLead({ source: "Facebook" }), true);
    assert.equal(isPaidAdsFeedLead({ source: "Instagram" }), true);
    assert.equal(isPaidAdsFeedLead({ source: "Google" }), true);
  });

  it("excludes Champion partner jobs", () => {
    assert.equal(
      isPaidAdsFeedLead({
        source: "Champion Garage Doors Service",
        metadata: { workSource: "Partner", partnerName: "Champion Garage Doors Service" },
      }),
      false,
    );
    assert.equal(
      isPaidAdsFeedLead({
        source: "Thumbtack",
        metadata: { workSource: "Partner", partnerName: "Champion" },
      }),
      false,
    );
  });

  it("excludes Website and Referral", () => {
    assert.equal(isPaidAdsFeedLead({ source: "Website" }), false);
    assert.equal(isPaidAdsFeedLead({ source: "Referral" }), false);
  });
});
