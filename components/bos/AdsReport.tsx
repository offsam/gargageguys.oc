import type { AdsReport } from "@/lib/ads/report";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n}%`;
}

function periodLabel(start: string, end: string) {
  const fmt = (raw: string) => {
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function AdsReportPanel({ report }: { report: AdsReport }) {
  const { rows, totals } = report;

  return (
    <div className="ads-board ads-report" style={{ marginBottom: "2rem" }}>
      <h2 style={{ marginTop: 0 }}>Ads report</h2>
      <p className="field-muted">
        All inbound leads for {periodLabel(report.periodStart, report.periodEnd)} — every status
        counts. <strong>Lead cost</strong> = Meta / Google CPL from sync (same as the Ads panel, e.g.
        $16) — not spend ÷ CRM rows. <strong>Cost / completed</strong> = ad spend ÷ only Completed
        jobs in your funnel (real cost of a closed job). <strong>Burned</strong> = lead cost ×
        (Cancelled + No win + No-show).
      </p>

      {!rows.length ? (
        <div className="bos-card">
          No leads in this period yet. When webhooks or forms create CRM rows, they appear here with
          funnel counts.
        </div>
      ) : (
        <div className="bos-table-wrap">
          <table className="bos-table ads-report-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Received</th>
                <th>Waiting</th>
                <th>In progress</th>
                <th>Estimate</th>
                <th>Completed</th>
                <th>Cancelled</th>
                <th>No win</th>
                <th>No-show</th>
                <th>Spend</th>
                <th>Lead cost</th>
                <th>Burned</th>
                <th>Cost / completed</th>
                <th>Win %</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source}>
                  <td>
                    <strong>{row.source}</strong>
                  </td>
                  <td>{row.received}</td>
                  <td>{row.waiting || "—"}</td>
                  <td>{row.active || "—"}</td>
                  <td>{row.estimate || "—"}</td>
                  <td>{row.completed || "—"}</td>
                  <td>{row.cancelled || "—"}</td>
                  <td>{row.noWin || "—"}</td>
                  <td>{row.noShow || "—"}</td>
                  <td>{money(row.spend)}</td>
                  <td>{money(row.leadCost)}</td>
                  <td>{money(row.leadCostBurned)}</td>
                  <td>{money(row.costPerCompleted)}</td>
                  <td>{pct(row.conversionPct)}</td>
                  <td>{money(row.revenue)}</td>
                </tr>
              ))}
              <tr className="ads-report-total">
                <td>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{totals.received}</strong>
                </td>
                <td>{totals.waiting || "—"}</td>
                <td>{totals.active || "—"}</td>
                <td>{totals.estimate || "—"}</td>
                <td>{totals.completed || "—"}</td>
                <td>{totals.cancelled || "—"}</td>
                <td>{totals.noWin || "—"}</td>
                <td>{totals.noShow || "—"}</td>
                <td>
                  <strong>{money(totals.spend)}</strong>
                </td>
                <td>—</td>
                <td>{money(totals.leadCostBurned)}</td>
                <td>{money(totals.costPerCompleted)}</td>
                <td>{pct(totals.conversionPct)}</td>
                <td>{money(totals.revenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
