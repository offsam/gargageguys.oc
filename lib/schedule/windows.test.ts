import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SCHEDULE_WINDOWS,
  firstFreeWindow,
  jobMatchesWindow,
  slotStatusForTech,
  windowRange,
} from "./windows";
import type { FieldJob } from "@/lib/field/days";

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
  it("builds local ranges for a day", () => {
    const range = windowRange("2026-08-20", SCHEDULE_WINDOWS[0]);
    assert.ok(range);
    assert.equal(range!.startLocal, "2026-08-20T08:00");
    assert.equal(range!.endLocal, "2026-08-20T10:00");
  });

  it("treats overlapping windows as independent", () => {
    const jobs = [
      job({
        id: "a",
        scheduled_start: "2026-08-20T08:00:00",
        scheduled_end: "2026-08-20T10:00:00",
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
        scheduled_start: "2026-08-20T08:00:00",
        scheduled_end: "2026-08-20T10:00:00",
      }),
    ];
    const free = firstFreeWindow(jobs, "tech-1", "2026-08-20");
    assert.equal(free?.id, "9-11");
  });
});
