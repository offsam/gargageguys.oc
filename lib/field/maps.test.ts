import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatJobAddress,
  mapsAppUrl,
  googleMapsFallbackUrl,
  FIELD_BASEMAP_URL,
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

  it("uses key-free Esri light tiles (no OSM flag tiles, no Carto watermark)", () => {
    assert.match(FIELD_BASEMAP_URL, /arcgisonline\.com/);
    assert.doesNotMatch(FIELD_BASEMAP_URL, /tile\.openstreetmap\.org/);
    assert.doesNotMatch(FIELD_BASEMAP_URL, /cartocdn\.com/);
  });
});
