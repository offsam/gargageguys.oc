import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SermPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [{ data: snapshots }, { data: reviewSnapshots }, { data: reviews }] =
    await Promise.all([
      supabase
        .from("seo_snapshots")
        .select("*")
        .order("period_end", { ascending: false })
        .limit(12),
      supabase.from("review_snapshots").select("*").order("source"),
      supabase
        .from("reviews")
        .select("id, source, author_name, rating, text, posted_at, owner_reply, synced_at")
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(40),
    ]);

  const latest = snapshots?.[0];
  const googleSnap = reviewSnapshots?.find((r) => r.source === "google");
  const thumbtackSnap = reviewSnapshots?.find((r) => r.source === "thumbtack");
  const sc = (latest?.search_console || {}) as {
    totals?: { clicks?: number; impressions?: number; ctr?: number; position?: number };
    topQueries?: Array<{ key: string; clicks: number; impressions: number; position: number }>;
    topPages?: Array<{ key: string; clicks: number; impressions: number; position: number }>;
  };
  const ga = (latest?.ga4 || {}) as {
    totals?: { sessions?: number; screenPageViews?: number; users?: number };
    topPages?: Array<{ path: string; sessions: number; screenPageViews: number }>;
  };

  return (
    <BosShell
      user={user}
      active="/serm"
      title="SERM"
      subtitle="Search & reputation metrics (GSC + GA4 + Google reviews)"
    >
      <div className="bos-grid">
        <div className="bos-card">
          <h3>Google reviews</h3>
          <div className="value">
            {googleSnap ? `${googleSnap.rating ?? "—"}★ · ${googleSnap.review_count}` : "—"}
          </div>
        </div>
        <div className="bos-card">
          <h3>Thumbtack reviews</h3>
          <div className="value">
            {thumbtackSnap
              ? `${thumbtackSnap.rating ?? "—"}★ · ${thumbtackSnap.review_count}`
              : "—"}
          </div>
        </div>
        <div className="bos-card">
          <h3>Reviews synced</h3>
          <div className="value">{reviews?.length ?? 0}</div>
        </div>
      </div>

      <h2>Recent reviews</h2>
      {!reviews?.length ? (
        <div className="bos-card">
          No reviews in DB yet. Apply migration <code>202608130003_reviews.sql</code>, then run{" "}
          <code>/api/google-reviews-sync</code>.
        </div>
      ) : (
        <table className="bos-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Author</th>
              <th>Rating</th>
              <th>Text</th>
              <th>Posted</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((row) => (
              <tr key={row.id}>
                <td>{row.source}</td>
                <td>{row.author_name || "—"}</td>
                <td>{row.rating ?? "—"}</td>
                <td>{(row.text || "").slice(0, 140)}</td>
                <td>{row.posted_at ? new Date(row.posted_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!latest ? (
        <div className="bos-card" style={{ marginTop: 24 }}>
          No SEO snapshots yet. Run <code>/api/seo-sync</code> (cron or manual with CRON_SECRET).
        </div>
      ) : (
        <>
          <h2 style={{ marginTop: 32 }}>Search Console / GA4</h2>
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
              <div className="value">{sc.totals?.position?.toFixed?.(1) ?? sc.totals?.position ?? "—"}</div>
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
