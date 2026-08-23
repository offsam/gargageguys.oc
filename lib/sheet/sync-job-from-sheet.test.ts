import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayKeyInBusinessTz, timeHmInBusinessTz } from "@/lib/datetime";
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

  it("maps arrival window labels to start clock", () => {
    assert.equal(normalizeSheetTime("9–11"), "09:00");
    assert.equal(normalizeSheetTime("9-11"), "09:00");
    assert.equal(normalizeSheetTime("1–3"), "13:00");
  });
});

describe("sheetDateTimeToStart", () => {
  it("defaults to 09:00 when time missing", () => {
    const d = sheetDateTimeToStart("2026-08-15", "");
    assert.ok(d);
    assert.equal(timeHmInBusinessTz(d!), "09:00");
    assert.equal(dayKeyInBusinessTz(d!), "2026-08-15");
  });

  it("uses explicit time", () => {
    const d = sheetDateTimeToStart("2026-08-15", "14:30");
    assert.ok(d);
    assert.equal(timeHmInBusinessTz(d!), "14:30");
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
  it("extracts Pacific HH:MM", () => {
    // 14:05 PDT = 21:05 UTC
    assert.equal(timeFromIso("2026-08-15T21:05:00.000Z"), "14:05");
  });
});
