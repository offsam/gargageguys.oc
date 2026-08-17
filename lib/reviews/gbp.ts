import { getGoogleAccessToken } from "@/lib/google-auth";

const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";

/** Dedicated GBP OAuth client, or the Ads web client already on Vercel. */
function gbpOAuthClient() {
  const clientId =
    process.env.GOOGLE_GBP_CLIENT_ID?.trim() || process.env.GOOGLE_ADS_CLIENT_ID?.trim() || "";
  const clientSecret =
    process.env.GOOGLE_GBP_CLIENT_SECRET?.trim() || process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() || "";
  return { clientId, clientSecret };
}

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

function gbpIds() {
  const accountId = (process.env.GOOGLE_GBP_ACCOUNT_ID?.trim() || "").replace(/^accounts\//, "");
  const locationId = (process.env.GOOGLE_GBP_LOCATION_ID?.trim() || "").replace(/^locations\//, "");
  return { accountId, locationId };
}

async function getGbpAccessToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_GBP_REFRESH_TOKEN?.trim();
  const { clientId, clientSecret } = gbpOAuthClient();

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
  const { accountId, locationId } = gbpIds();
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
  const { clientId } = gbpOAuthClient();
  if (!clientId) {
    throw new Error("GOOGLE_GBP_CLIENT_ID is not configured (or GOOGLE_ADS_CLIENT_ID as fallback)");
  }
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
  const { clientId, clientSecret } = gbpOAuthClient();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_GBP_CLIENT_ID / SECRET missing (or GOOGLE_ADS_CLIENT_ID / SECRET)");
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

export type GbpListedLocation = {
  accountId: string;
  locationId: string;
  accountName: string;
  title: string;
  address: string;
};

function stripResource(value: string, prefix: string) {
  const trimmed = value.trim();
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
}

function formatGbpAddress(address?: {
  addressLines?: string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
}) {
  if (!address) return "";
  return [
    ...(address.addressLines || []),
    [address.locality, address.administrativeArea, address.postalCode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ");
}

async function gbpJson<T>(url: string, accessToken: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** After OAuth: list Business Profile accounts/locations so the owner can copy env IDs. */
export async function listGbpAccountsAndLocations(accessToken: string): Promise<{
  locations: GbpListedLocation[];
  error?: string;
}> {
  const accountsV1 = await gbpJson<{ accounts?: Array<{ name?: string; accountName?: string }> }>(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    accessToken,
  );
  const accountsV4 = accountsV1
    ? null
    : await gbpJson<{ accounts?: Array<{ name?: string; accountName?: string }> }>(
        "https://mybusiness.googleapis.com/v4/accounts",
        accessToken,
      );
  const accounts = accountsV1?.accounts || accountsV4?.accounts || [];
  if (!accounts.length) {
    return {
      locations: [],
      error:
        "No Business Profile accounts returned. Enable My Business Account Management API and Google Business Profile API, then retry Allow.",
    };
  }

  const locations: GbpListedLocation[] = [];
  const errors: string[] = [];

  for (const account of accounts) {
    const accountName = account.name || "";
    const accountId = stripResource(accountName, "accounts/");
    if (!accountId) continue;

    const v1 = await gbpJson<{
      locations?: Array<{
        name?: string;
        title?: string;
        locationName?: string;
        storefrontAddress?: {
          addressLines?: string[];
          locality?: string;
          administrativeArea?: string;
          postalCode?: string;
        };
        address?: {
          addressLines?: string[];
          locality?: string;
          administrativeArea?: string;
          postalCode?: string;
        };
      }>;
    }>(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?readMask=name,title,storefrontAddress&pageSize=100`,
      accessToken,
    );
    const v4 = v1
      ? null
      : await gbpJson<{
          locations?: Array<{
            name?: string;
            title?: string;
            locationName?: string;
            storefrontAddress?: {
              addressLines?: string[];
              locality?: string;
              administrativeArea?: string;
              postalCode?: string;
            };
            address?: {
              addressLines?: string[];
              locality?: string;
              administrativeArea?: string;
              postalCode?: string;
            };
          }>;
        }>(`https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations`, accessToken);

    const rows = v1?.locations || v4?.locations || [];
    if (!rows.length && !v1 && !v4) {
      errors.push(`Could not list locations for account ${accountId}`);
      continue;
    }

    for (const loc of rows) {
      const rawName = loc.name || "";
      const locationId = stripResource(rawName.split("/locations/").pop() || rawName, "locations/");
      if (!locationId) continue;
      locations.push({
        accountId,
        locationId,
        accountName: account.accountName || accountName,
        title: loc.title || loc.locationName || "Untitled location",
        address: formatGbpAddress(loc.storefrontAddress || loc.address),
      });
    }
  }

  if (!locations.length) {
    return {
      locations: [],
      error: errors[0] || "Accounts found, but no locations. Confirm this Google login owns the Garage Guys profile.",
    };
  }

  return { locations, error: errors[0] };
}

/** Keep in sync with BUSINESS_HOURS / BUSINESS_SERVICES in scripts/seo-business.mjs */
const GBP_WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const GBP_SERVICE_NAMES = [
  "Garage Door Repair",
  "Garage Door Spring Repair",
  "Garage Door Opener Repair",
  "Garage Door Installation",
  "Emergency Garage Door Repair",
  "Same-Day Garage Door Repair",
];

export type GbpProfilePushResult = {
  skipped?: boolean;
  reason?: string;
  hoursUpdated?: boolean;
  servicesUpdated?: boolean;
  error?: string;
};

type GbpCategory = {
  name?: string;
  displayName?: string;
  serviceTypes?: Array<{ serviceTypeId?: string; displayName?: string }>;
};

function gbpRegularHours() {
  return {
    periods: GBP_WEEKDAYS.map((day) => ({
      openDay: day,
      openTime: { hours: 7, minutes: 0 },
      closeDay: day,
      closeTime: { hours: 20, minutes: 0 },
    })),
  };
}

function gbpServiceItems(primary?: GbpCategory) {
  const types = primary?.serviceTypes || [];
  const categoryId = primary?.name || "";
  return GBP_SERVICE_NAMES.map((displayName) => {
    const match = types.find(
      (type) => type.displayName?.toLowerCase() === displayName.toLowerCase(),
    );
    if (match?.serviceTypeId) {
      return { structuredServiceItem: { serviceTypeId: match.serviceTypeId } };
    }
    return {
      freeFormServiceItem: {
        ...(categoryId ? { category: categoryId } : {}),
        label: { displayName, languageCode: "en" },
      },
    };
  });
}

async function patchGbpLocation(
  token: string,
  locationId: string,
  body: Record<string, unknown>,
  updateMask: string,
) {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?updateMask=${encodeURIComponent(updateMask)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GBP location PATCH ${updateMask} HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
}

/**
 * Push site hours (7:00–20:00, 7 days) and service list to Google Business Profile.
 * No-ops without owner OAuth. Fail-open: caller should not abort reviews on error.
 */
export async function pushGbpHoursAndServices(): Promise<GbpProfilePushResult> {
  const refreshToken = process.env.GOOGLE_GBP_REFRESH_TOKEN?.trim();
  const { locationId } = gbpIds();
  if (!refreshToken || !locationId) {
    return {
      skipped: true,
      reason: "missing GOOGLE_GBP_REFRESH_TOKEN or GOOGLE_GBP_LOCATION_ID",
    };
  }

  try {
    const token = await getGbpAccessToken();
    const readUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?readMask=${encodeURIComponent("name,regularHours,serviceItems,categories")}`;
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let primary: GbpCategory | undefined;
    if (readRes.ok) {
      const loc = (await readRes.json()) as {
        categories?: { primaryCategory?: GbpCategory };
      };
      primary = loc.categories?.primaryCategory;
    }

    await patchGbpLocation(token, locationId, { regularHours: gbpRegularHours() }, "regularHours");

    let servicesUpdated = false;
    try {
      await patchGbpLocation(
        token,
        locationId,
        { serviceItems: gbpServiceItems(primary) },
        "serviceItems",
      );
      servicesUpdated = true;
    } catch (serviceError) {
      return {
        hoursUpdated: true,
        servicesUpdated: false,
        error: serviceError instanceof Error ? serviceError.message : String(serviceError),
      };
    }

    return { hoursUpdated: true, servicesUpdated };
  } catch (error) {
    return {
      hoursUpdated: false,
      servicesUpdated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
