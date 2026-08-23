import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SCHEDULE_WINDOWS,
  findWindowForSheetTime,
  firstFreeWindow,
  jobMatchesWindow,
  sheetTimeForWindow,
  sheetTimeSelectOptions,
  slotStatusForTech,
  windowRange,
} from "./windows";
import type { FieldJob } from "@/lib/field/days";
import { parseLocalDateTime } from "@/lib/datetime";

function job(partial: Partial<FieldJob> & { id: string }): FieldJob {
  return {
    title: "Job",
    status: "assigned",
    zip: null,
    address: null,
    notes: null,
    scheduled_start: null,
    scheduled_end: null,
    technician_id: "tech-1",
    ...partial,
  };
}

describe("schedule windows", () => {
  it("builds Pacific ranges for a day", () => {
    const range = windowRange("2026-08-20", SCHEDULE_WINDOWS[0]);
    assert.ok(range);
    assert.equal(range!.startLocal, "2026-08-20T08:00");
    assert.equal(range!.endLocal, "2026-08-20T10:00");
    // 8:00 AM PDT = 15:00 UTC
    assert.equal(range!.start.toISOString(), "2026-08-20T15:00:00.000Z");
  });

  it("parses datetime-local as Pacific on a UTC-like wall clock", () => {
    const d = parseLocalDateTime("2026-08-20T15:00");
    assert.ok(d);
    // 3:00 PM PDT = 22:00 UTC
    assert.equal(d!.toISOString(), "2026-08-20T22:00:00.000Z");
  });

  it("treats overlapping windows as independent", () => {
    const jobs = [
      job({
        id: "a",
        // 8:00 AM Pacific
        scheduled_start: "2026-08-20T15:00:00.000Z",
        scheduled_end: "2026-08-20T17:00:00.000Z",
      }),
    ];
    const eightTen = SCHEDULE_WINDOWS.find((w) => w.id === "8-10")!;
    const nineEleven = SCHEDULE_WINDOWS.find((w) => w.id === "9-11")!;
    assert.equal(slotStatusForTech(jobs, "tech-1", "2026-08-20", eightTen).status, "busy");
    assert.equal(slotStatusForTech(jobs, "tech-1", "2026-08-20", nineEleven).status, "free");
    assert.equal(jobMatchesWindow(jobs[0], "2026-08-20", nineEleven), false);
  });

  it("finds the first free window", () => {
    const jobs = [
      job({
        id: "a",
        scheduled_start: "2026-08-20T15:00:00.000Z",
        scheduled_end: "2026-08-20T17:00:00.000Z",
      }),
    ];
    const free = firstFreeWindow(jobs, "tech-1", "2026-08-20");
    assert.equal(free?.id, "9-11");
  });

  it("maps sheet times to arrival windows for the Time column", () => {
    const nine = findWindowForSheetTime("09:00");
    assert.equal(nine?.label, "9–11");
    assert.equal(sheetTimeForWindow(nine!), "09:00");
    assert.equal(findWindowForSheetTime("9–11")?.id, "9-11");
    const opts = sheetTimeSelectOptions();
    assert.ok(opts.some((o) => o.value === "09:00" && o.label === "9–11"));
  });
});
