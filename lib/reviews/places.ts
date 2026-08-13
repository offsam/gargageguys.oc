export type PlacesAggregate = {
  rating: number | null;
  reviewCount: number | null;
  reviews: Array<{
    external_id: string;
    author_name: string | null;
    rating: number | null;
    text: string | null;
    posted_at: string | null;
    raw: Record<string, unknown>;
  }>;
  raw: Record<string, unknown>;
};

/** Places API (New) — rating, count, up to 5 review texts. */
export async function fetchGooglePlaceReviews(): Promise<PlacesAggregate | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const placeId = process.env.GOOGLE_PLACE_ID?.trim();
  if (!apiKey || !placeId) return null;

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,reviews",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places API HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    reviews?: Array<{
      name?: string;
      rating?: number;
      text?: { text?: string };
      authorAttribution?: { displayName?: string };
      publishTime?: string;
    }>;
  };

  const reviews = (data.reviews || []).map((review, index) => ({
    external_id: review.name || `places-${index}-${review.publishTime || "unknown"}`,
    author_name: review.authorAttribution?.displayName || null,
    rating: typeof review.rating === "number" ? review.rating : null,
    text: review.text?.text || null,
    posted_at: review.publishTime || null,
    raw: review as unknown as Record<string, unknown>,
  }));

  return {
    rating: typeof data.rating === "number" ? data.rating : null,
    reviewCount: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
    reviews,
    raw: data as unknown as Record<string, unknown>,
  };
}
