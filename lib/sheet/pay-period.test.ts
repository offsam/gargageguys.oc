import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pacificMonthToDate,
  pacificWeekToDate,
  sheetPayDateYmd,
  sheetTechPayAmount,
  ymdInInclusiveRange,
} from "./pay-period";

describe("pay period (Pacific, matches Sheet)", () => {
  it("week is Monday through a Saturday", () => {
    // 2026-09-12 is a Saturday in Pacific if we pin a midday instant that stays that day.
    const sat = new Date("2026-09-12T19:00:00.000Z"); // noon PDT
    const range = pacificWeekToDate(sat);
    assert.equal(range.from, "2026-09-07");
    assert.equal(range.to, "2026-09-12");
  });

  it("month is the 1st through today", () => {
    const sat = new Date("2026-09-12T19:00:00.000Z");
    const range = pacificMonthToDate(sat);
    assert.equal(range.from, "2026-09-01");
    assert.equal(range.to, "2026-09-12");
    assert.equal(ymdInInclusiveRange("2026-09-01", range), true);
    assert.equal(ymdInInclusiveRange("2026-08-31", range), false);
  });
});

describe("sheetTechPayAmount", () => {
  it("uses stored salary", () => {
    assert.equal(sheetTechPayAmount({ techSalary: "120", workSource: "Garage Guys" }), 120);
  });

  it("fills partner 30% when salary is blank — same as Sheet totals", () => {
    assert.equal(
      sheetTechPayAmount({ workSource: "Partner", jobCost: "200", techSalary: "" }),
      60,
    );
  });

  it("reads the Sheet date, not updated_at", () => {
    assert.equal(
      sheetPayDateYmd({ sheetDate: "2026-09-03" }, "2026-09-12T00:00:00.000Z"),
      "2026-09-03",
    );
  });
});
