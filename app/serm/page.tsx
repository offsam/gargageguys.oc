import { BosShell } from "@/components/bos/BosShell";
import { requireRouteAccess } from "@/lib/auth/require";
import { buildSeoInsights, quickWinQueries } from "@/lib/seo/insights";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SermPage() {
  const user = await requireRouteAccess("/serm");

  const supabase = await createSupabaseServerClient();
  const { data: snapshots } = await supabase
    .from("seo_snapshots")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(12);

  const latest = snapshots?.[0];
  const previous = snapshots?.[1];
  const sc = (latest?.search_console || {}) as {
    totals?: { clicks?: number; impressions?: number; ctr?: number; position?: number };
    topQueries?: Array<{ key: string; clicks: number; impressions: number; position: number }>;
    topPages?: Array<{ key: string; clicks: number; impressions: number; position: number }>;
  };
  const prevSc = (previous?.search_console || {}) as {
    totals?: { clicks?: number; impressions?: number; ctr?: number; position?: number };
  };
  const insights = latest
    ? buildSeoInsights({
        currentTotals: sc.totals,
        previousTotals: prevSc.totals,
        queries: sc.topQueries,
        hasPrevious: Boolean(previous),
      })
    : [];
  const wins = quickWinQueries(sc.topQueries);
  const ga = (latest?.ga4 || {}) as {
    totals?: { sessions?: number; screenPageViews?: number; users?: number };
    topPages?: Array<{ path: string; sessions: number; screenPageViews: number }>;
  };

  return (
    <BosShell
      user={user}
      active="/serm"
      title="Search"
      subtitle="Who finds Garage Guys in Google — and what to do about it"
    >
      {!latest ? (
        <div className="bos-card">
          No search snapshot yet. This fills in after SEO sync (Search Console + site traffic). Come
          back after the first period lands — the page will then say what moved.
        </div>
      ) : (
        <>
          <div className="bos-card seo-insights">
            <h3>What to do</h3>
            <p className="seo-insights__lead">
              Not a report for an agency. These are the moves that usually matter for a garage-door
              shop: clicks from Google, money queries, and whether you are on page 1.
            </p>
            <ul className="seo-insights__list">
              {insights.map((row) => (
                <li key={row.title} className={`seo-insight seo-insight--${row.kind}`}>
                  <strong>{row.title}</strong>
                  <span>{row.detail}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bos-grid">
            <div className="bos-card">
              <h3>Period</h3>
              <div className="value" style={{ fontSize: "1.1rem" }}>
                {latest.period_start} → {latest.period_end}
              </div>
            </div>
            <div className="bos-card">
              <h3>GSC clicks</h3>
              <div className="value">{sc.totals?.clicks ?? "—"}</div>
            </div>
            <div className="bos-card">
              <h3>GSC impressions</h3>
              <div className="value">{sc.totals?.impressions ?? "—"}</div>
            </div>
            <div className="bos-card">
              <h3>Avg position</h3>
              <div className="value">
                {sc.totals?.position?.toFixed?.(1) ?? sc.totals?.position ?? "—"}
              </div>
            </div>
            <div className="bos-card">
              <h3>GA4 sessions</h3>
              <div className="value">{ga.totals?.sessions ?? "—"}</div>
            </div>
            <div className="bos-card">
              <h3>GA4 users</h3>
              <div className="value">{ga.totals?.users ?? "—"}</div>
            </div>
          </div>

          <h2>Quick wins (positions 11–20)</h2>
          <p className="seo-insights__lead">
            These queries already show Garage Guys on page 2. Sorted by impressions. This list does
            not change ads or pages by itself.
          </p>
          {wins.length ? (
            <table className="bos-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Clicks</th>
                  <th>Impressions</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {wins.map((row) => (
                  <tr key={row.key}>
                    <td>{row.key}</td>
                    <td>{row.clicks}</td>
                    <td>{row.impressions}</td>
                    <td>{row.position?.toFixed?.(1) ?? row.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="bos-card">
              No queries in this snapshot sit at positions 11–20. After the next Search Console
              sync, anything that lands on page 2 will show here, highest impressions first.
            </div>
          )}

          <h2>Top queries</h2>
          <table className="bos-table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Clicks</th>
                <th>Impressions</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {(sc.topQueries || []).slice(0, 15).map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td>{row.clicks}</td>
                  <td>{row.impressions}</td>
                  <td>{row.position?.toFixed?.(1) ?? row.position}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Top pages (Search Console)</h2>
          <table className="bos-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Clicks</th>
                <th>Impressions</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {(sc.topPages || []).slice(0, 15).map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td>{row.clicks}</td>
                  <td>{row.impressions}</td>
                  <td>{row.position?.toFixed?.(1) ?? row.position}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Top pages (GA4)</h2>
          <table className="bos-table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Sessions</th>
                <th>Views</th>
              </tr>
            </thead>
            <tbody>
              {(ga.topPages || []).slice(0, 15).map((row) => (
                <tr key={row.path}>
                  <td>{row.path}</td>
                  <td>{row.sessions}</td>
                  <td>{row.screenPageViews}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Snapshot history</h2>
          <table className="bos-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Synced</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(snapshots || []).map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.period_start} → {s.period_end}
                  </td>
                  <td>{new Date(s.synced_at).toLocaleString()}</td>
                  <td>{s.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </BosShell>
  );
}
