import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CSLB_QUESTIONS } from "./questions";
import { CSLB_TOPICS } from "./topics";
import { addDays, applyAnswer, isDue, todayKey } from "./srs";
import { dueQuestionIds, emptyCslbStore, parseCslbStore, recordAnswer } from "./srs-store";

describe("CSLB question bank", () => {
  it("has 7 topics and 4 questions each", () => {
    assert.equal(CSLB_TOPICS.length, 7);
    assert.equal(CSLB_QUESTIONS.length, 28);
    for (const topic of CSLB_TOPICS) {
      const n = CSLB_QUESTIONS.filter((q) => q.topicId === topic.id).length;
      assert.equal(n, 4, topic.id);
    }
  });

  it("keeps unique ids and four options", () => {
    const ids = CSLB_QUESTIONS.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const q of CSLB_QUESTIONS) {
      assert.equal(q.options.length, 4);
      assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3);
      assert.ok(q.textEn.length > 20);
      assert.ok(q.textRu.length > 10);
    }
  });
});

describe("CSLB Leitner", () => {
  it("formats today as YYYY-MM-DD", () => {
    assert.match(todayKey(new Date("2026-09-21T16:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
  });

  it("adds calendar days on the date key", () => {
    assert.equal(addDays("2026-09-21", 1), "2026-09-22");
    assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  });

  it("sends a miss to tomorrow and resets the streak", () => {
    const next = applyAnswer({ streak: 2, box: 2, due: "2026-09-21" }, false, "2026-09-21");
    assert.deepEqual(next, { streak: 0, box: 1, due: "2026-09-22" });
  });

  it("schedules 1 / 3 / 7 days on consecutive hits", () => {
    const first = applyAnswer(undefined, true, "2026-09-21");
    assert.deepEqual(first, { streak: 1, box: 1, due: "2026-09-22" });
    const second = applyAnswer(first, true, "2026-09-22");
    assert.deepEqual(second, { streak: 2, box: 2, due: "2026-09-25" });
    const third = applyAnswer(second, true, "2026-09-25");
    assert.deepEqual(third, { streak: 3, box: 3, due: "2026-10-02" });
  });

  it("treats only due cards as review", () => {
    assert.equal(isDue(undefined, "2026-09-21"), false);
    assert.equal(isDue({ streak: 0, box: 1, due: "2026-09-21" }, "2026-09-21"), true);
    assert.equal(isDue({ streak: 2, box: 2, due: "2026-09-25" }, "2026-09-21"), false);
  });

  it("lists due ids from a stored snapshot", () => {
    let store = emptyCslbStore();
    store = recordAnswer(store, "q-lic-01", false, "2026-09-20");
    store = recordAnswer(store, "q-lic-02", true, "2026-09-19");
    store = recordAnswer(store, "q-lic-02", true, "2026-09-20");
    const due = dueQuestionIds(store, "2026-09-21");
    assert.ok(due.includes("q-lic-01"));
    assert.equal(due.includes("q-lic-02"), false);
  });

  it("recovers from bad localStorage JSON", () => {
    const store = parseCslbStore("{not json");
    assert.deepEqual(store, emptyCslbStore());
  });
});
