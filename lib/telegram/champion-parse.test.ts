import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseChampionClock,
  parseChampionTelegramMessage,
} from "@/lib/telegram/champion-parse";

describe("parseChampionClock", () => {
  it("parses compact 130pm", () => {
    assert.equal(parseChampionClock("130pm or after"), "13:30");
  });

  it("parses 1:30 pm", () => {
    assert.equal(parseChampionClock("1:30 pm"), "13:30");
  });

  it("parses 9am", () => {
    assert.equal(parseChampionClock("9am"), "09:00");
  });

  it("parses 1130am", () => {
    assert.equal(parseChampionClock("1130am"), "11:30");
  });
});

describe("parseChampionTelegramMessage", () => {
  it("parses the Champion sample message", () => {
    const text = [
      "130pm or after",
      "",
      "402 Beryl Cove Way, Seal Beach, CA 90740",
      "",
      "Christina",
      "",
      "** Call before",
    ].join("\n");

    const parsed = parseChampionTelegramMessage(text);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.clientName, "Christina");
    assert.equal(parsed.clientAddress, "402 Beryl Cove Way, Seal Beach, CA 90740");
    assert.equal(parsed.zip, "90740");
    assert.equal(parsed.sheetTime, "13:30");
    assert.equal(parsed.timeRaw, "130pm or after");
    assert.match(parsed.description, /or after/i);
    assert.match(parsed.description, /Call before/i);
  });

  it("parses without blank lines", () => {
    const text = [
      "2:00pm",
      "16352 Rhone Ln, Huntington Beach, CA 92647",
      "John Smith",
      "Gate code 1234",
    ].join("\n");
    const parsed = parseChampionTelegramMessage(text);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.clientName, "John Smith");
    assert.equal(parsed.sheetTime, "14:00");
    assert.equal(parsed.zip, "92647");
    assert.match(parsed.description, /Gate code/);
  });

  it("fails without address", () => {
    const parsed = parseChampionTelegramMessage("130pm\nChristina");
    assert.equal(parsed.ok, false);
  });
});
