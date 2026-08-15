import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { earnedBySource, isFinanceEarned } from "./summary.ts";
import type { FinanceRow } from "./types.ts";

function row(partial: Partial<FinanceRow>): FinanceRow {
  return {
    id: "1",
    invoiceId: null,
    clientName: "Test",
    jobNumber: null,
    workDate: "2026-08-01",
    workDateLabel: "Aug 1",
    sourceKind: "garage_guys",
    sourceLabel: "Google",
    amountCents: 10000,
    status: "paid",
    invoiceUrl: null,
    publicToken: null,
    clientEmail: "",
    description: "",
    paymentType: "",
    ...partial,
  };
}

describe("isFinanceEarned", () => {
  it("counts paid/complete/signed statuses", () => {
    assert.equal(isFinanceEarned("paid"), true);
    assert.equal(isFinanceEarned("complete"), true);
    assert.equal(isFinanceEarned("signed"), true);
    assert.equal(isFinanceEarned("draft"), false);
    assert.equal(isFinanceEarned("sent"), false);
  });
});

describe("earnedBySource", () => {
  it("splits garage guys vs partners and ignores unearned", () => {
    const summary = earnedBySource([
      row({ amountCents: 20000, sourceKind: "garage_guys", status: "paid" }),
      row({
        id: "2",
        amountCents: 10000,
        sourceKind: "partner",
        sourceLabel: "Champion",
        status: "complete",
      }),
      row({
        id: "3",
        amountCents: 5000,
        sourceKind: "partner",
        sourceLabel: "Champion",
        status: "paid",
      }),
      row({
        id: "4",
        amountCents: 99999,
        sourceKind: "garage_guys",
        status: "draft",
      }),
      row({
        id: "5",
        amountCents: 3000,
        sourceKind: "unknown",
        sourceLabel: "Other",
        status: "paid",
      }),
    ]);

    assert.equal(summary.garageGuysCents, 20000);
    assert.equal(summary.otherCents, 3000);
    assert.deepEqual(summary.partners, [{ name: "Champion", cents: 15000 }]);
  });
});
