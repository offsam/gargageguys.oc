import { BUSINESS_TZ } from "@/lib/datetime";

export type SrsBox = 1 | 2 | 3;

export type SrsCard = {
  streak: number;
  box: SrsBox;
  due: string;
};

/** Pacific calendar day as YYYY-MM-DD. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(due: string, days: number): string {
  const [year, month, day] = due.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function isDue(card: SrsCard | undefined, today: string): boolean {
  if (!card) return false;
  return card.due <= today;
}

/**
 * Wrong → box 1, due tomorrow.
 * First correct → still box 1, due tomorrow.
 * Two correct in a row → box 2, due in 3 days.
 * Another correct → box 3, due in 7 days.
 */
export function applyAnswer(
  card: SrsCard | undefined,
  correct: boolean,
  today: string,
): SrsCard {
  if (!correct) {
    return { streak: 0, box: 1, due: addDays(today, 1) };
  }
  const streak = (card?.streak ?? 0) + 1;
  if (streak >= 3) return { streak, box: 3, due: addDays(today, 7) };
  if (streak >= 2) return { streak, box: 2, due: addDays(today, 3) };
  return { streak, box: 1, due: addDays(today, 1) };
}
