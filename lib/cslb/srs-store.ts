import { CSLB_QUESTIONS } from "./questions";
import { applyAnswer, isDue, todayKey, type SrsCard } from "./srs";

export const CSLB_SRS_STORAGE_KEY = "gg-cslb-srs-v1";

export type CslbSrsStore = {
  lessons: Record<string, boolean>;
  cards: Record<string, SrsCard>;
};

export function emptyCslbStore(): CslbSrsStore {
  return { lessons: {}, cards: {} };
}

export function parseCslbStore(raw: string | null): CslbSrsStore {
  if (!raw) return emptyCslbStore();
  try {
    const parsed = JSON.parse(raw) as Partial<CslbSrsStore>;
    return {
      lessons: parsed.lessons && typeof parsed.lessons === "object" ? parsed.lessons : {},
      cards: parsed.cards && typeof parsed.cards === "object" ? parsed.cards : {},
    };
  } catch {
    return emptyCslbStore();
  }
}

export function loadCslbStore(): CslbSrsStore {
  if (typeof window === "undefined") return emptyCslbStore();
  try {
    return parseCslbStore(window.localStorage.getItem(CSLB_SRS_STORAGE_KEY));
  } catch {
    return emptyCslbStore();
  }
}

export function saveCslbStore(store: CslbSrsStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CSLB_SRS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode */
  }
}

export function markLessonRead(store: CslbSrsStore, topicId: string): CslbSrsStore {
  return {
    ...store,
    lessons: { ...store.lessons, [topicId]: true },
  };
}

export function recordAnswer(
  store: CslbSrsStore,
  questionId: string,
  correct: boolean,
  today: string = todayKey(),
): CslbSrsStore {
  const next = applyAnswer(store.cards[questionId], correct, today);
  return {
    ...store,
    cards: { ...store.cards, [questionId]: next },
  };
}

export function dueQuestionIds(store: CslbSrsStore, today: string = todayKey()): string[] {
  return CSLB_QUESTIONS.filter((q) => isDue(store.cards[q.id], today)).map((q) => q.id);
}

export function answeredCountForTopic(store: CslbSrsStore, topicId: string): number {
  return CSLB_QUESTIONS.filter((q) => q.topicId === topicId && store.cards[q.id]).length;
}
