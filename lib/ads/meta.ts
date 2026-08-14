export type AdsPeriod = { startDate: string; endDate: string };

export type MetaCampaignMetrics = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
  leadActions?: Record<string, number>;
};

export type MetaAdsMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  cpl: number | null;
  campaigns: MetaCampaignMetrics[];
};

export type MetaLeadRow = {
  id: string;
  createdTime: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adId: string | null;
  adName: string | null;
  formId: string | null;
  name: string;
  phone: string;
  email: string;
  zip: string;
  address: string;
  message: string;
  fields: Record<string, string>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Meta often returns overlapping lead action types. Summing them double-counts.
 * Prefer a single primary metric in priority order.
 */
function leadCountFromActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  const byType = new Map<string, number>();
  for (const row of actions) {
    if (!row || typeof row !== "object") continue;
    const type = String((row as { action_type?: string }).action_type || "");
    const value = num((row as { value?: string | number }).value);
    if (!type) continue;
    byType.set(type, (byType.get(type) || 0) + value);
  }

  // Prefer Instant Form `lead` over broader grouped conversions (often inflate vs form rows).
  const preferred = [
    "lead",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
    "onsite_web_lead",
  ];
  for (const key of preferred) {
    if (byType.has(key)) return Math.round(byType.get(key) || 0);
  }
  return 0;
}

/** Keep raw action map for UI transparency (insights vs forms). */
export function leadActionsBreakdown(actions: unknown): Record<string, number> {
  if (!Array.isArray(actions)) return {};
  const byType: Record<string, number> = {};
  for (const row of actions) {
    if (!row || typeof row !== "object") continue;
    const type = String((row as { action_type?: string }).action_type || "");
    const value = num((row as { value?: string | number }).value);
    if (!type || !value) continue;
    if (!/lead|complete_registration|submit/i.test(type)) continue;
    byType[type] = (byType[type] || 0) + value;
  }
  return byType;
}

function normalizeAccountId(raw: string): string {
  const id = raw.trim();
  if (!id) return "";
  return id.startsWith("act_") ? id : `act_${id}`;
}

export function getMetaAdsConfig() {
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim() || "";
  const accountId = normalizeAccountId(process.env.META_AD_ACCOUNT_ID?.trim() || "");
  const pageId = process.env.META_PAGE_ID?.trim() || "";
  return { token, accountId, pageId, ok: Boolean(token && accountId) };
}

/** Lead reads usually need a Page access token, not only the system-user token. */
async function resolveLeadAccessToken(userToken: string, preferredPageId?: string) {
  const pageId = (preferredPageId || process.env.META_PAGE_ID || "").trim();

  if (pageId) {
    try {
      const page = (await graphGet(pageId, userToken, { fields: "id,name,access_token" })) as {
        id?: string;
        name?: string;
        access_token?: string;
      };
      if (page.access_token) {
        return { token: page.access_token, pageId: String(page.id || pageId), pageName: page.name || "" };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot get Page access token for META_PAGE_ID=${pageId}. ` +
          `In Business settings → System users → Assign assets, add this Facebook Page ` +
          `(Ads + leads access). Details: ${msg}`,
      );
    }
  }

  // Discover pages the token can manage
  try {
    const pages = await graphGetAll("me/accounts", userToken, {
      fields: "id,name,access_token",
      limit: "50",
    });
    for (const row of pages) {
      const p = row as { id?: string; name?: string; access_token?: string };
      if (p.access_token && p.id) {
        return {
          token: p.access_token,
          pageId: String(p.id),
          pageName: String(p.name || ""),
        };
      }
    }
  } catch {
    /* fall through */
  }

  throw new Error(
    "Lead details need a Page token. Add META_PAGE_ID in Vercel, and in Business Manager " +
      "assign that Facebook Page to your System User (with ads/leads access), then redeploy.",
  );
}

export function getDefaultAdsPeriod(days = 28): AdsPeriod {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as {
    data?: unknown[];
    paging?: { next?: string; cursors?: { after?: string } };
    error?: { message?: string; code?: number; type?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta Graph error ${res.status}`);
  }
  return json;
}

async function graphGetAll(
  path: string,
  token: string,
  params: Record<string, string>,
  maxPages = 8,
) {
  const rows: unknown[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await graphGet(path, token, {
      ...params,
      ...(after ? { after } : {}),
    });
    rows.push(...(res.data || []));
    after = res.paging?.cursors?.after;
    if (!after || !res.paging?.next) break;
  }
  return rows;
}

function fieldMap(fieldData: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(fieldData)) return out;
  for (const row of fieldData) {
    if (!row || typeof row !== "object") continue;
    const name = String((row as { name?: string }).name || "").trim();
    const values = (row as { values?: string[] }).values || [];
    const value = values.map(String).find((v) => v.trim())?.trim() || "";
    if (name && value) out[name] = value;
  }
  return out;
}

function pickField(fields: Record<string, string>, names: string[]) {
  const lower = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, "_"), v]),
  );
  for (const name of names) {
    const key = name.toLowerCase().replace(/\s+/g, "_");
    if (lower[key]) return lower[key];
  }
  // fuzzy contains
  for (const [k, v] of Object.entries(lower)) {
    if (names.some((n) => k.includes(n.toLowerCase().replace(/\s+/g, "_")))) return v;
  }
  return "";
}

function mapLeadRow(raw: Record<string, unknown>): MetaLeadRow {
  const fields = fieldMap(raw.field_data);
  const first = pickField(fields, ["first_name", "firstname"]);
  const last = pickField(fields, ["last_name", "lastname"]);
  const full =
    pickField(fields, ["full_name", "full name", "name"]) ||
    [first, last].filter(Boolean).join(" ").trim();
  return {
    id: String(raw.id || ""),
    createdTime: raw.created_time ? String(raw.created_time) : null,
    campaignId: raw.campaign_id ? String(raw.campaign_id) : null,
    campaignName: raw.campaign_name ? String(raw.campaign_name) : null,
    adId: raw.ad_id ? String(raw.ad_id) : null,
    adName: raw.ad_name ? String(raw.ad_name) : null,
    formId: raw.form_id ? String(raw.form_id) : null,
    name: full || "Meta lead",
    phone: pickField(fields, ["phone_number", "phone", "mobile_number", "mobile"]),
    email: pickField(fields, ["email", "email_address"]),
    zip: pickField(fields, ["zip_code", "zip", "postal_code", "post_code"]),
    address: pickField(fields, ["street_address", "address", "city"]),
    message: pickField(fields, ["message", "notes", "description", "what_do_you_need", "problem"]),
    fields,
  };
}

export async function fetchMetaAdsMetrics(
  period: AdsPeriod,
  opts?: { token?: string; accountId?: string },
): Promise<MetaAdsMetrics & { accountId: string; raw: unknown }> {
  const cfg = getMetaAdsConfig();
  const token = opts?.token || cfg.token;
  const accountId = normalizeAccountId(opts?.accountId || cfg.accountId);
  if (!token || !accountId) {
    throw new Error("META_ADS_ACCESS_TOKEN and META_AD_ACCOUNT_ID are required");
  }

  const timeRange = JSON.stringify({ since: period.startDate, until: period.endDate });
  const fields = "spend,impressions,clicks,reach,actions";

  const [accountRes, campaignRows] = await Promise.all([
    graphGet(`${accountId}/insights`, token, {
      fields,
      level: "account",
      time_range: timeRange,
    }),
    graphGetAll(`${accountId}/insights`, token, {
      fields: `campaign_id,campaign_name,${fields}`,
      level: "campaign",
      time_range: timeRange,
      limit: "50",
    }),
  ]);

  const accountRow = (accountRes.data?.[0] || {}) as Record<string, unknown>;
  const spend = num(accountRow.spend);
  const impressions = Math.round(num(accountRow.impressions));
  const clicks = Math.round(num(accountRow.clicks));
  const reach = Math.round(num(accountRow.reach));
  const leads = Math.round(leadCountFromActions(accountRow.actions));
  const cpl = leads > 0 ? spend / leads : null;

  const campaigns = campaignRows
    .map((row) => {
      const r = row as Record<string, unknown>;
      const cSpend = num(r.spend);
      const cLeads = Math.round(leadCountFromActions(r.actions));
      return {
        id: String(r.campaign_id || ""),
        name: String(r.campaign_name || "Campaign"),
        spend: cSpend,
        impressions: Math.round(num(r.impressions)),
        clicks: Math.round(num(r.clicks)),
        leads: cLeads,
        cpl: cLeads > 0 ? cSpend / cLeads : null,
        leadActions: leadActionsBreakdown(r.actions),
      };
    })
    .filter((c) => c.id)
    .sort((a, b) => b.spend - a.spend);

  // Account "leads" can still mix campaigns — keep both account + per-campaign.
  return {
    accountId,
    spend,
    impressions,
    clicks,
    reach,
    leads,
    cpl,
    campaigns,
    raw: { account: accountRes, campaigns: campaignRows },
  };
}

/** Pull actual Lead Ads rows for a campaign (name/phone/etc). */
export async function fetchMetaCampaignLeads(
  campaignId: string,
  period: AdsPeriod,
  opts?: { token?: string; limit?: number },
): Promise<MetaLeadRow[]> {
  const cfg = getMetaAdsConfig();
  const userToken = opts?.token || cfg.token;
  if (!userToken) throw new Error("META_ADS_ACCESS_TOKEN is required");
  if (!campaignId) return [];

  // Ads list can use system-user token; lead rows need Page token.
  const pageAuth = await resolveLeadAccessToken(userToken, cfg.pageId);
  const leadToken = pageAuth.token;

  const sinceUnix = Math.floor(new Date(`${period.startDate}T00:00:00Z`).getTime() / 1000);
  void sinceUnix; // date filter applied client-side after fetch
  const leadFields =
    "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data";

  let campaignName = "";
  try {
    const camp = (await graphGet(campaignId, userToken, { fields: "id,name" })) as {
      name?: string;
    };
    campaignName = String(camp.name || "");
  } catch {
    /* optional */
  }

  // Meta: /leads exists on ad + form nodes — NOT on campaign.
  const ads = await graphGetAll(
    `${campaignId}/ads`,
    userToken,
    {
      fields: "id,name",
      limit: "100",
    },
    6,
  );

  const formIds = new Set<string>();
  const adIds: Array<{ id: string; name: string }> = [];

  for (const row of ads) {
    const ad = row as Record<string, unknown>;
    const id = String(ad.id || "");
    if (!id) continue;
    adIds.push({ id, name: String(ad.name || id) });
  }

  // Page forms — use Page token
  try {
    const forms = await graphGetAll(
      `${pageAuth.pageId}/leadgen_forms`,
      leadToken,
      { fields: "id,name,status", limit: "100" },
      3,
    );
    for (const f of forms) {
      const id = String((f as { id?: string }).id || "");
      if (id) formIds.add(id);
    }
  } catch {
    /* continue with ad-level leads */
  }

  const seen = new Set<string>();
  const out: MetaLeadRow[] = [];
  const errors: string[] = [];

  async function ingestLeadRows(
    rows: unknown[],
    fallbackAd?: { id: string; name: string },
    fromPageForms = false,
  ) {
    const startMs = new Date(`${period.startDate}T00:00:00Z`).getTime();
    const endMs = new Date(`${period.endDate}T23:59:59Z`).getTime();

    for (const row of rows) {
      const mapped = mapLeadRow(row as Record<string, unknown>);
      if (!mapped.id || seen.has(mapped.id)) continue;

      if (mapped.createdTime) {
        const t = new Date(mapped.createdTime).getTime();
        if (Number.isFinite(t) && (t < startMs || t > endMs)) continue;
      }

      // Page-wide form dump: only keep this campaign when Meta sent campaign_id
      if (fromPageForms) {
        if (mapped.campaignId && mapped.campaignId !== campaignId) continue;
        if (!mapped.campaignId && !fallbackAd) continue;
      }

      if (!mapped.campaignId) mapped.campaignId = campaignId;
      if (!mapped.campaignName) mapped.campaignName = campaignName || null;
      if (!mapped.adId && fallbackAd) mapped.adId = fallbackAd.id;
      if (!mapped.adName && fallbackAd) mapped.adName = fallbackAd.name;
      seen.add(mapped.id);
      out.push(mapped);
    }
  }

  for (const ad of adIds) {
    try {
      const rows = await graphGetAll(
        `${ad.id}/leads`,
        leadToken,
        {
          fields: leadFields,
          limit: String(opts?.limit || 100),
        },
        6,
      );
      await ingestLeadRows(rows, ad, false);
    } catch (error) {
      try {
        const rows = await graphGetAll(
          `${ad.id}/leads`,
          userToken,
          {
            fields: leadFields,
            limit: String(opts?.limit || 100),
          },
          3,
        );
        await ingestLeadRows(rows, ad, false);
      } catch (error2) {
        errors.push(error2 instanceof Error ? error2.message : String(error2));
      }
    }
  }

  for (const formId of formIds) {
    try {
      const rows = await graphGetAll(
        `${formId}/leads`,
        leadToken,
        {
          fields: leadFields,
          limit: String(opts?.limit || 100),
        },
        6,
      );
      await ingestLeadRows(rows, undefined, true);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (!out.length && !adIds.length) {
    throw new Error("No ads found on this campaign.");
  }

  if (!out.length && errors.length) {
    const unique = [...new Set(errors)];
    throw new Error(
      `${unique[0]} — Page: ${pageAuth.pageName || pageAuth.pageId}. ` +
        `Assign this Page to the System User in Business Manager, set META_PAGE_ID, redeploy.`,
    );
  }

  return out.sort((a, b) =>
    String(b.createdTime || "").localeCompare(String(a.createdTime || "")),
  );
}

/** Page Instant Form leads for catch-up (webhook miss). Not a browser poll. */
export async function fetchRecentPageLeads(period: AdsPeriod): Promise<MetaLeadRow[]> {
  const cfg = getMetaAdsConfig();
  if (!cfg.token) throw new Error("META_ADS_ACCESS_TOKEN is required");

  const pageAuth = await resolveLeadAccessToken(cfg.token, cfg.pageId);
  const leadFields =
    "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data";

  const forms = await graphGetAll(
    `${pageAuth.pageId}/leadgen_forms`,
    pageAuth.token,
    { fields: "id,name,status", limit: "100" },
    3,
  );

  const startMs = new Date(`${period.startDate}T00:00:00Z`).getTime();
  const endMs = new Date(`${period.endDate}T23:59:59Z`).getTime();
  const seen = new Set<string>();
  const out: MetaLeadRow[] = [];

  for (const f of forms) {
    const formId = String((f as { id?: string }).id || "");
    if (!formId) continue;
    try {
      const rows = await graphGetAll(
        `${formId}/leads`,
        pageAuth.token,
        { fields: leadFields, limit: "50" },
        4,
      );
      for (const row of rows) {
        const mapped = mapLeadRow(row as Record<string, unknown>);
        if (!mapped.id || seen.has(mapped.id)) continue;
        if (mapped.createdTime) {
          const t = new Date(mapped.createdTime).getTime();
          if (Number.isFinite(t) && (t < startMs || t > endMs)) continue;
        }
        seen.add(mapped.id);
        out.push(mapped);
      }
    } catch {
      /* skip one form, keep others */
    }
  }

  return out.sort((a, b) =>
    String(b.createdTime || "").localeCompare(String(a.createdTime || "")),
  );
}
