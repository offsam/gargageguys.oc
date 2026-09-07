import { BosShell } from "@/components/bos/BosShell";
import { AdsBoard } from "@/components/bos/AdsBoard";
import { AdsReportPanel } from "@/components/bos/AdsReport";
import { AdsCampaignReportPanel } from "@/components/bos/AdsCampaignReport";
import { AdsPeriodBar } from "@/components/bos/AdsPeriodBar";
import { ThumbtackLeadsBoard } from "@/components/bos/ThumbtackLeadsBoard";
import { requireRouteAccess } from "@/lib/auth/require";
import { listAdsSnapshots } from "@/lib/ads/snapshots";
import { loadAdsReport, periodFromSnapshots } from "@/lib/ads/report";
import { loadAdsCampaignReport } from "@/lib/ads/campaign-report";
import { resolveAdsReportPeriod } from "@/lib/ads/period";
import type { MetaCampaignMetrics } from "@/lib/ads/meta";
import { getGoogleAdsConfig, type GoogleAdsCampaignMetrics } from "@/lib/ads/google";
import { listThumbtackLeadsForAds } from "@/lib/leads/thumbtack-ingest";

export default async function AdsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRouteAccess("/ads");
  const params = (await searchParams) || {};
  const rangeParam = typeof params.range === "string" ? params.range : null;
  const fromParam = typeof params.from === "string" ? params.from : null;
  const toParam = typeof params.to === "string" ? params.to : null;

  const adsSnapshots = await listAdsSnapshots(12).catch(() => []);
  const syncPeriod = periodFromSnapshots(adsSnapshots);
  const reportPeriod = resolveAdsReportPeriod({
    range: rangeParam,
    from: fromParam,
    to: toParam,
    syncStart: syncPeriod.periodStart,
    syncEnd: syncPeriod.periodEnd,
  });
  const metaAds = (adsSnapshots || []).find((r) => r.platform === "meta");
  const googleAds = (adsSnapshots || []).find((r) => r.platform === "google_ads");
  const estimateMetaSpend =
    reportPeriod.preset !== "sync" ||
    reportPeriod.periodStart !== syncPeriod.periodStart ||
    reportPeriod.periodEnd !== syncPeriod.periodEnd;

  const [adsReport, campaignReport, thumbtackLeads] = await Promise.all([
    loadAdsReport({
      periodStart: reportPeriod.periodStart,
      periodEnd: reportPeriod.periodEnd,
      metaAds: metaAds
        ? { spend: metaAds.spend, leads: metaAds.leads, cpl: metaAds.cpl }
        : undefined,
      googleAds: googleAds
        ? { spend: googleAds.spend, leads: googleAds.leads, cpl: googleAds.cpl }
        : undefined,
      estimateMetaSpend,
    }).catch(() => null),
    loadAdsCampaignReport({
      periodStart: reportPeriod.periodStart,
      periodEnd: reportPeriod.periodEnd,
      metaSnapshot: metaAds ?? null,
    }).catch(() => []),
    listThumbtackLeadsForAds(40).catch(() => []),
  ]);
  const campaigns = ((metaAds?.metrics as { campaigns?: MetaCampaignMetrics[] } | null)?.campaigns ||
    []) as MetaCampaignMetrics[];
  const googleCampaigns = ((googleAds?.metrics as { campaigns?: GoogleAdsCampaignMetrics[] } | null)
    ?.campaigns || []) as GoogleAdsCampaignMetrics[];
  const googleCfg = getGoogleAdsConfig();
  const googleLsa =
    ((googleAds?.metrics as { lsaLeadCount?: number } | null)?.lsaLeadCount as number | undefined) ??
    null;

  const googleProps = {
    periodStart: googleAds?.period_start,
    periodEnd: googleAds?.period_end,
    accountId: googleAds?.account_id,
    syncedAt: googleAds?.synced_at,
    spend: googleAds?.spend ?? null,
    leads: googleAds?.leads ?? null,
    cpl: googleAds?.cpl ?? null,
    clicks: googleAds?.clicks ?? null,
    impressions: googleAds?.impressions ?? null,
    campaigns: googleCampaigns,
    lsaLeadCount: googleLsa ?? undefined,
    hasApiKey: googleCfg.hasApiKey,
    canQuery: googleCfg.canQuery,
    missing: googleCfg.missing,
  };

  return (
    <BosShell
      user={user}
      active="/ads"
      title="Ads"
      subtitle="Lead funnel by day / week · Meta + Google spend · cost per completed"
    >
      <AdsPeriodBar
        preset={reportPeriod.preset}
        periodStart={reportPeriod.periodStart}
        periodEnd={reportPeriod.periodEnd}
      />
      {adsReport ? (
        <AdsReportPanel report={adsReport} estimateSpend={estimateMetaSpend} />
      ) : null}
      {campaignReport.length ? <AdsCampaignReportPanel rows={campaignReport} /> : null}
      <ThumbtackLeadsBoard leads={thumbtackLeads} />
      {!metaAds ? (
        <div className="bos-card">
          <p style={{ marginTop: 0 }}>
            No Meta snapshot yet. Use <strong>Sync Meta Ads now</strong> after env is set.
          </p>
          <AdsBoard
            periodStart="—"
            periodEnd="—"
            accountSpend={null}
            accountLeads={null}
            accountCpl={null}
            accountClicks={null}
            accountImpressions={null}
            campaigns={[]}
            google={googleProps}
          />
        </div>
      ) : (
        <AdsBoard
          periodStart={metaAds.period_start}
          periodEnd={metaAds.period_end}
          accountId={metaAds.account_id}
          syncedAt={metaAds.synced_at}
          accountSpend={metaAds.spend}
          accountLeads={metaAds.leads}
          accountCpl={metaAds.cpl}
          accountClicks={metaAds.clicks}
          accountImpressions={metaAds.impressions}
          campaigns={campaigns}
          google={googleProps}
        />
      )}
    </BosShell>
  );
}
