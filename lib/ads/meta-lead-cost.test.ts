import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMetaPricingIndex,
  resolveMetaLeadCost,
  resolveSheetLeadCost,
} from "./meta-lead-cost";

describe("meta lead cost", () => {
  it("uses campaign CPL when metaCampaignId matches", () => {
    const index = buildMetaPricingIndex({
      id: "1",
      platform: "meta",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      account_id: null,
      spend: 200,
      impressions: null,
      clicks: null,
      leads: 10,
      cpl: 20,
      metrics: {
        campaigns: [
          { id: "camp-a", name: "Springs", spend: 80, leads: 4, cpl: 20, impressions: 0, clicks: 0 },
          { id: "camp-b", name: "Doors", spend: 120, leads: 4, cpl: 30, impressions: 0, clicks: 0 },
        ],
      },
      synced_at: "2026-08-25T00:00:00.000Z",
      created_at: "2026-08-25T00:00:00.000Z",
    });

    assert.equal(
      resolveMetaLeadCost({ metaCampaignId: "camp-b", metaCampaignName: "Doors" }, index),
      "30.00",
    );
    assert.equal(
      resolveSheetLeadCost("Facebook", { metaCampaignId: "camp-a" }, index),
      "20.00",
    );
  });

  it("falls back to account CPL", () => {
    const index = buildMetaPricingIndex({
      id: "1",
      platform: "meta",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      account_id: null,
      spend: 160,
      impressions: null,
      clicks: null,
      leads: 10,
      cpl: 16,
      metrics: { campaigns: [] },
      synced_at: "2026-08-25T00:00:00.000Z",
      created_at: "2026-08-25T00:00:00.000Z",
    });

    assert.equal(resolveMetaLeadCost({ metaCampaignId: "unknown" }, index), "16.00");
  });
});
