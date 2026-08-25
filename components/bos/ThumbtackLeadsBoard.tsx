import Link from "next/link";
import { THUMBTACK_SHEET_LEAD_COST } from "@/lib/thumbtack/parse";
import type { ThumbtackAdsLead } from "@/lib/leads/thumbtack-ingest";

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ThumbtackLeadsBoard({ leads }: { leads: ThumbtackAdsLead[] }) {
  const last = leads[0]?.createdAt ? when(leads[0].createdAt) : "—";

  return (
    <div className="ads-board" style={{ marginBottom: "2rem" }}>
      <h2 style={{ marginTop: 0 }}>Thumbtack leads</h2>
      <p className="field-muted">
        Incoming webhook leads only. Sheet lead cost stays <strong>${THUMBTACK_SHEET_LEAD_COST}</strong>{" "}
        (your default). If Thumbtack later sends what they billed, it shows in{" "}
        <strong>TT billed</strong> and does not overwrite Sheet.
        {leads.length ? ` Last inbound ${last}.` : ""}
      </p>
      <div className="bos-grid" style={{ marginBottom: "1rem" }}>
        <div className="bos-card">
          <h3>TT leads in CRM</h3>
          <div className="value">{leads.length}</div>
        </div>
        <div className="bos-card">
          <h3>Sheet cost / lead</h3>
          <div className="value">${THUMBTACK_SHEET_LEAD_COST}</div>
        </div>
        <div className="bos-card">
          <h3>Webhook</h3>
          <div className="value" style={{ fontSize: "1.05rem" }}>
            /api/webhooks/thumbtack
          </div>
        </div>
      </div>
      {!leads.length ? (
        <div className="bos-card">
          No Thumbtack leads in CRM yet. Retry a delivery in Thumbtack → Recent deliveries, or wait
          for the next lead.
        </div>
      ) : (
        <table className="bos-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Name</th>
              <th>Phone</th>
              <th>ZIP / job</th>
              <th>Sheet cost</th>
              <th>TT billed</th>
              <th>CRM</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>{when(lead.createdAt)}</td>
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
                <td>{lead.thumbtackLeadPrice || "—"}</td>
                <td>
                  <Link href="/crm" className="ads-crm-pill is-in">
                    {lead.stage || "in CRM"}
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
