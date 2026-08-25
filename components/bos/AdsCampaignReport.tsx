import type { AdsCampaignReportRow } from "@/lib/ads/campaign-report";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function AdsCampaignReportPanel({ rows }: { rows: AdsCampaignReportRow[] }) {
  if (!rows.length) return null;

  return (
    <div className="ads-board ads-campaign-report" style={{ marginBottom: "2rem" }}>
      <h2 style={{ marginTop: 0 }}>Meta campaigns</h2>
      <p className="field-muted">
        One row per Meta campaign from sync. <strong>Lead cost</strong> is Meta CPL for that
        campaign. New campaigns appear here automatically after the next Meta sync.
      </p>
      <div className="bos-table-wrap">
        <table className="bos-table ads-report-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Received</th>
              <th>Completed</th>
              <th>Cancelled</th>
              <th>No win</th>
              <th>Spend</th>
              <th>Lead cost</th>
              <th>Burned</th>
              <th>Cost / completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.campaignId}>
                <td>
                  <strong>{row.campaignName}</strong>
                </td>
                <td>{row.received || "—"}</td>
                <td>{row.completed || "—"}</td>
                <td>{row.cancelled || "—"}</td>
                <td>{row.noWin || "—"}</td>
                <td>{money(row.spend)}</td>
                <td>{money(row.leadCost)}</td>
                <td>{money(row.leadCostBurned)}</td>
                <td>{money(row.costPerCompleted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
