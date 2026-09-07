"use client";

import { useEffect, useState } from "react";
import type { AdsCampaignReportRow } from "@/lib/ads/campaign-report";
import {
  clearHiddenMetaCampaignIds,
  hideMetaCampaignId,
  readHiddenMetaCampaignIds,
} from "@/lib/ads/hidden-campaigns";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function AdsCampaignReportPanel({ rows }: { rows: AdsCampaignReportRow[] }) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHiddenIds(readHiddenMetaCampaignIds());
    setReady(true);
  }, []);

  if (!rows.length) return null;

  const hidden = new Set(hiddenIds);
  const visible = ready ? rows.filter((r) => !hidden.has(r.campaignId)) : rows;
  const hiddenCount = rows.length - visible.length;

  return (
    <div className="ads-board ads-campaign-report" style={{ marginBottom: "2rem" }}>
      <h2 style={{ marginTop: 0 }}>Meta campaigns</h2>
      <p className="field-muted">
        One row per Meta campaign from sync. Click <strong>×</strong> to hide a campaign you do not
        need. Hidden campaigns stay out of this list until you restore them.
      </p>
      {hiddenCount > 0 ? (
        <div className="ads-lead-summary">
          {hiddenCount} hidden ·{" "}
          <button
            type="button"
            className="ads-link-btn"
            onClick={() => {
              clearHiddenMetaCampaignIds();
              setHiddenIds([]);
            }}
          >
            Show all again
          </button>
        </div>
      ) : null}
      {!visible.length ? (
        <div className="bos-card">All Meta campaigns in this period are hidden.</div>
      ) : (
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
                <th aria-label="Hide" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
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
                  <td>
                    <button
                      type="button"
                      className="ads-hide-campaign"
                      title={`Hide ${row.campaignName}`}
                      aria-label={`Hide ${row.campaignName}`}
                      onClick={() => setHiddenIds(hideMetaCampaignId(row.campaignId))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
