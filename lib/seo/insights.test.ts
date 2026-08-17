import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quickWinQueries } from "./insights.ts";

describe("quickWinQueries", () => {
  it("keeps positions 11–20 and sorts by impressions", () => {
    const rows = quickWinQueries([
      { key: "low", clicks: 1, impressions: 10, position: 12 },
      { key: "page1", clicks: 20, impressions: 900, position: 4 },
      { key: "high", clicks: 3, impressions: 400, position: 18.2 },
      { key: "page3", clicks: 0, impressions: 200, position: 25 },
    ]);
    assert.deepEqual(
      rows.map((row) => row.key),
      ["high", "low"],
    );
  });

  it("returns empty when nothing is on page 2", () => {
    assert.equal(quickWinQueries([{ key: "a", clicks: 1, impressions: 50, position: 2 }]).length, 0);
  });
});
