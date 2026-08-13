"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { parseDayKey, startOfToday, toDayKey } from "@/lib/field/days";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function FieldCalendar({
  counts,
  selectedDay,
  basePath = "/field",
}: {
  counts: Record<string, number>;
  selectedDay: string;
  basePath?: string;
}) {
  const todayKey = toDayKey(startOfToday());
  const selected = parseDayKey(selectedDay) || startOfToday();
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  useEffect(() => {
    const d = parseDayKey(selectedDay);
    if (!d) return;
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [selectedDay]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ key: string; day: number; inMonth: boolean } | null> = [];

    for (let i = 0; i < startPad; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const key = toDayKey(new Date(year, month, day));
      out.push({ key, day, inMonth: true });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shiftMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="field-cal">
      <div className="field-cal-nav">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="field-cal-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="field-cal-grid">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`e-${idx}`} className="field-cal-cell field-cal-cell--empty" />;
          const count = counts[cell.key] || 0;
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDay;
          const isPast = cell.key < todayKey;
          const hasJobs = count > 0;

          const classNames = [
            "field-cal-cell",
            isToday ? "is-today" : "",
            isSelected ? "is-selected" : "",
            hasJobs ? (isPast ? "has-jobs-past" : "has-jobs") : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Link
              key={cell.key}
              href={`${basePath}?day=${cell.key}`}
              className={classNames}
              aria-label={`${cell.key}${count ? `, ${count} jobs` : ""}`}
            >
              <span className="field-cal-num">{cell.day}</span>
              {count > 0 ? <span className="field-cal-count">{count}</span> : null}
            </Link>
          );
        })}
      </div>

      <div className="field-cal-legend">
        <span>
          <i className="field-cal-dot field-cal-dot--upcoming" /> Upcoming / today
        </span>
        <span>
          <i className="field-cal-dot field-cal-dot--past" /> Past jobs
        </span>
      </div>
    </div>
  );
}
