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
        All inbound leads in CRM for {periodLabel(report.periodStart, report.periodEnd)} — not only
        completed jobs. Spend comes from Meta / Google sync and Thumbtack billed prices.{" "}
        <strong>Cost / completed</strong> = spend ÷ completed jobs (e.g. 2 of 10 → spend / 2).
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
                <th>Lost</th>
                <th>Spend</th>
                <th>Cost / lead</th>
                <th>Cost / completed</th>
                <th>Close %</th>
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
                  <td>{row.lost || "—"}</td>
                  <td>{money(row.spend)}</td>
                  <td>{money(row.cpl)}</td>
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
                <td>{totals.lost || "—"}</td>
                <td>
                  <strong>{money(totals.spend)}</strong>
                </td>
                <td>{money(totals.cpl)}</td>
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
