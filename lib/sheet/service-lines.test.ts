import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatServiceLines,
  mergeServiceLines,
  parseServiceLines,
} from "./service-lines";

describe("service-lines", () => {
  it("formats multiple services with quantities", () => {
    assert.equal(
      formatServiceLines([
        { name: "Cable replacement", qty: 2 },
        { name: "Tune-up / lubrication", qty: 1 },
      ]),
      "Cable replacement ×2; Tune-up / lubrication",
    );
  });

  it("parses display string", () => {
    assert.deepEqual(
      parseServiceLines(undefined, "Cable replacement ×2; Tune-up / lubrication"),
      [
        { name: "Cable replacement", qty: 2 },
        { name: "Tune-up / lubrication", qty: 1 },
      ],
    );
  });

  it("parses metadata array", () => {
    assert.deepEqual(
      parseServiceLines([
        { name: "Opener repair / gear kit", qty: 1 },
        { name: "Safety sensor alignment / replace", qty: 2 },
      ]),
      [
        { name: "Opener repair / gear kit", qty: 1 },
        { name: "Safety sensor alignment / replace", qty: 2 },
      ],
    );
  });

  it("merges duplicate service names", () => {
    assert.deepEqual(
      mergeServiceLines([
        { name: "Cable replacement", qty: 1 },
        { name: "Cable replacement", qty: 2 },
      ]),
      [{ name: "Cable replacement", qty: 3 }],
    );
  });
});
