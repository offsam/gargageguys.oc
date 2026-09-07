import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zonedWallTimeToUtc } from "@/lib/datetime";
import { nextArrivalWindow, snapToScheduleWindow } from "@/lib/schedule/windows";
import {
  parseChampionClock,
  parseChampionTelegramMessage,
  parseChampionTelegramMessages,
  splitChampionTelegramJobs,
} from "@/lib/telegram/champion-parse";

describe("parseChampionClock", () => {
  it("parses compact 130pm → 2–4 window", () => {
    assert.equal(parseChampionClock("130pm or after"), "14:00");
  });

  it("parses Around 9am → 9–11 window", () => {
    assert.equal(parseChampionClock("Around 9am"), "09:00");
  });

  it("parses bare 9 → 9–11", () => {
    assert.equal(parseChampionClock("9"), "09:00");
  });

  it("parses 1:30pm → 2–4", () => {
    assert.equal(parseChampionClock("1:30pm"), "14:00");
  });

  it("parses 8-9am → 8–10 window", () => {
    assert.equal(parseChampionClock("8-9am"), "08:00");
  });

  it("ignores dollar amounts", () => {
    assert.equal(parseChampionClock("$600-$1600"), "");
  });
});

describe("nextArrivalWindow", () => {
  it("at noon Pacific picks 1–3", () => {
    const noon = zonedWallTimeToUtc(2026, 9, 7, 12, 0, 0);
    const next = nextArrivalWindow(noon, 60);
    assert.equal(next.window.id, "1-3");
    assert.equal(next.sheetTime, "13:00");
    assert.equal(next.dayKey, "2026-09-07");
  });
});

describe("snapToScheduleWindow", () => {
  it("maps :00–:29 to that hour window and :30+ to the next", () => {
    assert.equal(snapToScheduleWindow(9, 0)?.id, "9-11");
    assert.equal(snapToScheduleWindow(13, 0)?.id, "1-3");
    assert.equal(snapToScheduleWindow(13, 30)?.id, "2-4");
  });
});

describe("parseChampionTelegramMessage samples", () => {
  const noon = zonedWallTimeToUtc(2026, 9, 7, 12, 0, 0);

  it("1 address-first, no time → auto 1–3", () => {
    const text = [
      "2892 Copa De Oro Dr, Los Alamitos, CA 90720",
      "",
      "Sasha",
      "",
      "Door squeeks after service",
      "",
      "** Call before",
    ].join("\n");
    const parsed = parseChampionTelegramMessage(text, noon);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.clientName, "Sasha");
    assert.match(parsed.clientAddress, /Copa De Oro/);
    assert.equal(parsed.timeAuto, true);
    assert.equal(parsed.sheetTime, "13:00");
    assert.match(parsed.description, /Door squeeks/i);
  });

  it("2 Mary call before", () => {
    const text = [
      "1108 W 6th St, Santa Ana, CA 92703",
      "",
      "Mary",
      "",
      "** Call before",
    ].join("\n");
    const parsed = parseChampionTelegramMessage(text, noon);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.clientName, "Mary");
    assert.equal(parsed.timeAuto, true);
  });

  it("3 time at end 8-9am", () => {
    const text = [
      "13532 Iowa St, Westminster, CA 92683",
      "",
      "Bob",
      "",
      "Springs. Asked about senior discount",
      "",
      "8-9am",
    ].join("\n");
    const parsed = parseChampionTelegramMessage(text, noon);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.clientName, "Bob");
    assert.equal(parsed.timeAuto, false);
    assert.equal(parsed.sheetTime, "08:00");
    assert.match(parsed.description, /Springs/i);
  });

  it("4 price range stays in notes", () => {
    const text = [
      "4338 Canyon Coral Ln, Yorba Linda, CA 92886",
      "",
      "Edwardo",
      "",
      "Torsion conversion kit",
      "$600-$1600",
    ].join("\n");
    const parsed = parseChampionTelegramMessage(text, noon);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.clientName, "Edwardo");
    assert.equal(parsed.timeAuto, true);
    assert.match(parsed.jobCostHint, /600/);
    assert.match(parsed.description, /Torsion/i);
  });

  it("5 Around 9am first", () => {
    const text = [
      "Around 9am",
      "",
      "703 Iris Ave, Corona Del Mar, CA 92625",
      "",
      "Dorothy",
      "",
      "** Call before",
    ].join("\n");
    const parsed = parseChampionTelegramMessage(text, noon);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.clientName, "Dorothy");
    assert.equal(parsed.sheetTime, "09:00");
    assert.equal(parsed.timeAuto, false);
  });

  it("splits numbered batch", () => {
    const batch = [
      "1. 2892 Copa De Oro Dr, Los Alamitos, CA 90720",
      "",
      "Sasha",
      "",
      "** Call before",
      "",
      "2. 1108 W 6th St, Santa Ana, CA 92703",
      "",
      "Mary",
      "",
      "** Call before",
    ].join("\n");
    assert.equal(splitChampionTelegramJobs(batch).length, 2);
    const parsed = parseChampionTelegramMessages(batch, noon);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]!.ok && parsed[0].clientName, "Sasha");
    assert.equal(parsed[1]!.ok && parsed[1].clientName, "Mary");
  });
});
