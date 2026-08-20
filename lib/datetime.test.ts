import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dayKeyInBusinessTz,
  parseLocalDateTime,
  timeHmInBusinessTz,
  toDatetimeLocalValue,
} from "./datetime";

describe("datetime Pacific", () => {
  it("round-trips a summer afternoon", () => {
    const d = parseLocalDateTime("2026-08-20T15:00");
    assert.ok(d);
    assert.equal(toDatetimeLocalValue(d!), "2026-08-20T15:00");
    assert.equal(dayKeyInBusinessTz(d!), "2026-08-20");
    assert.equal(timeHmInBusinessTz(d!), "15:00");
  });

  it("keeps winter PST offset", () => {
    const d = parseLocalDateTime("2026-01-15T09:00");
    assert.ok(d);
    // 9:00 AM PST = 17:00 UTC
    assert.equal(d!.toISOString(), "2026-01-15T17:00:00.000Z");
  });
});
