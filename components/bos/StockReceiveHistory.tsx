"use client";

import { useState } from "react";
import type { StockReceiveHistoryDay } from "@/lib/stock/receive-history";

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function destLabel(dest: "warehouse" | "tech" | "partner") {
  if (dest === "tech") return "van";
  if (dest === "partner") return "partner WH";
  return "warehouse";
}

export function StockReceiveHistory({
  days,
  isTechOnly,
}: {
  days: StockReceiveHistoryDay[];
  isTechOnly?: boolean;
}) {
  const [openDate, setOpenDate] = useState<string | null>(days[0]?.date || null);

  if (!days.length) {
    return (
      <div className="bos-card stock-history-empty">
        No receive history yet. When someone taps + / receives parts into Stock, days will show up
        here.
      </div>
    );
  }

  return (
    <div className="stock-history">
      <p className="field-muted stock-history-lead">
        {isTechOnly
          ? "Days you added parts onto the van — grouped by Pacific date."
          : "When stock was received (warehouse / van). Same-day receives are grouped together."}
      </p>
      <ul className="stock-history-list">
        {days.map((day) => {
          const open = openDate === day.date;
          return (
            <li key={day.date} className={`stock-history-day${open ? " is-open" : ""}`}>
              <button
                type="button"
                className="stock-history-day-head"
                aria-expanded={open}
                onClick={() => setOpenDate(open ? null : day.date)}
              >
                <span className="stock-history-day-chevron" aria-hidden>
                  {open ? "▾" : "▸"}
                </span>
                <span className="stock-history-day-label">{day.label}</span>
                <span className="stock-history-day-stat">+{day.totalQty}</span>
                <span className="stock-history-day-stat muted">
                  {day.lineCount} line{day.lineCount === 1 ? "" : "s"}
                </span>
              </button>
              {open ? (
                <ul className="stock-history-lines">
                  {day.lines.map((line) => (
                    <li key={line.id}>
                      <div className="stock-history-line-main">
                        <strong>+{line.qty}</strong> {line.itemName}
                      </div>
                      <div className="stock-history-line-meta">
                        {timeLabel(line.createdAt)}
                        {" · "}
                        {destLabel(line.destination)}
                        {!isTechOnly && line.destination === "tech"
                          ? ` · ${line.technicianLabel}`
                          : ""}
                        {!isTechOnly ? ` · by ${line.actorLabel}` : ""}
                        {line.note ? ` · ${line.note}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
