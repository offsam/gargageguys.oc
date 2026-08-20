"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  parseDayKey,
  startOfToday,
  toDayKey,
  type FieldJob,
} from "@/lib/field/days";
import { SCHEDULE_WINDOWS, slotStatusForTech } from "@/lib/schedule/windows";
import {
  entriesForDay,
  untimedEntriesForDay,
  type CalendarSheetEntry,
} from "@/lib/schedule/sheet-entries";
import { useBosLiveRefresh } from "@/lib/realtime/useBosLiveRefresh";

export type ScheduleTech = { id: string; name: string };

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out: Array<{ key: string; day: number } | null> = [];
  for (let i = 0; i < startPad; i++) out.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    out.push({ key: toDayKey(new Date(year, month, day)), day });
  }
  while (out.length % 7 !== 0) out.push(null);
  return out;
}

function entryHref(entry: CalendarSheetEntry) {
  if (entry.jobId) return `/field/jobs/${entry.jobId}`;
  return `/crm`;
}

export function ScheduleMonthBoard({
  technicians,
  jobs,
  entries,
  initialDay,
  initialTech = "all",
}: {
  technicians: ScheduleTech[];
  jobs: FieldJob[];
  entries: CalendarSheetEntry[];
  initialDay: string;
  initialTech?: string;
}) {
  useBosLiveRefresh(["leads", "jobs"]);
  const todayKey = toDayKey(startOfToday());
  const initial = parseDayKey(initialDay) || startOfToday();
  const [cursor, setCursor] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [techFilter, setTechFilter] = useState(initialTech);

  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayHeading = useMemo(() => {
    const d = parseDayKey(selectedDay);
    if (!d) return selectedDay;
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [selectedDay]);

  const visibleTechs = useMemo(() => {
    if (techFilter === "all") return technicians;
    return technicians.filter((t) => t.id === techFilter);
  }, [technicians, techFilter]);

  const daySheetEntries = useMemo(() => {
    const list = entriesForDay(entries, selectedDay);
    if (techFilter === "all") return list;
    return list.filter((e) => e.technicianId === techFilter);
  }, [entries, selectedDay, techFilter]);

  const untimed = useMemo(
    () => untimedEntriesForDay(entries, selectedDay, techFilter === "all" ? "all" : techFilter),
    [entries, selectedDay, techFilter],
  );

  function shiftMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="sched-board">
      <p className="sched-source">
        Synced from <strong>Sheet</strong> by work date — past Completed stay visible.
      </p>
      <div className="sched-filters">
        <button
          type="button"
          className={techFilter === "all" ? "active" : undefined}
          onClick={() => setTechFilter("all")}
        >
          All technicians
        </button>
        {technicians.map((t) => (
          <button
            key={t.id}
            type="button"
            className={techFilter === t.id ? "active" : undefined}
            onClick={() => setTechFilter(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="sched-layout">
        <section className="sched-month bos-card">
          <div className="sched-month-nav">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="sched-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="sched-month-grid">
            {cells.map((cell, idx) => {
              if (!cell) {
                return <div key={`e-${idx}`} className="sched-day-cell is-empty" />;
              }
              const count = entriesForDay(entries, cell.key).filter((e) =>
                techFilter === "all" ? true : e.technicianId === techFilter,
              ).length;
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDay;
              const isPast = cell.key < todayKey;
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`sched-day-cell${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${isPast ? " is-past" : ""}${count ? " has-jobs" : ""}`}
                  onClick={() => setSelectedDay(cell.key)}
                >
                  <span className="sched-day-num">{cell.day}</span>
                  {count > 0 ? <span className="sched-day-count">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="sched-day-panel bos-card">
          <div className="sched-day-head">
            <div>
              <h2>{dayHeading}</h2>
              <p>
                {techFilter === "all"
                  ? "All technicians · Sheet date + arrival windows"
                  : `${visibleTechs[0]?.name || "Technician"} · synced with Sheet`}
              </p>
            </div>
            {selectedDay !== todayKey ? (
              <button type="button" className="crm-btn-secondary" onClick={() => setSelectedDay(todayKey)}>
                Jump to today
              </button>
            ) : null}
          </div>

          {daySheetEntries.length > 0 ? (
            <div className="sched-sheet-list">
              <h3>On Sheet this day ({daySheetEntries.length})</h3>
              <ul>
                {daySheetEntries.map((entry) => (
                  <li key={entry.id}>
                    <Link href={entryHref(entry)}>
                      <strong>{entry.title}</strong>
                      <span>{entry.status}</span>
                      {entry.technicianName ? <em>{entry.technicianName}</em> : null}
                      {entry.scheduled_start ? <em>timed</em> : untimed.some((u) => u.id === entry.id) ? <em>date only</em> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="kanban-empty">No Sheet work on this day.</p>
          )}

          {visibleTechs.length === 0 ? (
            <p className="kanban-empty">No technicians yet.</p>
          ) : (
            <div className="sched-day-table-wrap">
              <table className="sched-day-table">
                <thead>
                  <tr>
                    <th>Window</th>
                    {visibleTechs.map((t) => (
                      <th key={t.id}>{t.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE_WINDOWS.map((window) => (
                    <tr key={window.id}>
                      <th scope="row">{window.label}</th>
                      {visibleTechs.map((tech) => {
                        const slot = slotStatusForTech(jobs, tech.id, selectedDay, window);
                        if (slot.status === "busy" && slot.job) {
                          return (
                            <td key={tech.id} className="is-busy">
                              <Link href={`/field/jobs/${slot.job.id}`}>
                                {slot.job.title || "Booked"}
                              </Link>
                            </td>
                          );
                        }
                        return (
                          <td key={tech.id} className="is-free">
                            Free
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
