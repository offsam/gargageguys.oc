import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  busyJobsFromSheetRows,
  mergeScheduleBusyJobs,
} from "@/lib/schedule/sheet-busy";

describe("busyJobsFromSheetRows", () => {
  it("marks sheet bookings busy for that tech window", () => {
    const jobs = busyJobsFromSheetRows(
      [
        {
          id: "a",
          date: "2026-08-20",
          time: "10:00",
          technician: "Sam",
          clientName: "Alice",
          jobStatus: "Scheduled",
        },
        {
          id: "b",
          date: "2026-08-20",
          time: "14:00",
          technician: "Sam",
          clientName: "Bob",
          jobStatus: "Waiting",
        },
      ],
      [{ id: "tech-1", name: "Sam" }],
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].technician_id, "tech-1");
    assert.equal(jobs[0].title, "Alice");
  });

  it("excludes the row being scheduled", () => {
    const jobs = busyJobsFromSheetRows(
      [
        {
          id: "a",
          date: "2026-08-20",
          time: "10:00",
          technician: "Sam",
          jobStatus: "Scheduled",
        },
      ],
      [{ id: "tech-1", name: "Sam" }],
      "a",
    );
    assert.equal(jobs.length, 0);
  });
});

describe("mergeScheduleBusyJobs", () => {
  it("prefers field jobs and adds sheet-only slots", () => {
    const merged = mergeScheduleBusyJobs(
      [
        {
          id: "j1",
          title: "Field",
          status: "assigned",
          zip: null,
          address: null,
          notes: null,
          scheduled_start: "2026-08-20T17:00:00.000Z",
          scheduled_end: null,
          technician_id: "tech-1",
        },
      ],
      [
        {
          id: "sheet-a",
          title: "Sheet",
          status: "assigned",
          zip: null,
          address: null,
          notes: null,
          scheduled_start: "2026-08-20T17:00:00.000Z",
          scheduled_end: null,
          technician_id: "tech-1",
        },
        {
          id: "sheet-b",
          title: "Other",
          status: "assigned",
          zip: null,
          address: null,
          notes: null,
          scheduled_start: "2026-08-20T19:00:00.000Z",
          scheduled_end: null,
          technician_id: "tech-1",
        },
      ],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, "j1");
    assert.equal(merged[1].id, "sheet-b");
  });
});
