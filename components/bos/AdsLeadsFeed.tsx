import Link from "next/link";
import type { AdsFeedLead } from "@/lib/leads/ads-feed";

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sourceClass(source: string) {
  const key = source.toLowerCase();
  if (key.includes("thumbtack")) return "is-thumbtack";
  if (key.includes("instagram")) return "is-instagram";
  if (key.includes("facebook")) return "is-facebook";
  if (key.includes("google")) return "is-google";
  if (key.includes("website")) return "is-website";
  if (key.includes("yelp")) return "is-yelp";
  if (key.includes("referral")) return "is-referral";
  return "is-other";
}

export function AdsLeadsFeed({
  leads,
  periodStart,
  periodEnd,
}: {
  leads: AdsFeedLead[];
  periodStart: string;
  periodEnd: string;
}) {
  return (
    <div className="ads-board" style={{ marginBottom: "2rem" }}>
      <h2 style={{ marginTop: 0 }}>Lead feed</h2>
      <p className="field-muted">
        Paid ads leads only — Thumbtack, Meta, Google (and Yelp). Champion / Partner jobs stay out
        of this list. Newest first for {periodStart} → {periodEnd}.
      </p>
      <div className="ads-lead-summary">
        <strong>{leads.length}</strong> lead{leads.length === 1 ? "" : "s"} in this period
      </div>
      {!leads.length ? (
        <div className="bos-card">
          No paid ads leads in this period yet. Thumbtack / Meta / Google rows show up here when
          webhooks create them.
        </div>
      ) : (
        <table className="bos-table ads-feed-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Source</th>
              <th>Name</th>
              <th>Phone</th>
              <th>ZIP / job</th>
              <th>Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>{when(lead.createdAt)}</td>
                <td>
                  <span className={`ads-source-pill ${sourceClass(lead.source)}`}>{lead.source}</span>
                  {lead.channelDetail ? (
                    <div className="field-muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
                      {lead.channelDetail}
                    </div>
                  ) : null}
                </td>
                <td>
                  <strong>{lead.name}</strong>
                  {lead.address ? (
                    <div className="field-muted" style={{ fontSize: "0.75rem" }}>
                      {lead.address}
                    </div>
                  ) : null}
                </td>
                <td>{lead.phone || "—"}</td>
                <td>{[lead.zip, lead.job].filter(Boolean).join(" · ") || "—"}</td>
                <td>{lead.leadCost ? `$${lead.leadCost}` : "—"}</td>
                <td>
                  <Link href="/crm" className="ads-crm-pill is-in">
                    {lead.sheetStatus || lead.stage || "CRM"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
