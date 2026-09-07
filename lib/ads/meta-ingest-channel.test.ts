import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMetaChannelSource } from "../leads/meta-ingest";
import { mapLeadRow } from "./meta";

describe("resolveMetaChannelSource", () => {
  it("maps Instagram from campaign or ad name", () => {
    assert.equal(
      resolveMetaChannelSource({ campaignName: "IG Garage Springs", adName: "" }),
      "Instagram",
    );
    assert.equal(
      resolveMetaChannelSource({ campaignName: "Doors", adName: "Instagram story" }),
      "Instagram",
    );
    assert.equal(
      resolveMetaChannelSource({ campaignName: "FB Lead Form", adName: "Carousel" }),
      "Facebook",
    );
  });
});

describe("mapLeadRow phone fields", () => {
  it("reads alternate phone field names", () => {
    const row = mapLeadRow({
      id: "1",
      created_time: "2026-09-06T12:00:00+0000",
      campaign_name: "IG test",
      field_data: [
        { name: "full_name", values: ["Sam Test"] },
        { name: "mobile_number", values: ["9495550100"] },
      ],
    });
    assert.equal(row.phone, "9495550100");
    assert.equal(row.name, "Sam Test");
  });
});
