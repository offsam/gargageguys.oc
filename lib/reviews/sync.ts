import {
  createInboxForNewReviews,
  upsertReviewSnapshot,
  upsertReviews,
  type ReviewRow,
} from "@/lib/reviews/store";
import { fetchGooglePlaceReviews } from "@/lib/reviews/places";
import { fetchGbpReviews, pushGbpHoursAndServices, type GbpProfilePushResult } from "@/lib/reviews/gbp";

export type SyncResult = {
  ok: boolean;
  source: "gbp" | "places" | "none";
  reviewCount: number | null;
  rating: number | null;
  upserted: number;
  inboxCreated: number;
  error?: string;
  profile?: GbpProfilePushResult;
};

export async function syncGoogleReviews(): Promise<SyncResult> {
  const profile = await pushGbpHoursAndServices();
  try {
    const gbp = await fetchGbpReviews();
    if (gbp) {
      const rows: ReviewRow[] = gbp.reviews.map((r) => ({
        source: "google",
        external_id: r.external_id,
        author_name: r.author_name,
        rating: r.rating,
        text: r.text,
        posted_at: r.posted_at,
        owner_reply: r.owner_reply,
        raw: r.raw,
      }));

      const inboxCreated = await createInboxForNewReviews(rows);
      const upserted = (await upsertReviews(rows)).length;
      await upsertReviewSnapshot({
        source: "google",
        rating: gbp.rating,
        review_count: gbp.reviewCount ?? rows.length,
        raw: { provider: "gbp", ...gbp.raw },
      });

      return {
        ok: true,
        source: "gbp",
        reviewCount: gbp.reviewCount,
        rating: gbp.rating,
        upserted,
        inboxCreated,
        profile,
      };
    }

    const places = await fetchGooglePlaceReviews();
    if (places) {
      const rows: ReviewRow[] = places.reviews.map((r) => ({
        source: "google",
        external_id: r.external_id,
        author_name: r.author_name,
        rating: r.rating,
        text: r.text,
        posted_at: r.posted_at,
        owner_reply: null,
        raw: r.raw,
      }));

      const inboxCreated = await createInboxForNewReviews(rows);
      const upserted = (await upsertReviews(rows)).length;
      await upsertReviewSnapshot({
        source: "google",
        rating: places.rating,
        review_count: places.reviewCount ?? rows.length,
        raw: { provider: "places", ...places.raw },
      });

      return {
        ok: true,
        source: "places",
        reviewCount: places.reviewCount,
        rating: places.rating,
        upserted,
        inboxCreated,
        profile,
      };
    }

    return {
      ok: false,
      source: "none",
      reviewCount: null,
      rating: null,
      upserted: 0,
      inboxCreated: 0,
      error:
        "No Google credentials configured (set GOOGLE_GBP_* for full sync or GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID)",
      profile,
    };
  } catch (error) {
    return {
      ok: false,
      source: "none",
      reviewCount: null,
      rating: null,
      upserted: 0,
      inboxCreated: 0,
      error: error instanceof Error ? error.message : String(error),
      profile,
    };
  }
}
