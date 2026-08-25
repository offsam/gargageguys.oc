import { canonicalLeadSource } from "@/lib/leads/source";
import { sheetStatusFromLead, type SheetStatus } from "@/lib/leads/stage-sync";
import type { AdsReportLeadInput } from "@/lib/ads/report";
import {
  buildMetaPricingIndex,
  isMetaLeadSource,
  type MetaPricingIndex,
} from "@/lib/ads/meta-lead-cost";
import type { AdsSnapshotRow } from "@/lib/ads/snapshots";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AdsCampaignReportRow = {
  campaignId: string;
  campaignName: string;
  received: number;
  waiting: number;
  active: number;
  estimate: number;
  completed: number;
  cancelled: number;
  noWin: number;
  noShow: number;
  spend: number;
  leadCost: number | null;
  leadCostBurned: number;
  costPerCompleted: number | null;
};

const UNASSIGNED_ID = "__unassigned__";

const WAITING = new Set<SheetStatus>(["Waiting", "No answer"]);
const ACTIVE = new Set<SheetStatus>([
  "Scheduled",
  "Tech confirmed",
  "En route",
  "On site",
]);

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function emptyCampaign(id: string, name: string): AdsCampaignReportRow {
  return {
    campaignId: id,
    campaignName: name,
    received: 0,
    waiting: 0,
    active: 0,
    estimate: 0,
    completed: 0,
    cancelled: 0,
    noWin: 0,
    noShow: 0,
    spend: 0,
    leadCost: null,
    leadCostBurned: 0,
    costPerCompleted: null,
  };
}

function finalizeCampaign(row: AdsCampaignReportRow): AdsCampaignReportRow {
  const dead = row.cancelled + row.noWin + row.noShow;
  if (row.leadCost != null && row.leadCost > 0 && dead > 0) {
    row.leadCostBurned = dead * row.leadCost;
  }
  if (row.completed > 0 && row.spend > 0) {
    row.costPerCompleted = row.spend / row.completed;
  }
  return row;
}

function isMetaLead(lead: AdsReportLeadInput): boolean {
  const meta = asMeta(lead.metadata);
  const source = canonicalLeadSource(String(lead.source || meta.leadSource || ""), {
    campaignName: String(meta.metaCampaignName || ""),
    adName: String(meta.metaAdName || ""),
  });
  return (
    isMetaLeadSource(source) ||
    Boolean(String(meta.metaLeadgenId || "").trim()) ||
    Boolean(String(meta.metaCampaignId || "").trim())
  );
}

export function aggregateMetaCampaignReport(
  leads: AdsReportLeadInput[],
  snapshot: AdsSnapshotRow | null | undefined,
): AdsCampaignReportRow[] {
  const index: MetaPricingIndex = buildMetaPricingIndex(snapshot);
  const rows = new Map<string, AdsCampaignReportRow>();

  for (const pricing of index.campaigns.values()) {
    rows.set(pricing.id, {
      ...emptyCampaign(pricing.id, pricing.name),
      spend: pricing.spend,
      leadCost: pricing.cpl,
    });
  }

  const unassigned = emptyCampaign(UNASSIGNED_ID, "No campaign id");

  for (const lead of leads) {
    if (!isMetaLead(lead)) continue;
    const meta = asMeta(lead.metadata);
    const campaignId = String(meta.metaCampaignId || "").trim();
    const campaignName = String(meta.metaCampaignName || "").trim() || "Meta campaign";
    const row = campaignId
      ? rows.get(campaignId) || (() => {
          const created = emptyCampaign(campaignId, campaignName);
          rows.set(campaignId, created);
          return created;
        })()
      : unassigned;

    if (!row.campaignName && campaignName) row.campaignName = campaignName;

    const status = sheetStatusFromLead({ stage: lead.stage, metadata: lead.metadata });
    row.received += 1;
    if (WAITING.has(status)) row.waiting += 1;
    else if (ACTIVE.has(status)) row.active += 1;
    else if (status === "Estimate") row.estimate += 1;
    else if (status === "Completed") row.completed += 1;
    else if (status === "Cancelled") row.cancelled += 1;
    else if (status === "No win") row.noWin += 1;
    else if (status === "No-show") row.noShow += 1;
  }

  if (unassigned.received > 0) rows.set(UNASSIGNED_ID, unassigned);

  return [...rows.values()]
    .map((row) => {
      if (row.leadCost == null || row.leadCost <= 0) {
        row.leadCost = index.accountCpl;
      }
      if (row.spend <= 0 && row.leadCost != null && row.received > 0) {
        row.spend = row.leadCost * row.received;
      }
      return finalizeCampaign(row);
    })
    .filter((row) => row.received > 0 || row.spend > 0)
    .sort((a, b) => {
      if (b.received !== a.received) return b.received - a.received;
      return a.campaignName.localeCompare(b.campaignName);
    });
}

export function loadMetaCampaignReportRows(
  leads: AdsReportLeadInput[],
  snapshot: AdsSnapshotRow | null | undefined,
): AdsCampaignReportRow[] {
  return aggregateMetaCampaignReport(leads, snapshot);
}

export async function loadAdsCampaignReport(input: {
  periodStart: string;
  periodEnd: string;
  metaSnapshot?: AdsSnapshotRow | null;
}): Promise<AdsCampaignReportRow[]> {
  const admin = getSupabaseAdmin();
  const startIso = `${input.periodStart}T00:00:00.000Z`;
  const endIso = `${input.periodEnd}T23:59:59.999Z`;
  const { data, error } = await admin
    .from("leads")
    .select("id, source, stage, metadata, deal_price, created_at")
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return aggregateMetaCampaignReport(data || [], input.metaSnapshot);
}
