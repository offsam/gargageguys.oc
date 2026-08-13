import { getGoogleAccessToken } from "@/lib/google-auth";

const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";

export type GbpReview = {
  external_id: string;
  author_name: string | null;
  rating: number | null;
  text: string | null;
  posted_at: string | null;
  owner_reply: string | null;
  raw: Record<string, unknown>;
};

export type GbpAggregate = {
  rating: number | null;
  reviewCount: number | null;
  reviews: GbpReview[];
  raw: Record<string, unknown>;
};

function starRatingToNumber(value: unknown): number | null {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  if (typeof value === "string" && map[value]) return map[value];
  if (typeof value === "number") return value;
  return null;
}

async function getGbpAccessToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_GBP_REFRESH_TOKEN?.trim();
  const clientId = process.env.GOOGLE_GBP_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_GBP_CLIENT_SECRET?.trim();

  if (refreshToken && clientId && clientSecret) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      throw new Error(`GBP token refresh failed: ${await res.text()}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error("GBP token refresh missing access_token");
    return json.access_token;
  }

  // Fallback: try service account if domain-wide delegation was configured
  return getGoogleAccessToken([GBP_SCOPE]);
}

/** Google Business Profile reviews.list — full texts + owner replies. */
export async function fetchGbpReviews(): Promise<GbpAggregate | null> {
  const accountId = process.env.GOOGLE_GBP_ACCOUNT_ID?.trim();
  const locationId = process.env.GOOGLE_GBP_LOCATION_ID?.trim();
  if (!accountId || !locationId) return null;
  if (
    !process.env.GOOGLE_GBP_REFRESH_TOKEN?.trim() &&
    !process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  ) {
    return null;
  }

  const token = await getGbpAccessToken();
  const parent = `accounts/${accountId}/locations/${locationId}`;
  const url = `https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GBP reviews HTTP ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    averageRating?: number;
    totalReviewCount?: number;
    reviews?: Array<{
      reviewId?: string;
      name?: string;
      starRating?: string;
      comment?: string;
      createTime?: string;
      updateTime?: string;
      reviewer?: { displayName?: string };
      reviewReply?: { comment?: string };
    }>;
  };

  const reviews: GbpReview[] = (data.reviews || []).map((review, index) => ({
    external_id: review.reviewId || review.name || `gbp-${index}`,
    author_name: review.reviewer?.displayName || null,
    rating: starRatingToNumber(review.starRating),
    text: review.comment || null,
    posted_at: review.createTime || review.updateTime || null,
    owner_reply: review.reviewReply?.comment || null,
    raw: review as unknown as Record<string, unknown>,
  }));

  return {
    rating: typeof data.averageRating === "number" ? data.averageRating : null,
    reviewCount:
      typeof data.totalReviewCount === "number" ? data.totalReviewCount : reviews.length,
    reviews,
    raw: data as unknown as Record<string, unknown>,
  };
}

export function getGbpOAuthAuthUrl(redirectUri: string, state: string) {
  const clientId = process.env.GOOGLE_GBP_CLIENT_ID?.trim();
  if (!clientId) throw new Error("GOOGLE_GBP_CLIENT_ID is not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GBP_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGbpOAuthCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_GBP_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_GBP_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_GBP_CLIENT_ID / GOOGLE_GBP_CLIENT_SECRET missing");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`GBP OAuth exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}
