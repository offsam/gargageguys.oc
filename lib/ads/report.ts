import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canonicalLeadSource } from "@/lib/leads/source";
import { sheetStatusFromLead, type SheetStatus } from "@/lib/leads/stage-sync";
import { parseMoney, leadCostForSource } from "@/lib/sheet/money";
import type { AdsSnapshotRow } from "@/lib/ads/snapshots";

export const ADS_REPORT_SOURCES = [
  "Thumbtack",
  "Facebook",
  "Instagram",
  "Google",
  "Website",
  "Yelp",
  "Referral",
] as const;

export type AdsReportSource = (typeof ADS_REPORT_SOURCES)[number] | "Other";

export type AdsReportSourceRow = {
  source: AdsReportSource;
  received: number;
  waiting: number;
  active: number;
  estimate: number;
  completed: number;
  cancelled: number;
  noWin: number;
  noShow: number;
  /** Cancelled + No win + No-show — paid for lead, no completed job. */
  noReturn: number;
  /** Leads that moved past Waiting / No answer. */
  processed: number;
  revenue: number;
  spend: number;
  /** Platform CPL (Meta / Google sync) when available. */
  leadCost: number | null;
  /** Lead cost on dead-end rows (cancelled / no win / no-show). */
  leadCostBurned: number;
  cpl: number | null;
  costPerCompleted: number | null;
  conversionPct: number | null;
};

export type AdsReport = {
  periodStart: string;
  periodEnd: string;
  rows: AdsReportSourceRow[];
  totals: AdsReportSourceRow;
};

export type AdsPlatformSnapshot = {
  spend?: number | null;
  leads?: number | null;
  cpl?: number | null;
};

export type AdsReportLeadInput = {
  source?: string | null;
  stage?: string | null;
  metadata?: unknown;
  deal_price?: string | null;
};

const WAITING_STATUSES = new Set<SheetStatus>(["Waiting", "No answer"]);
const ACTIVE_STATUSES = new Set<SheetStatus>([
  "Scheduled",
  "Tech confirmed",
  "En route",
  "On site",
]);

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function reportSourceForLead(lead: AdsReportLeadInput): AdsReportSource {
  const meta = asMeta(lead.metadata);
  const canonical = canonicalLeadSource(
    String(lead.source || meta.leadSource || ""),
    {
      campaignName: metaString(meta, "metaCampaignName") || metaString(meta, "googleCampaignName"),
      adName: metaString(meta, "metaAdName"),
    },
  );
  if ((ADS_REPORT_SOURCES as readonly string[]).includes(canonical)) {
    return canonical as AdsReportSource;
  }
  return "Other";
}

function emptyRow(source: AdsReportSource): AdsReportSourceRow {
  return {
    source,
    received: 0,
    waiting: 0,
    active: 0,
    estimate: 0,
    completed: 0,
    cancelled: 0,
    noWin: 0,
    noShow: 0,
    noReturn: 0,
    processed: 0,
    revenue: 0,
    spend: 0,
    leadCost: null,
    leadCostBurned: 0,
    cpl: null,
    costPerCompleted: null,
    conversionPct: null,
  };
}

function finalizeRow(row: AdsReportSourceRow): AdsReportSourceRow {
  row.noReturn = row.cancelled + row.noWin + row.noShow;
  row.processed = row.received - row.waiting;
  // Meta / Google: CPL from sync (e.g. $16). Never spend ÷ CRM received — that inflates the number.
  if (row.leadCost != null && row.leadCost > 0) {
    row.cpl = row.leadCost;
  } else {
    row.cpl = row.received > 0 && row.spend > 0 ? row.spend / row.received : null;
    if (row.cpl != null && row.cpl > 0) row.leadCost = row.cpl;
  }
  // Real cost of a closed job = ad spend ÷ completed in our funnel (won vs lost is separate).
  row.costPerCompleted =
    row.completed > 0 && row.spend > 0 ? row.spend / row.completed : null;
  row.conversionPct =
    row.received > 0 ? Math.round((row.completed / row.received) * 1000) / 10 : null;
  return row;
}

function thumbtackSpendForLead(meta: Record<string, unknown>): number {
  const billed = parseMoney(metaString(meta, "thumbtackLeadPrice"));
  if (billed > 0) return billed;
  const leadCost = parseMoney(metaString(meta, "leadCost"));
  if (leadCost > 0) return leadCost;
  return parseMoney(leadCostForSource("Thumbtack") || "0");
}

function leadCostSpend(meta: Record<string, unknown>, source: AdsReportSource): number {
  if (source === "Thumbtack") return thumbtackSpendForLead(meta);
  const explicit = parseMoney(metaString(meta, "leadCost"));
  if (explicit > 0) return explicit;
  return parseMoney(leadCostForSource(source) || "0");
}

/** CPL from Meta / Google sync only — same number Meta Ads dashboard shows. */
function platformLeadCost(snapshot: AdsPlatformSnapshot | undefined): number | null {
  const syncedCpl = Number(snapshot?.cpl);
  if (syncedCpl > 0) return syncedCpl;
  const spend = Number(snapshot?.spend);
  const leads = Number(snapshot?.leads);
  if (spend > 0 && leads > 0) return spend / leads;
  return null;
}

function applyPlatformLeadCosts(
  rows: Map<AdsReportSource, AdsReportSourceRow>,
  input: {
    metaAds?: AdsPlatformSnapshot;
    googleAds?: AdsPlatformSnapshot;
  },
) {
  const metaCpl = platformLeadCost(input.metaAds);

  for (const source of ["Facebook", "Instagram"] as const) {
    const row = rows.get(source)!;
    if (metaCpl != null) row.leadCost = metaCpl;
    const dead = row.cancelled + row.noWin + row.noShow;
    if (metaCpl != null && metaCpl > 0 && dead > 0) {
      row.leadCostBurned = dead * metaCpl;
    }
  }

  const googleRow = rows.get("Google")!;
  const googleCpl = platformLeadCost(input.googleAds);
  if (googleCpl != null) googleRow.leadCost = googleCpl;
  const googleDead = googleRow.cancelled + googleRow.noWin + googleRow.noShow;
  if (googleCpl != null && googleCpl > 0 && googleDead > 0) {
    googleRow.leadCostBurned = googleDead * googleCpl;
  }

  const ttRow = rows.get("Thumbtack")!;
  if (ttRow.received > 0 && ttRow.spend > 0) {
    ttRow.leadCost = ttRow.spend / ttRow.received;
  }
}

export function aggregateAdsReport(
  leads: AdsReportLeadInput[],
  input: {
    periodStart: string;
    periodEnd: string;
    metaAds?: AdsPlatformSnapshot;
    googleAds?: AdsPlatformSnapshot;
  },
): AdsReport {
  const rows = new Map<AdsReportSource, AdsReportSourceRow>();
  for (const name of ADS_REPORT_SOURCES) rows.set(name, emptyRow(name));
  rows.set("Other", emptyRow("Other"));

  let metaLeadCount = 0;
  let facebookCount = 0;
  let instagramCount = 0;
  let thumbtackSpendAcc = 0;

  for (const lead of leads) {
    const source = reportSourceForLead(lead);
    const row = rows.get(source)!;
    const meta = asMeta(lead.metadata);
    const status = sheetStatusFromLead({ stage: lead.stage, metadata: lead.metadata });
    const perLeadCost = leadCostSpend(meta, source);
    const isMetaSource = source === "Facebook" || source === "Instagram";

    row.received += 1;

    if (WAITING_STATUSES.has(status)) row.waiting += 1;
    else if (ACTIVE_STATUSES.has(status)) row.active += 1;
    else if (status === "Estimate") row.estimate += 1;
    else if (status === "Completed") {
      row.completed += 1;
      const jobCost = parseMoney(metaString(meta, "jobCost")) || parseMoney(lead.deal_price);
      row.revenue += jobCost;
    } else if (status === "Cancelled") {
      row.cancelled += 1;
      if (!isMetaSource && source !== "Google") row.leadCostBurned += perLeadCost;
    } else if (status === "No win") {
      row.noWin += 1;
      if (!isMetaSource && source !== "Google") row.leadCostBurned += perLeadCost;
    } else if (status === "No-show") {
      row.noShow += 1;
      if (!isMetaSource && source !== "Google") row.leadCostBurned += perLeadCost;
    }

    if (source === "Thumbtack") {
      thumbtackSpendAcc += thumbtackSpendForLead(meta);
    } else if (source === "Facebook" || source === "Instagram") {
      metaLeadCount += 1;
      if (source === "Facebook") facebookCount += 1;
      if (source === "Instagram") instagramCount += 1;
    }
  }

  const metaSpend = Number(input.metaAds?.spend) || 0;
  const googleSpend = Number(input.googleAds?.spend) || 0;

  if (metaSpend > 0 && metaLeadCount > 0) {
    const fbRow = rows.get("Facebook")!;
    const igRow = rows.get("Instagram")!;
    if (facebookCount > 0) {
      fbRow.spend = metaSpend * (facebookCount / metaLeadCount);
    }
    if (instagramCount > 0) {
      igRow.spend = metaSpend * (instagramCount / metaLeadCount);
    }
    if (facebookCount === 0 && instagramCount === 0) {
      fbRow.spend = metaSpend;
    }
  }

  const googleRow = rows.get("Google")!;
  if (googleSpend > 0) googleRow.spend = googleSpend;

  const ttRow = rows.get("Thumbtack")!;
  if (thumbtackSpendAcc > 0) ttRow.spend = thumbtackSpendAcc;

  applyPlatformLeadCosts(rows, input);
  for (const [source, row] of rows) {
    if (row.spend > 0 || source === "Thumbtack" || source === "Facebook" || source === "Instagram" || source === "Google") {
      continue;
    }
    let acc = 0;
    for (const lead of leads) {
      if (reportSourceForLead(lead) !== source) continue;
      acc += leadCostSpend(asMeta(lead.metadata), source);
    }
    if (acc > 0) row.spend = acc;
  }

  const finalized = [...rows.values()]
    .map(finalizeRow)
    .filter((row) => row.received > 0 || row.spend > 0)
    .sort((a, b) => {
      const ai = ADS_REPORT_SOURCES.indexOf(a.source as (typeof ADS_REPORT_SOURCES)[number]);
      const bi = ADS_REPORT_SOURCES.indexOf(b.source as (typeof ADS_REPORT_SOURCES)[number]);
      const aOrder = ai === -1 ? 99 : ai;
      const bOrder = bi === -1 ? 99 : bi;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.received - a.received;
    });

  const totals = finalizeRow(
    finalized.reduce(
      (acc, row) => {
        acc.received += row.received;
        acc.waiting += row.waiting;
        acc.active += row.active;
        acc.estimate += row.estimate;
        acc.completed += row.completed;
        acc.cancelled += row.cancelled;
        acc.noWin += row.noWin;
        acc.noShow += row.noShow;
        acc.revenue += row.revenue;
        acc.spend += row.spend;
        acc.leadCostBurned += row.leadCostBurned;
        return acc;
      },
      emptyRow("Other"),
    ),
  );
  totals.source = "Other";

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    rows: finalized,
    totals,
  };
}

function defaultPeriod(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export function periodFromSnapshots(snapshots: AdsSnapshotRow[]): {
  periodStart: string;
  periodEnd: string;
} {
  const meta = snapshots.find((s) => s.platform === "meta");
  const google = snapshots.find((s) => s.platform === "google_ads");
  const pick = meta || google;
  if (pick?.period_start && pick?.period_end) {
    return { periodStart: pick.period_start, periodEnd: pick.period_end };
  }
  const fallback = defaultPeriod();
  return { periodStart: fallback.start, periodEnd: fallback.end };
}

export async function loadAdsReport(input?: {
  periodStart?: string;
  periodEnd?: string;
  metaAds?: AdsPlatformSnapshot;
  googleAds?: AdsPlatformSnapshot;
}): Promise<AdsReport> {
  const periodStart =
    input?.periodStart ||
    defaultPeriod().start;
  const periodEnd =
    input?.periodEnd ||
    defaultPeriod().end;

  const admin = getSupabaseAdmin();
  const startIso = `${periodStart}T00:00:00.000Z`;
  const endIso = `${periodEnd}T23:59:59.999Z`;

  const { data, error } = await admin
    .from("leads")
    .select("id, source, stage, metadata, deal_price, created_at")
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw error;

  return aggregateAdsReport(data || [], {
    periodStart,
    periodEnd,
    metaAds: input?.metaAds,
    googleAds: input?.googleAds,
  });
}
