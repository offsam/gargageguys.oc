import { NextResponse } from "next/server";
import {
  syncThumbtackReviewCount,
  THUMBTACK_FALLBACK_COUNT,
} from "@/lib/reviews/thumbtack";

/** In-memory cache — short so site badges catch new Thumbtack reviews. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type Cache = { count: number; fetchedAt: number };
let cache: Cache | null = null;

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      { reviewCount: cache.count, source: "cache" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
        },
      },
    );
  }

  const synced = await syncThumbtackReviewCount();
  if (synced.ok) {
    cache = { count: synced.count, fetchedAt: Date.now() };
    return NextResponse.json(
      { reviewCount: synced.count, source: "thumbtack" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
        },
      },
    );
  }

  const count = cache?.count ?? THUMBTACK_FALLBACK_COUNT;
  return NextResponse.json(
    { reviewCount: count, source: "fallback" },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
