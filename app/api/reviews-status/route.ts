import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { listReviewSnapshots, listReviews } from "@/lib/reviews/store";

/** Read-only: last Google/Thumbtack review sync timestamps. */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const [snapshots, reviews] = await Promise.all([
      listReviewSnapshots(),
      listReviews("google", 5),
    ]);
    const googleSnap = snapshots.find((s) => s.source === "google") || null;
    const latestReviewSync = reviews
      .map((r) => r.synced_at)
      .filter(Boolean)
      .sort()
      .at(-1);

    return NextResponse.json({
      ok: true,
      google: googleSnap
        ? {
            rating: googleSnap.rating,
            reviewCount: googleSnap.review_count,
            syncedAt: googleSnap.synced_at,
            provider:
              googleSnap.raw && typeof googleSnap.raw === "object"
                ? (googleSnap.raw as { provider?: string }).provider || null
                : null,
          }
        : null,
      thumbtack: (() => {
        const t = snapshots.find((s) => s.source === "thumbtack");
        return t
          ? { rating: t.rating, reviewCount: t.review_count, syncedAt: t.synced_at }
          : null;
      })(),
      latestGoogleReviewSyncedAt: latestReviewSync || null,
      recentGoogleAuthors: reviews.map((r) => ({
        author: r.author_name,
        syncedAt: r.synced_at,
        postedAt: r.posted_at,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
