import Link from "next/link";
import { THUMBTACK_SHEET_LEAD_COST } from "@/lib/thumbtack/parse";
import type { ThumbtackAdsLead } from "@/lib/leads/thumbtack-ingest";

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ThumbtackLeadsBoard({ leads }: { leads: ThumbtackAdsLead[] }) {
  const people = leads.filter((l) => l.eventKind === "lead" || l.inCrm);

  return (
    <div className="ads-board" style={{ marginBottom: "2rem" }}>
      <h2 style={{ marginTop: 0 }}>Thumbtack lead list</h2>
      <p className="field-muted">
        This is the same kind of list as Meta form leads: name, phone, ZIP. Thumbtack does not let us
        download their inbox with a Sync button — they <strong>push</strong> each lead to{" "}
        <code>/api/webhooks/thumbtack</code>. When a delivery succeeds, the row appears here and in CRM
        Waiting. Sheet cost stays ${THUMBTACK_SHEET_LEAD_COST}.
      </p>
      <div className="ads-lead-summary">
        <strong>{people.length}</strong> leads in this list · webhook{" "}
        <code>/api/webhooks/thumbtack</code>
      </div>
      {!leads.length ? (
        <div className="bos-card">
          No Thumbtack names yet — the webhook is live, but Thumbtack has not successfully posted a
          lead. In Thumbtack → Recent deliveries, open a failed row and Retry. A new customer also
          fills this table automatically. We cannot pull old Thumbtack leads the way we pull Meta
          forms.
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
                <td>{[lead.zip, lead.job].filter(Boolean).join(" · ") || lead.eventKind}</td>
                <td>{lead.inCrm ? `$${lead.leadCost || THUMBTACK_SHEET_LEAD_COST}` : "—"}</td>
                <td>{lead.thumbtackLeadPrice || "—"}</td>
                <td>
                  {lead.inCrm ? (
                    <Link href="/crm" className="ads-crm-pill is-in">
                      In CRM{lead.stage ? ` · ${lead.stage}` : ""}
                    </Link>
                  ) : (
                    <span className="ads-crm-pill is-out">{lead.eventKind || "webhook"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
