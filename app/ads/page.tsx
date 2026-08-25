import { BosShell } from "@/components/bos/BosShell";
import { AdsBoard } from "@/components/bos/AdsBoard";
import { AdsReportPanel } from "@/components/bos/AdsReport";
import { ThumbtackLeadsBoard } from "@/components/bos/ThumbtackLeadsBoard";
import { requireRouteAccess } from "@/lib/auth/require";
import { listAdsSnapshots } from "@/lib/ads/snapshots";
import { loadAdsReport, periodFromSnapshots } from "@/lib/ads/report";
import type { MetaCampaignMetrics } from "@/lib/ads/meta";
import { getGoogleAdsConfig, type GoogleAdsCampaignMetrics } from "@/lib/ads/google";
import { listThumbtackLeadsForAds } from "@/lib/leads/thumbtack-ingest";

export default async function AdsPage() {
  const user = await requireRouteAccess("/ads");

  const adsSnapshots = await listAdsSnapshots(12).catch(() => []);
  const period = periodFromSnapshots(adsSnapshots);
  const metaAds = (adsSnapshots || []).find((r) => r.platform === "meta");
  const googleAds = (adsSnapshots || []).find((r) => r.platform === "google_ads");

  const [adsReport, thumbtackLeads] = await Promise.all([
    loadAdsReport({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      metaSpend: metaAds?.spend ?? null,
      googleSpend: googleAds?.spend ?? null,
    }).catch(() => null),
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
      subtitle="Lead funnel by source · spend · cost per lead and per completed job"
    >
      {adsReport ? <AdsReportPanel report={adsReport} /> : null}
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
