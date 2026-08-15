import Link from "next/link";
import { BosShell } from "@/components/bos/BosShell";
import { listPartnersAction } from "@/app/actions/partners";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listAdsSnapshots } from "@/lib/ads/snapshots";
import { getGoogleAdsConfig } from "@/lib/ads/google";
import { getPublicReviewPayload } from "@/lib/reviews/store";
import { loadStockState } from "@/lib/stock/store";
import { summarizeStockPlaces } from "@/lib/stock/overview";
import { buildSeoInsights } from "@/lib/seo/insights";
import { loadFinanceRows } from "@/lib/finance/load";
import { earnedBySource, isFinanceEarned } from "@/lib/finance/summary";
import { SHEET_STATUSES, sheetStatusFromLead } from "@/lib/leads/stage-sync";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function usd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function isOpenStatus(status: string) {
  return ["draft", "sent", "overdue"].includes(status);
}

export default async function OwnerPage() {
  const user = await requireRouteAccess("/owner");

  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const [
    leadsRes,
    jobsOpenRes,
    financeRows,
    staffRes,
    techsRes,
    inboxNewRes,
    seoRes,
    reviewsPayload,
    stockState,
    adsSnapshots,
    partners,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, stage, metadata, source, created_at, deal_price")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "assigned", "en_route", "on_site"]),
    loadFinanceRows().catch(() => []),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "technician")
      .order("created_at", { ascending: true }),
    supabase
      .from("inbox_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("seo_snapshots")
      .select("period_start, period_end, search_console, ga4, synced_at")
      .order("period_end", { ascending: false })
      .limit(2),
    getPublicReviewPayload(),
    loadStockState().catch(() => null),
    listAdsSnapshots(8).catch(() => []),
    listPartnersAction().catch(() => []),
  ]);

  const leads = leadsRes.data || [];
  const statusCounts = Object.fromEntries(SHEET_STATUSES.map((s) => [s, 0])) as Record<
    string,
    number
  >;
  for (const lead of leads) {
    const status = sheetStatusFromLead({ stage: lead.stage, metadata: lead.metadata });
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  const activePipeline =
    (statusCounts.Waiting || 0) +
    (statusCounts["No answer"] || 0) +
    (statusCounts.Scheduled || 0) +
    (statusCounts["Tech confirmed"] || 0) +
    (statusCounts["En route"] || 0) +
    (statusCounts["On site"] || 0);

  const google = reviewsPayload.aggregates.google;
  const thumbtack = reviewsPayload.aggregates.thumbtack;

  const seoRows = seoRes.data || [];
  const seo = seoRows[0];
  const seoPrev = seoRows[1];
  const sc = (seo?.search_console || {}) as {
    totals?: { clicks?: number; impressions?: number; position?: number };
    topQueries?: Array<{ key: string; clicks: number; impressions: number; position: number }>;
  };
  const prevSc = (seoPrev?.search_console || {}) as {
    totals?: { clicks?: number; impressions?: number; position?: number };
  };
  const ga = (seo?.ga4 || {}) as {
    totals?: { sessions?: number; users?: number };
  };
  const searchInsight = seo
    ? buildSeoInsights({
        currentTotals: sc.totals,
        previousTotals: prevSc.totals,
        queries: sc.topQueries,
        hasPrevious: Boolean(seoPrev),
      })[0]
    : null;

  const technicians = (techsRes.data || []).map((t) => ({
    id: t.id,
    label: t.full_name || t.email || "Technician",
  }));
  const stockPartners = (partners || []).filter((p) => p.active && !p.id.startsWith("seed-"));
  const stockSummary = stockState?.items?.length
    ? summarizeStockPlaces(stockState, technicians, stockPartners)
    : null;

  const metaAds = (adsSnapshots || []).find((r) => r.platform === "meta");
  const googleAds = (adsSnapshots || []).find((r) => r.platform === "google_ads");
  const googleCfg = getGoogleAdsConfig();
  const googleLsa =
    ((googleAds?.metrics as { lsaLeadCount?: number } | null)?.lsaLeadCount as number | undefined) ??
    null;
  const adsLeads = (metaAds?.leads || 0) + (googleAds?.leads || 0);
  const adsSpend = (Number(metaAds?.spend) || 0) + (Number(googleAds?.spend) || 0);

  const jobsOpen = jobsOpenRes.count ?? 0;
  const finance = financeRows || [];
  const earnedCents = finance
    .filter((row) => isFinanceEarned(row.status))
    .reduce((sum, row) => sum + (row.amountCents || 0), 0);
  const bySource = earnedBySource(finance);
  const openCents = finance
    .filter((row) => isOpenStatus(row.status))
    .reduce((sum, row) => sum + (row.amountCents || 0), 0);
  const openInvoiceCount = finance.filter((row) => isOpenStatus(row.status)).length;
  const staffCount = staffRes.count ?? 0;
  const techCount = technicians.length;
  const inboxNew = inboxNewRes.count ?? 0;
  const ownStockPartners = stockPartners.filter((p) => p.has_own_stock).length;

  return (
    <BosShell
      user={user}
      active="/owner"
      title="Overview"
      subtitle="Same row, same height — columns line up"
    >
      <div className="ov-dash">
        <Link href="/reviews" className="ov-tile ov-tile--reviews">
          <div className="ov-tile__head">
            <h3>Reviews</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-fill">
            <div className="ov-reviews">
            <div>
              <div className="ov-reviews__label">Thumbtack</div>
              <div className="ov-reviews__score">
                {thumbtack.rating.toFixed(1)}
                <span>★</span>
              </div>
              <div className="ov-reviews__count">{thumbtack.count}</div>
            </div>
            <div className="ov-reviews__divider" />
            <div>
              <div className="ov-reviews__label">Google</div>
              <div className="ov-reviews__score">
                {google.rating.toFixed(1)}
                <span>★</span>
              </div>
              <div className="ov-reviews__count">{google.count}</div>
            </div>
          </div>
          </div>
        </Link>

        <Link href="/ads" className="ov-tile ov-tile--ads ov-tile--wide">
          <div className="ov-tile__head">
            <h3>Ads</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <p className="ov-tile__hint">
            {adsLeads || 0} leads · spend {adsSpend ? usd(adsSpend) : "—"}
          </p>
          <div className="ov-split">
            <div>
              <h4>Meta</h4>
              <ul className="ov-mini-list">
                <li>
                  <span>Spend</span>
                  <strong>{metaAds ? usd(metaAds.spend) : "Not synced"}</strong>
                </li>
                <li>
                  <span>Leads</span>
                  <strong>{metaAds?.leads ?? "—"}</strong>
                </li>
                <li>
                  <span>Clicks</span>
                  <strong>{metaAds?.clicks ?? "—"}</strong>
                </li>
                <li>
                  <span>Impr.</span>
                  <strong>{metaAds?.impressions ?? "—"}</strong>
                </li>
                <li>
                  <span>CPL</span>
                  <strong>{metaAds?.cpl != null ? usd(metaAds.cpl) : "—"}</strong>
                </li>
              </ul>
            </div>
            <div>
              <h4>Google / LSA</h4>
              <ul className="ov-mini-list">
                <li>
                  <span>Spend</span>
                  <strong>
                    {googleAds
                      ? usd(googleAds.spend)
                      : googleCfg.canQuery
                        ? "Sync from Ads"
                        : `${googleCfg.missing.length} missing`}
                  </strong>
                </li>
                <li>
                  <span>Leads</span>
                  <strong>{googleAds?.leads ?? "—"}</strong>
                </li>
                <li>
                  <span>Clicks</span>
                  <strong>{googleAds?.clicks ?? "—"}</strong>
                </li>
                <li>
                  <span>Impr.</span>
                  <strong>{googleAds?.impressions ?? "—"}</strong>
                </li>
                <li>
                  <span>CPL / LSA</span>
                  <strong>
                    {googleAds?.cpl != null ? usd(googleAds.cpl) : "—"}
                    {googleLsa != null ? ` · ${googleLsa} LSA` : ""}
                  </strong>
                </li>
              </ul>
            </div>
          </div>
        </Link>

        <Link href="/crm" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Inbox</h3>
            <span className="ov-tile__link">CRM →</span>
          </div>
          <div className="ov-fill">
            <div className="ov-big">{inboxNew}</div>
            <p className="ov-tile__hint">New items to review</p>
          </div>
        </Link>

        <Link href="/crm" className="ov-tile">
          <div className="ov-tile__head">
            <h3>CRM</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{activePipeline}</div>
          <p className="ov-tile__hint">Active now</p>
          <ul className="ov-stat-grid">
            {SHEET_STATUSES.map((status) => (
              <li key={status}>
                <span>{status}</span>
                <strong>{statusCounts[status] || 0}</strong>
              </li>
            ))}
          </ul>
        </Link>

        <Link href="/sheet" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Sheet</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{leads.length}</div>
          <p className="ov-tile__hint">Clients in the ledger</p>
          <ul className="ov-mini-list ov-mini-list--compact">
            <li>
              <span>Waiting</span>
              <strong>{statusCounts.Waiting || 0}</strong>
            </li>
            <li>
              <span>No answer</span>
              <strong>{statusCounts["No answer"] || 0}</strong>
            </li>
            <li>
              <span>On site</span>
              <strong>{statusCounts["On site"] || 0}</strong>
            </li>
            <li>
              <span>Completed</span>
              <strong>{statusCounts.Completed || 0}</strong>
            </li>
          </ul>
        </Link>

        <Link href="/dispatch" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Dispatch</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{jobsOpen}</div>
          <p className="ov-tile__hint">Open field jobs</p>
          <ul className="ov-mini-list ov-mini-list--compact">
            <li>
              <span>Waiting</span>
              <strong>{statusCounts.Waiting || 0}</strong>
            </li>
            <li>
              <span>Scheduled</span>
              <strong>{statusCounts.Scheduled || 0}</strong>
            </li>
            <li>
              <span>En route</span>
              <strong>{statusCounts["En route"] || 0}</strong>
            </li>
            <li>
              <span>On site</span>
              <strong>{statusCounts["On site"] || 0}</strong>
            </li>
          </ul>
        </Link>

        <Link href="/finance" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Finance</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{money(earnedCents)}</div>
          <p className="ov-tile__hint">Earned · paid / completed</p>
          <ul className="ov-mini-list ov-mini-list--compact">
            <li>
              <span>Garage Guys</span>
              <strong>{money(bySource.garageGuysCents)}</strong>
            </li>
            {bySource.partners.map((p) => (
              <li key={p.name}>
                <span>{p.name}</span>
                <strong>{money(p.cents)}</strong>
              </li>
            ))}
            {bySource.otherCents ? (
              <li>
                <span>Other</span>
                <strong>{money(bySource.otherCents)}</strong>
              </li>
            ) : null}
            <li>
              <span>Open invoices</span>
              <strong>
                {openInvoiceCount} · {money(openCents)}
              </strong>
            </li>
          </ul>
        </Link>

        <Link href="/stock" className="ov-tile ov-tile--stock">
          <div className="ov-tile__head">
            <h3>Stock</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{stockSummary?.totalUnits ?? 0}</div>
          <p className="ov-tile__hint">
            {stockSummary
              ? `${stockSummary.skuCount} SKUs · GG value ${
                  stockSummary.valueCents ? money(stockSummary.valueCents) : "—"
                }`
              : "No inventory snapshot yet"}
          </p>
          {stockSummary?.places.length ? (
            <ul className="ov-places">
              {stockSummary.places.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong className={row.warn ? "ov-warn" : undefined}>{row.units}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </Link>

        <Link href="/partners" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Partners</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{stockPartners.length}</div>
          <p className="ov-tile__hint">
            {ownStockPartners} own warehouse · rest use GG
          </p>
          {stockPartners.length ? (
            <ul className="ov-mini-list ov-mini-list--compact">
              {stockPartners.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <strong>{p.has_own_stock ? "Own stock" : "Uses GG"}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </Link>

        <Link href="/employees" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Employees</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{staffCount}</div>
          <p className="ov-tile__hint">{techCount} technicians</p>
          {technicians.length ? (
            <ul className="ov-mini-list ov-mini-list--compact">
              {technicians.map((t) => (
                <li key={t.id}>
                  <span>{t.label}</span>
                  <strong>Tech</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </Link>

        <Link href="/field" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Field</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{jobsOpen}</div>
          <p className="ov-tile__hint">Jobs in the field pipeline</p>
          <ul className="ov-mini-list ov-mini-list--compact">
            <li>
              <span>En route</span>
              <strong>{statusCounts["En route"] || 0}</strong>
            </li>
            <li>
              <span>On site</span>
              <strong>{statusCounts["On site"] || 0}</strong>
            </li>
          </ul>
        </Link>

        <Link href="/serm" className="ov-tile ov-tile--seo ov-tile--full">
          <div className="ov-tile__head">
            <h3>Search</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          {seo ? (
            <>
              <div className="ov-seo-grid">
                <div>
                  <div className="ov-seo-label">GSC clicks</div>
                  <div className="ov-seo-value">{sc.totals?.clicks ?? "—"}</div>
                </div>
                <div>
                  <div className="ov-seo-label">Impressions</div>
                  <div className="ov-seo-value">{sc.totals?.impressions ?? "—"}</div>
                </div>
                <div>
                  <div className="ov-seo-label">Avg position</div>
                  <div className="ov-seo-value">
                    {sc.totals?.position != null ? Number(sc.totals.position).toFixed(1) : "—"}
                  </div>
                </div>
                <div>
                  <div className="ov-seo-label">GA4 sessions</div>
                  <div className="ov-seo-value">{ga.totals?.sessions ?? "—"}</div>
                </div>
                <div>
                  <div className="ov-seo-label">GA4 users</div>
                  <div className="ov-seo-value">{ga.totals?.users ?? "—"}</div>
                </div>
                <div>
                  <div className="ov-seo-label">Period</div>
                  <div className="ov-seo-value ov-seo-value--sm">
                    {seo.period_start} → {seo.period_end}
                  </div>
                </div>
              </div>
              {searchInsight ? <p className="ov-tile__hint">{searchInsight.title}</p> : null}
            </>
          ) : (
            <p className="ov-tile__hint">No search snapshot yet — open Search after SEO sync.</p>
          )}
        </Link>
      </div>
    </BosShell>
  );
}
