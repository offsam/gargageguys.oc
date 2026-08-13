import { NextResponse } from "next/server";

const THUMBTACK_URL =
  "https://www.thumbtack.com/ca/tustin/garage-door-repair/garage-guys/service/533172338874097690";

/** Fallback when Thumbtack is unreachable — keep in sync with scripts/seo-business.mjs */
const FALLBACK_COUNT = 74;
/** Refresh every ~3.5 days — review count rarely changes day-to-day */
const CACHE_TTL_MS = 3.5 * 24 * 60 * 60 * 1000;

type Cache = { count: number; fetchedAt: number };
let cache: Cache | null = null;

function parseReviewCount(html: string): number | null {
  const short = html.match(/"shortNumReviewsText"\s*:\s*"\((\d+)\)"/);
  if (short) return Number(short[1]);

  const visible = html.match(/>(\d+)\s+reviews</i);
  if (visible) return Number(visible[1]);

  const schema = html.match(/"reviewCount"\s*:\s*(\d+)/);
  if (schema) return Number(schema[1]);

  return null;
}

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      { reviewCount: cache.count, source: "cache" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=259200",
        },
      },
    );
  }

  try {
    const res = await fetch(THUMBTACK_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GarageGuysOC/1.0; +https://garageguysoc.com/)",
        Accept: "text/html",
      },
      next: { revalidate: 302400 }, // ~3.5 days
    });

    if (!res.ok) throw new Error(`Thumbtack HTTP ${res.status}`);

    const html = await res.text();
    const count = parseReviewCount(html);
    if (!count || count < 1 || count > 10000) throw new Error("Could not parse review count");

    cache = { count, fetchedAt: Date.now() };
    return NextResponse.json(
      { reviewCount: count, source: "thumbtack" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=259200",
        },
      },
    );
  } catch {
    const count = cache?.count ?? FALLBACK_COUNT;
    return NextResponse.json(
      { reviewCount: count, source: "fallback" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  }
}
