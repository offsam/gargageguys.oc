import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAdsReportPeriod } from "./period";

describe("resolveAdsReportPeriod", () => {
  it("resolves today and custom ranges", () => {
    const today = resolveAdsReportPeriod({ range: "today" });
    assert.equal(today.preset, "today");
    assert.equal(today.periodStart, today.periodEnd);

    const custom = resolveAdsReportPeriod({
      range: "custom",
      from: "2026-09-01",
      to: "2026-09-03",
    });
    assert.equal(custom.periodStart, "2026-09-01");
    assert.equal(custom.periodEnd, "2026-09-03");
  });

  it("falls back to Meta sync period", () => {
    const sync = resolveAdsReportPeriod({
      range: "sync",
      syncStart: "2026-08-10",
      syncEnd: "2026-09-07",
    });
    assert.equal(sync.periodStart, "2026-08-10");
    assert.equal(sync.periodEnd, "2026-09-07");
  });
});
