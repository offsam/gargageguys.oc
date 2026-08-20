import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeSheetTime,
  sheetDateTimeToStart,
  shouldSyncSheetStatusToJob,
  timeFromIso,
} from "./sync-job-from-sheet";

describe("normalizeSheetTime", () => {
  it("pads HH:MM", () => {
    assert.equal(normalizeSheetTime("9:05"), "09:05");
    assert.equal(normalizeSheetTime("14:30"), "14:30");
  });

  it("parses am/pm", () => {
    assert.equal(normalizeSheetTime("9:00 AM"), "09:00");
    assert.equal(normalizeSheetTime("2:30 pm"), "14:30");
  });

  it("rejects junk", () => {
    assert.equal(normalizeSheetTime("noon"), "");
    assert.equal(normalizeSheetTime(""), "");
  });
});

describe("sheetDateTimeToStart", () => {
  it("defaults to 09:00 when time missing", () => {
    const d = sheetDateTimeToStart("2026-08-15", "");
    assert.ok(d);
    assert.equal(d!.getHours(), 9);
    assert.equal(d!.getMinutes(), 0);
    assert.equal(d!.getFullYear(), 2026);
    assert.equal(d!.getMonth(), 7);
    assert.equal(d!.getDate(), 15);
  });

  it("uses explicit time", () => {
    const d = sheetDateTimeToStart("2026-08-15", "14:30");
    assert.ok(d);
    assert.equal(d!.getHours(), 14);
    assert.equal(d!.getMinutes(), 30);
  });

  it("rejects bad dates", () => {
    assert.equal(sheetDateTimeToStart("not-a-date", "10:00"), null);
  });
});

describe("shouldSyncSheetStatusToJob", () => {
  it("syncs scheduled and completed", () => {
    assert.equal(shouldSyncSheetStatusToJob("Scheduled"), true);
    assert.equal(shouldSyncSheetStatusToJob("Completed"), true);
    assert.equal(shouldSyncSheetStatusToJob("Waiting"), false);
  });
});

describe("timeFromIso", () => {
  it("extracts local HH:MM", () => {
    const iso = new Date(2026, 7, 15, 14, 5, 0).toISOString();
    assert.equal(timeFromIso(iso), "14:05");
  });
});
