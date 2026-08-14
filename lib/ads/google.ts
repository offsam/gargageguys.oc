import type { AdsPeriod } from "@/lib/ads/meta";

const ADS_API_VERSION = "v19";
const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

export type GoogleAdsCampaignMetrics = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
};

export type GoogleAdsMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
  campaigns: GoogleAdsCampaignMetrics[];
  lsaLeadCount: number;
};

export type GoogleLeadRow = {
  id: string;
  createdTime: string | null;
  source: "google_ads" | "google_lsa";
  campaignId: string | null;
  campaignName: string | null;
  name: string;
  phone: string;
  email: string;
  zip: string;
  address: string;
  message: string;
  fields: Record<string, string>;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function getGoogleAdsConfig() {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim() || "";
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || "";
  const customerId = digitsOnly(process.env.GOOGLE_ADS_CUSTOMER_ID?.trim() || "");
  const loginCustomerId = digitsOnly(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || "");
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() || "";
  const clientId =
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() || process.env.GOOGLE_GBP_CLIENT_ID?.trim() || "";
  const clientSecret =
    process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_GBP_CLIENT_SECRET?.trim() ||
    "";
  const webhookKey = process.env.GOOGLE_ADS_LEAD_WEBHOOK_KEY?.trim() || "";

  const missing: string[] = [];
  if (!apiKey) missing.push("GOOGLE_CLOUD_API_KEY");
  if (!developerToken) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!customerId) missing.push("GOOGLE_ADS_CUSTOMER_ID");
  if (!refreshToken) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
  if (!clientId || !clientSecret) missing.push("GOOGLE_ADS_CLIENT_ID / SECRET (or GBP OAuth client)");

  return {
    apiKey,
    developerToken,
    customerId,
    loginCustomerId,
    refreshToken,
    clientId,
    clientSecret,
    webhookKey,
    missing,
    hasApiKey: Boolean(apiKey),
    canQuery: Boolean(developerToken && customerId && refreshToken && clientId && clientSecret),
  };
}

export function getGoogleAdsOAuthAuthUrl(redirectUri: string, state: string) {
  const cfg = getGoogleAdsConfig();
  if (!cfg.clientId) throw new Error("GOOGLE_ADS_CLIENT_ID or GOOGLE_GBP_CLIENT_ID is required");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: ADS_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAdsOAuthCode(code: string, redirectUri: string) {
  const cfg = getGoogleAdsConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET (or GBP OAuth) missing");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google Ads OAuth exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

async function getAccessToken() {
  const cfg = getGoogleAdsConfig();
  if (!cfg.refreshToken || !cfg.clientId || !cfg.clientSecret) {
    throw new Error("Google Ads OAuth is not connected (GOOGLE_ADS_REFRESH_TOKEN)");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google Ads token refresh failed: ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google Ads token refresh missing access_token");
  return json.access_token;
}

type GaqlRow = Record<string, unknown>;

async function googleAdsSearch(query: string): Promise<GaqlRow[]> {
  const cfg = getGoogleAdsConfig();
  if (!cfg.canQuery) {
    throw new Error(`Google Ads not ready. Missing: ${cfg.missing.join(", ")}`);
  }
  const token = await getAccessToken();
  const url = new URL(
    `https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${cfg.customerId}/googleAds:search`,
  );
  if (cfg.apiKey) url.searchParams.set("key", cfg.apiKey);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": cfg.developerToken,
    "Content-Type": "application/json",
  };
  if (cfg.loginCustomerId) headers["login-customer-id"] = cfg.loginCustomerId;

  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    results?: GaqlRow[];
    error?: { message?: string; status?: string };
    message?: string;
  };
  if (!res.ok) {
    throw new Error(json.error?.message || json.message || `Google Ads API ${res.status}`);
  }
  return json.results || [];
}

function nested(row: GaqlRow, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, row);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchGoogleAdsMetrics(period: AdsPeriod): Promise<GoogleAdsMetrics & { accountId: string; raw: unknown }> {
  const cfg = getGoogleAdsConfig();
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${period.startDate}' AND '${period.endDate}'
      AND campaign.status != 'REMOVED'
  `;
  const rows = await googleAdsSearch(query);

  const byCampaign = new Map<string, GoogleAdsCampaignMetrics>();
  for (const row of rows) {
    const id = String(nested(row, "campaign.id") || "");
    if (!id) continue;
    const spend = num(nested(row, "metrics.costMicros") || nested(row, "metrics.cost_micros")) / 1_000_000;
    const impressions = Math.round(num(nested(row, "metrics.impressions")));
    const clicks = Math.round(num(nested(row, "metrics.clicks")));
    const leads = Math.round(num(nested(row, "metrics.conversions")));
    const prev = byCampaign.get(id) || {
      id,
      name: String(nested(row, "campaign.name") || "Campaign"),
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      cpl: null,
    };
    prev.spend += spend;
    prev.impressions += impressions;
    prev.clicks += clicks;
    prev.leads += leads;
    prev.cpl = prev.leads > 0 ? prev.spend / prev.leads : null;
    byCampaign.set(id, prev);
  }

  const campaigns = [...byCampaign.values()].sort((a, b) => b.spend - a.spend);
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const leads = campaigns.reduce((s, c) => s + c.leads, 0);

  let lsaLeadCount = 0;
  try {
    const lsa = await fetchGoogleLocalServicesLeads(period);
    lsaLeadCount = lsa.length;
  } catch {
    /* LSA optional until account has Local Services */
  }

  return {
    accountId: cfg.customerId,
    spend,
    impressions,
    clicks,
    leads: Math.max(leads, lsaLeadCount),
    cpl: Math.max(leads, lsaLeadCount) > 0 ? spend / Math.max(leads, lsaLeadCount) : null,
    campaigns,
    lsaLeadCount,
    raw: { campaignRows: rows.length, lsaLeadCount },
  };
}

function parseContactBlob(raw: unknown): { name: string; phone: string; email: string; zip: string; address: string } {
  const text = String(raw || "");
  const phone = (text.match(/\+?\d[\d\s().-]{8,}\d/) || [""])[0].trim();
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
  return {
    name: "",
    phone,
    email,
    zip: (text.match(/\b\d{5}(?:-\d{4})?\b/) || [""])[0],
    address: "",
  };
}

export async function fetchGoogleLocalServicesLeads(period: AdsPeriod): Promise<GoogleLeadRow[]> {
  const base = `
    SELECT
      local_services_lead.id,
      local_services_lead.lead_type,
      local_services_lead.lead_status,
      local_services_lead.creation_date_time,
      local_services_lead.contact_details,
      local_services_lead.locale,
      local_services_lead.category_id,
      local_services_lead.service_id,
      local_services_lead.note
    FROM local_services_lead
  `;
  let rows: GaqlRow[] = [];
  try {
    rows = await googleAdsSearch(
      `${base}
    WHERE local_services_lead.creation_date_time >= '${period.startDate}'
      AND local_services_lead.creation_date_time <= '${period.endDate} 23:59:59'`,
    );
  } catch {
    rows = await googleAdsSearch(base);
  }
  const out: GoogleLeadRow[] = [];
  for (const row of rows) {
    const id = String(nested(row, "localServicesLead.id") || nested(row, "local_services_lead.id") || "");
    if (!id) continue;
    const contact = parseContactBlob(
      nested(row, "localServicesLead.contactDetails") || nested(row, "local_services_lead.contact_details"),
    );
    const note = String(nested(row, "localServicesLead.note") || nested(row, "local_services_lead.note") || "");
    out.push({
      id: `lsa:${id}`,
      createdTime: String(
        nested(row, "localServicesLead.creationDateTime") ||
          nested(row, "local_services_lead.creation_date_time") ||
          "",
      ) || null,
      source: "google_lsa",
      campaignId: null,
      campaignName: "Local Services",
      name: contact.name || "Google Local lead",
      phone: contact.phone,
      email: contact.email,
      zip: contact.zip,
      address: contact.address,
      message: note,
      fields: { raw: String(nested(row, "localServicesLead.contactDetails") || "") },
    });
  }
  return out;
}
