import { upsertReviewSnapshot } from "@/lib/reviews/store";

export const THUMBTACK_PROFILE_URL =
  "https://www.thumbtack.com/ca/tustin/garage-door-repair/garage-guys/service/533172338874097690";

/** Keep in sync with public site fallback until live scrape succeeds. */
export const THUMBTACK_FALLBACK_COUNT = 79;

export function parseThumbtackReviewCount(html: string): number | null {
  const short = html.match(/"shortNumReviewsText"\s*:\s*"\((\d+)\)"/);
  if (short) return Number(short[1]);

  const visible = html.match(/>(\d+)\s+reviews</i);
  if (visible) return Number(visible[1]);

  const schema = html.match(/"reviewCount"\s*:\s*(\d+)/);
  if (schema) return Number(schema[1]);

  return null;
}

export async function fetchThumbtackReviewCount(): Promise<{
  count: number;
  source: "thumbtack" | "fallback";
  htmlLength?: number;
}> {
  try {
    const res = await fetch(THUMBTACK_PROFILE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GarageGuysOC/1.0; +https://garageguysoc.com/)",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Thumbtack HTTP ${res.status}`);
    const html = await res.text();
    const count = parseThumbtackReviewCount(html);
    if (!count || count < 1 || count > 10000) {
      throw new Error("Could not parse Thumbtack review count");
    }
    return { count, source: "thumbtack", htmlLength: html.length };
  } catch {
    return { count: THUMBTACK_FALLBACK_COUNT, source: "fallback" };
  }
}

/** Scrape Thumbtack public count into review_snapshots for /reviews admin + /api/reviews. */
export async function syncThumbtackReviewCount(): Promise<{
  ok: boolean;
  count: number;
  source: "thumbtack" | "fallback";
  error?: string;
}> {
  const fetched = await fetchThumbtackReviewCount();
  if (fetched.source === "fallback") {
    return {
      ok: false,
      count: fetched.count,
      source: "fallback",
      error: "Thumbtack scrape failed; left snapshot unchanged",
    };
  }
  await upsertReviewSnapshot({
    source: "thumbtack",
    rating: 5,
    review_count: fetched.count,
    raw: { provider: "thumbtack_scrape", url: THUMBTACK_PROFILE_URL },
  });
  return { ok: true, count: fetched.count, source: "thumbtack" };
}
