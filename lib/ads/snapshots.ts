import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { STOCK_BUCKET } from "@/lib/stock/store";

const ADS_OBJECT = "ads-snapshots.json";

export type AdsSnapshotRow = {
  id: string;
  platform: string;
  period_start: string;
  period_end: string;
  account_id: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
  cpl: number | null;
  metrics: Record<string, unknown>;
  raw?: unknown;
  synced_at: string;
  created_at: string;
};

export type AdsSnapshotPayload = {
  platform: "meta" | "google_lsa" | "google_ads";
  period: { startDate: string; endDate: string };
  accountId?: string | null;
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  leads?: number | null;
  cpl?: number | null;
  metrics?: Record<string, unknown>;
  raw?: unknown;
  syncedAt?: string;
};

type AdsFile = { version: number; updatedAt: string; snapshots: AdsSnapshotRow[] };

function emptyFile(): AdsFile {
  return { version: 0, updatedAt: new Date().toISOString(), snapshots: [] };
}

function rowKey(platform: string, start: string, end: string) {
  return `${platform}|${start}|${end}`;
}

async function ensureBucket() {
  const admin = getSupabaseAdmin();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!(buckets || []).some((b) => b.name === STOCK_BUCKET)) {
    const { error } = await admin.storage.createBucket(STOCK_BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
}

async function loadFile(): Promise<AdsFile> {
  await ensureBucket();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(STOCK_BUCKET).download(ADS_OBJECT);
  if (error) {
    const status = (error as { statusCode?: string }).statusCode;
    if (status === "404" || /not found|404/i.test(error.message)) return emptyFile();
    throw error;
  }
  const text = await data.text();
  if (!text.trim()) return emptyFile();
  return JSON.parse(text) as AdsFile;
}

async function saveFile(file: AdsFile) {
  await ensureBucket();
  const admin = getSupabaseAdmin();
  const next: AdsFile = {
    ...file,
    version: file.version + 1,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await admin.storage.from(STOCK_BUCKET).upload(ADS_OBJECT, JSON.stringify(next, null, 2), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw error;
}

function isMissingTable(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = error.message || "";
  return (
    error.code === "42P01" ||
    (/ads_snapshots/i.test(msg) && /does not exist|Could not find|schema cache/i.test(msg))
  );
}

async function tryTableUpsert(row: AdsSnapshotRow): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("ads_snapshots").upsert(
    {
      id: row.id,
      platform: row.platform,
      period_start: row.period_start,
      period_end: row.period_end,
      account_id: row.account_id,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      leads: row.leads,
      cpl: row.cpl,
      metrics: row.metrics,
      raw: row.raw ?? null,
      synced_at: row.synced_at,
      created_at: row.created_at,
    },
    { onConflict: "platform,period_start,period_end" },
  );
  if (!error) return true;
  if (isMissingTable(error)) return false;
  throw error;
}

async function tryTableList(limit: number, platform?: string): Promise<AdsSnapshotRow[] | null> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("ads_snapshots")
    .select("*")
    .order("synced_at", { ascending: false })
    .limit(limit);
  if (platform) query = query.eq("platform", platform);
  const { data, error } = await query;
  if (!error) return (data || []) as AdsSnapshotRow[];
  if (isMissingTable(error)) return null;
  throw error;
}

export async function upsertAdsSnapshot(payload: AdsSnapshotPayload) {
  const now = payload.syncedAt || new Date().toISOString();
  const file = await loadFile();
  const key = rowKey(payload.platform, payload.period.startDate, payload.period.endDate);
  const existing = file.snapshots.find(
    (s) => rowKey(s.platform, s.period_start, s.period_end) === key,
  );
  const row: AdsSnapshotRow = {
    id: existing?.id || crypto.randomUUID(),
    platform: payload.platform,
    period_start: payload.period.startDate,
    period_end: payload.period.endDate,
    account_id: payload.accountId || null,
    spend: payload.spend ?? null,
    impressions: payload.impressions ?? null,
    clicks: payload.clicks ?? null,
    leads: payload.leads ?? null,
    cpl: payload.cpl ?? null,
    metrics: payload.metrics || {},
    raw: payload.raw,
    synced_at: now,
    created_at: existing?.created_at || now,
  };

  file.snapshots = [
    row,
    ...file.snapshots.filter((s) => rowKey(s.platform, s.period_start, s.period_end) !== key),
  ].slice(0, 60);

  await saveFile(file);
  try {
    await tryTableUpsert(row);
  } catch (err) {
    // Keep JSON as fallback so a DB glitch does not leave the UI on a stale row.
    console.error("[upsertAdsSnapshot] DB upsert failed; file snapshot kept", err);
  }
  return { id: row.id };
}

function sortSnapshotsNewest(rows: AdsSnapshotRow[]) {
  return rows.slice().sort((a, b) => {
    const sync = String(b.synced_at || "").localeCompare(String(a.synced_at || ""));
    if (sync) return sync;
    const end = String(b.period_end || "").localeCompare(String(a.period_end || ""));
    if (end) return end;
    return String(b.period_start || "").localeCompare(String(a.period_start || ""));
  });
}

export async function listAdsSnapshots(limit = 12, platform?: string) {
  const file = await loadFile();
  let fileRows = sortSnapshotsNewest(file.snapshots);
  if (platform) fileRows = fileRows.filter((r) => r.platform === platform);
  fileRows = fileRows.slice(0, limit);

  let fromTable: AdsSnapshotRow[] | null = null;
  try {
    fromTable = await tryTableList(Math.max(limit * 3, 24), platform);
  } catch (err) {
    console.error("[listAdsSnapshots] DB list failed; using file", err);
  }

  if (fromTable?.length) {
    fromTable = sortSnapshotsNewest(fromTable).slice(0, limit);
  }

  if (!fromTable?.length) return fileRows;
  if (!fileRows.length) return fromTable;

  // Prefer whichever store has the newer sync for the top row of this platform.
  const tableTop = fromTable[0]?.synced_at || "";
  const fileTop = fileRows[0]?.synced_at || "";
  if (fileTop && (!tableTop || fileTop > tableTop)) return fileRows;
  return fromTable;
}
