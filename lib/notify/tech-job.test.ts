import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTechJobTelegramMessage } from "@/lib/notify/tech-job";

describe("buildTechJobTelegramMessage", () => {
  it("includes client and when", () => {
    const text = buildTechJobTelegramMessage({
      technicianId: "t1",
      clientName: "Alice <Test>",
      date: "2026-08-20",
      timeLabel: "10–12",
      address: "1 Main St",
      zip: "92618",
      phone: "9495551212",
    });
    assert.match(text, /New job assigned/);
    assert.match(text, /Alice &lt;Test&gt;/);
    assert.match(text, /2026-08-20 · 10–12/);
    assert.match(text, /1 Main St, 92618/);
  });
});
