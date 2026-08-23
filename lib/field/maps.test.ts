import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatJobAddress,
  mapsAppUrl,
  googleMapsFallbackUrl,
  CARTO_POSITRON_URL,
} from "./maps";

describe("field maps helpers", () => {
  it("builds Apple Maps deep link from address", () => {
    const href = mapsAppUrl("123 Main St, Irvine, CA 92618");
    assert.match(href, /^https:\/\/maps\.apple\.com\/\?q=/);
    assert.ok(href.includes("123%20Main"));
  });

  it("returns empty maps url for blank address", () => {
    assert.equal(mapsAppUrl("  "), "");
    assert.equal(googleMapsFallbackUrl(""), "");
  });

  it("formats address + zip", () => {
    assert.equal(formatJobAddress("1 Oak Ave", "92660"), "1 Oak Ave, 92660");
    assert.equal(formatJobAddress(null, "92660"), "92660");
    assert.equal(formatJobAddress("1 Oak Ave", null), "1 Oak Ave");
  });

  it("uses Carto Positron tiles (no OSM flag tiles)", () => {
    assert.match(CARTO_POSITRON_URL, /basemaps\.cartocdn\.com/);
    assert.doesNotMatch(CARTO_POSITRON_URL, /tile\.openstreetmap\.org/);
  });
});
