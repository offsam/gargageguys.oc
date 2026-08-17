import { getGoogleAccessToken } from "./google-auth";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

export type SeoPeriod = { startDate: string; endDate: string };

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getDefaultPeriod(days = 28): SeoPeriod {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

type GscRowRaw = {
  keys?: unknown[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

function mapGscRow(row: GscRowRaw) {
  return {
    key: Array.isArray(row.keys) ? String(row.keys[0] || "") : "",
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0),
  };
}

function aggregateTotals(rows: ReturnType<typeof mapGscRow>[]) {
  if (!rows.length) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position =
    impressions > 0
      ? rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions
      : 0;
  return { clicks, impressions, ctr, position };
}

async function querySearchConsole(
  siteUrl: string,
  body: Record<string, unknown>,
  accessToken: string,
) {
  const encodedSite = encodeURIComponent(siteUrl);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`Search Console query failed: ${await res.text()}`);
  }

  return res.json() as Promise<{ rows?: GscRowRaw[] }>;
}

export async function fetchSearchConsoleMetrics(siteUrl: string, period: SeoPeriod) {
  const accessToken = await getGoogleAccessToken([GSC_SCOPE]);
  const baseBody = {
    startDate: period.startDate,
    endDate: period.endDate,
    rowLimit: 25,
  };

  const [totalsRaw, queriesRaw, pagesRaw] = await Promise.all([
    querySearchConsole(siteUrl, baseBody, accessToken),
    querySearchConsole(siteUrl, { ...baseBody, dimensions: ["query"], rowLimit: 100 }, accessToken),
    querySearchConsole(siteUrl, { ...baseBody, dimensions: ["page"] }, accessToken),
  ]);

  const topQueries = (queriesRaw.rows || []).map(mapGscRow);
  const topPages = (pagesRaw.rows || []).map(mapGscRow);
  const totalsRows = (totalsRaw.rows || []).map(mapGscRow);
  const totals = totalsRows.length ? totalsRows[0] : aggregateTotals(topQueries);

  return {
    siteUrl,
    totals,
    topQueries,
    topPages,
  };
}

export async function fetchGa4Metrics(propertyId: string, period: SeoPeriod) {
  const accessToken = await getGoogleAccessToken([GA4_SCOPE]);
  const numericPropertyId = String(propertyId).replace(/^properties\//, "");

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${numericPropertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: period.startDate, endDate: period.endDate }],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "totalUsers" },
        ],
        dimensions: [{ name: "pagePath" }],
        limit: 25,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`GA4 runReport failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    metricHeaders?: Array<{ name: string }>;
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>;
  };
  const metricHeaders = (data.metricHeaders || []).map((header) => header.name);
  const topPages = (data.rows || []).map((row) => {
    const values = row.metricValues || [];
    const metrics = Object.fromEntries(
      metricHeaders.map((name, index) => [name, Number(values[index]?.value || 0)]),
    );
    return {
      path: row.dimensionValues?.[0]?.value || "",
      sessions: metrics.sessions || 0,
      screenPageViews: metrics.screenPageViews || 0,
    };
  });

  const totalsRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${numericPropertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: period.startDate, endDate: period.endDate }],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "totalUsers" },
        ],
      }),
    },
  );

  if (!totalsRes.ok) {
    throw new Error(`GA4 totals runReport failed: ${await totalsRes.text()}`);
  }

  const totalsData = (await totalsRes.json()) as {
    rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
  };
  const totalsValues = totalsData.rows?.[0]?.metricValues || [];
  const totals = {
    sessions: Number(totalsValues[0]?.value || 0),
    screenPageViews: Number(totalsValues[1]?.value || 0),
    users: Number(totalsValues[2]?.value || 0),
  };

  return {
    propertyId: numericPropertyId,
    totals,
    topPages,
  };
}
