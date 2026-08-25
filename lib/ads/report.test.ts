import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateAdsReport } from "./report";

describe("aggregateAdsReport", () => {
  it("counts all leads by source and computes cost per completed", () => {
    const report = aggregateAdsReport(
      [
        {
          source: "Facebook",
          stage: "qualified",
          metadata: { jobStatus: "Waiting", leadCost: "25.00" },
        },
        {
          source: "Facebook",
          stage: "completed",
          metadata: { jobStatus: "Completed", jobCost: "400", leadCost: "25.00" },
        },
        {
          source: "Facebook",
          stage: "completed",
          metadata: { jobStatus: "Completed", jobCost: "600", leadCost: "25.00" },
        },
        {
          source: "Thumbtack",
          stage: "qualified",
          metadata: { jobStatus: "Estimate", leadCost: "50.00", thumbtackLeadPrice: "$55.00" },
        },
        {
          source: "Thumbtack",
          stage: "qualified",
          metadata: { jobStatus: "Waiting", leadCost: "50.00" },
        },
      ],
      {
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        metaAds: { spend: 300, leads: 10, cpl: 30 },
      },
    );

    const fb = report.rows.find((r) => r.source === "Facebook");
    assert.ok(fb);
    assert.equal(fb.received, 3);
    assert.equal(fb.waiting, 1);
    assert.equal(fb.completed, 2);
    assert.equal(fb.processed, 2);
    assert.equal(fb.revenue, 1000);
    assert.equal(fb.spend, 300);
    assert.equal(fb.leadCost, 30);
    assert.equal(fb.cpl, 30);
    assert.equal(fb.costPerCompleted, 150);

    const tt = report.rows.find((r) => r.source === "Thumbtack");
    assert.ok(tt);
    assert.equal(tt.received, 2);
    assert.equal(tt.estimate, 1);
    assert.equal(tt.spend, 105);
  });

  it("splits Meta spend between Facebook and Instagram by lead count", () => {
    const report = aggregateAdsReport(
      [
        { source: "Facebook", metadata: { jobStatus: "Waiting" } },
        { source: "Facebook", metadata: { jobStatus: "Waiting" } },
        { source: "Instagram", metadata: { jobStatus: "Waiting" } },
      ],
      {
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        metaAds: { spend: 100, leads: 5, cpl: 20 },
      },
    );

    const fb = report.rows.find((r) => r.source === "Facebook");
    const ig = report.rows.find((r) => r.source === "Instagram");
    assert.equal(fb?.spend, 66.66666666666666);
    assert.equal(fb?.leadCost, 20);
    assert.equal(ig?.spend, 33.33333333333333);
    assert.equal(ig?.leadCost, 20);
  });

  it("uses Meta CPL for Facebook burned lead cost, not Sheet $25", () => {
    const report = aggregateAdsReport(
      [
        {
          source: "Facebook",
          metadata: { jobStatus: "Cancelled", leadCost: "25.00" },
        },
        {
          source: "Facebook",
          metadata: { jobStatus: "No win", leadCost: "25.00" },
        },
        {
          source: "Thumbtack",
          metadata: { jobStatus: "Cancelled", thumbtackLeadPrice: "$50.00" },
        },
      ],
      {
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        metaAds: { spend: 150, leads: 5, cpl: 30 },
      },
    );

    const fb = report.rows.find((r) => r.source === "Facebook");
    assert.ok(fb);
    assert.equal(fb.cancelled, 1);
    assert.equal(fb.noWin, 1);
    assert.equal(fb.completed, 0);
    assert.equal(fb.leadCost, 30);
    assert.equal(fb.cpl, 30);
    assert.equal(fb.leadCostBurned, 60);
    assert.equal(fb.costPerCompleted, null);

    const tt = report.rows.find((r) => r.source === "Thumbtack");
    assert.ok(tt);
    assert.equal(tt.cancelled, 1);
    assert.equal(tt.leadCostBurned, 50);
  });
});
