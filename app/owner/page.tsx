import Link from "next/link";
import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPublicReviewPayload } from "@/lib/reviews/store";
import { loadStockState, masterQty, warehouseQty } from "@/lib/stock/store";
import { SHEET_STATUSES, sheetStatusFromLead } from "@/lib/leads/stage-sync";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default async function OwnerPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const [
    leadsRes,
    jobsOpenRes,
    invoicesOpenRes,
    staffRes,
    techsRes,
    inboxNewRes,
    seoRes,
    reviewsPayload,
    stockState,
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
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "sent", "overdue"]),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "technician"),
    supabase
      .from("inbox_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("seo_snapshots")
      .select("period_start, period_end, search_console, ga4, synced_at")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getPublicReviewPayload(),
    loadStockState().catch(() => null),
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
    (statusCounts.Scheduled || 0) +
    (statusCounts["Tech confirmed"] || 0) +
    (statusCounts["En route"] || 0) +
    (statusCounts["On site"] || 0);

  const google = reviewsPayload.aggregates.google;
  const thumbtack = reviewsPayload.aggregates.thumbtack;

  const seo = seoRes.data;
  const sc = (seo?.search_console || {}) as {
    totals?: { clicks?: number; impressions?: number; position?: number };
  };
  const ga = (seo?.ga4 || {}) as {
    totals?: { sessions?: number; users?: number };
  };

  let stockSkus = 0;
  let stockMasterUnits = 0;
  let stockWarehouseUnits = 0;
  let stockValueCents = 0;
  let stockLow = 0;
  if (stockState?.items?.length) {
    stockSkus = stockState.items.filter((i) => i.active !== false).length;
    for (const item of stockState.items) {
      if (item.active === false) continue;
      const master = masterQty(stockState, item.id);
      const wh = warehouseQty(stockState, item.id);
      stockMasterUnits += master;
      stockWarehouseUnits += wh;
      stockValueCents += master * (item.unitCostCents || 0);
      if (master <= (item.reorderAt || 0)) stockLow += 1;
    }
  }

  const jobsOpen = jobsOpenRes.count ?? 0;
  const invoicesOpen = invoicesOpenRes.count ?? 0;
  const staffCount = staffRes.count ?? 0;
  const techCount = techsRes.count ?? 0;
  const inboxNew = inboxNewRes.count ?? 0;

  return (
    <BosShell
      user={user}
      active="/owner"
      title="Overview"
      subtitle="All categories at a glance — numbers first, details in each section"
    >
      <div className="ov-dash">
        <Link href="/serm" className="ov-tile ov-tile--reviews ov-tile--wide">
          <div className="ov-tile__head">
            <h3>Reviews</h3>
            <span className="ov-tile__link">SERM →</span>
          </div>
          <div className="ov-reviews">
            <div>
              <div className="ov-reviews__label">Thumbtack</div>
              <div className="ov-reviews__score">
                {thumbtack.rating.toFixed(1)}
                <span>★</span>
              </div>
              <div className="ov-reviews__count">{thumbtack.count} reviews</div>
            </div>
            <div className="ov-reviews__divider" />
            <div>
              <div className="ov-reviews__label">Google</div>
              <div className="ov-reviews__score">
                {google.rating.toFixed(1)}
                <span>★</span>
              </div>
              <div className="ov-reviews__count">{google.count} reviews</div>
            </div>
          </div>
          <p className="ov-tile__hint">Live aggregates from synced snapshots</p>
        </Link>

        <Link href="/crm" className="ov-tile ov-tile--tall">
          <div className="ov-tile__head">
            <h3>CRM funnel</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{activePipeline}</div>
          <p className="ov-tile__hint">Active now (Waiting → On site)</p>
          <ul className="ov-mini-list">
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
          <p className="ov-tile__hint">Clients in the main ledger</p>
          <ul className="ov-mini-list ov-mini-list--compact">
            <li>
              <span>Waiting</span>
              <strong>{statusCounts.Waiting || 0}</strong>
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

        <Link href="/stock" className="ov-tile ov-tile--stock">
          <div className="ov-tile__head">
            <h3>Stock</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{stockSkus}</div>
          <p className="ov-tile__hint">SKUs · inventory snapshot</p>
          <ul className="ov-mini-list ov-mini-list--compact">
            <li>
              <span>All units</span>
              <strong>{stockMasterUnits}</strong>
            </li>
            <li>
              <span>Warehouse</span>
              <strong>{stockWarehouseUnits}</strong>
            </li>
            <li>
              <span>Est. value</span>
              <strong>{stockValueCents ? money(stockValueCents) : "—"}</strong>
            </li>
            <li>
              <span>Low / reorder</span>
              <strong className={stockLow ? "ov-warn" : undefined}>{stockLow}</strong>
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
        </Link>

        <Link href="/finance" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Finance</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{invoicesOpen}</div>
          <p className="ov-tile__hint">Open invoices (draft / sent / overdue)</p>
        </Link>

        <Link href="/employees" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Employees</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{staffCount}</div>
          <p className="ov-tile__hint">{techCount} technicians on roster</p>
        </Link>

        <Link href="/field" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Field</h3>
            <span className="ov-tile__link">Open →</span>
          </div>
          <div className="ov-big">{jobsOpen}</div>
          <p className="ov-tile__hint">Jobs currently in the field pipeline</p>
        </Link>

        <Link href="/crm" className="ov-tile">
          <div className="ov-tile__head">
            <h3>Inbox</h3>
            <span className="ov-tile__link">CRM →</span>
          </div>
          <div className="ov-big">{inboxNew}</div>
          <p className="ov-tile__hint">New inbox items needing review</p>
        </Link>

        <Link href="/serm" className="ov-tile ov-tile--seo ov-tile--wide">
          <div className="ov-tile__head">
            <h3>SEO / traffic</h3>
            <span className="ov-tile__link">SERM →</span>
          </div>
          {seo ? (
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
                  {sc.totals?.position != null
                    ? Number(sc.totals.position).toFixed(1)
                    : "—"}
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
          ) : (
            <p className="ov-tile__hint">No SEO snapshot yet — run SEO sync from SERM.</p>
          )}
        </Link>
      </div>
    </BosShell>
  );
}
