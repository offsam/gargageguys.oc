"use client";

import { useRouter } from "next/navigation";
import { ADS_RANGE_OPTIONS, type AdsRangePreset } from "@/lib/ads/period";

export function AdsPeriodBar({
  preset,
  periodStart,
  periodEnd,
}: {
  preset: AdsRangePreset;
  periodStart: string;
  periodEnd: string;
}) {
  const router = useRouter();

  function go(next: { range: AdsRangePreset; from?: string; to?: string }) {
    const params = new URLSearchParams();
    params.set("range", next.range);
    if (next.range === "custom") {
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
    }
    router.push(`/ads?${params.toString()}`);
  }

  return (
    <div className="ads-period-bar">
      <div className="ads-period-presets">
        {ADS_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`ads-period-btn${preset === opt.id ? " is-active" : ""}`}
            onClick={() =>
              go({
                range: opt.id,
                from: periodStart,
                to: periodEnd,
              })
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="ads-period-custom">
          <input
            type="date"
            value={periodStart}
            aria-label="From date"
            onChange={(e) =>
              go({ range: "custom", from: e.target.value || periodStart, to: periodEnd })
            }
          />
          <span>—</span>
          <input
            type="date"
            value={periodEnd}
            aria-label="To date"
            onChange={(e) =>
              go({ range: "custom", from: periodStart, to: e.target.value || periodEnd })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
