"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleCrmLeadAction } from "@/app/actions/crm";
import { ScheduleLeadModal, type CrmTechnician } from "@/components/bos/ScheduleLeadModal";
import {
  formatDayHeading,
  formatMonthHeading,
  formatTime,
  formatWeekHeading,
  parseDayKey,
  shiftDayKey,
  startOfToday,
  toDayKey,
  weekDayKeys,
  type FieldJob,
} from "@/lib/field/days";
import { SCHEDULE_WINDOWS } from "@/lib/schedule/windows";
import {
  entriesForDay,
  entriesForTechWindow,
  entryMatchesWindow,
  untimedEntriesForDay,
  type CalendarSheetEntry,
} from "@/lib/schedule/sheet-entries";
import { useBosLiveRefresh } from "@/lib/realtime/useBosLiveRefresh";
import type { DispatchQueueLead } from "@/components/bos/DispatchBoard";

export type DispatchCalView = "month" | "week" | "day";

function techShort(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

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

function statusClass(status: string) {
  if (status === "Completed") return "is-done";
  if (status === "Cancelled" || status === "No-show") return "is-cancelled";
  return "is-active";
}

export function DispatchCalendar({
  dayKey: initialDay,
  view: initialView = "week",
  technicians,
  jobs,
  entries,
  queue = [],
}: {
  dayKey: string;
  view?: DispatchCalView;
  technicians: CrmTechnician[];
  jobs: FieldJob[];
  entries: CalendarSheetEntry[];
  queue?: DispatchQueueLead[];
}) {
  const router = useRouter();
  useBosLiveRefresh(["leads", "jobs"]);
  const todayKey = toDayKey(startOfToday());
  const [view, setView] = useState<DispatchCalView>(initialView);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [pending, startTransition] = useTransition();
  const [scheduleLead, setScheduleLead] = useState<DispatchQueueLead | null>(null);
  const [scheduleError, setScheduleError] = useState("");

  const selectedDate = parseDayKey(selectedDay) || startOfToday();
  const weekKeys = useMemo(() => weekDayKeys(selectedDay), [selectedDay]);
  const monthGrid = useMemo(
    () => monthCells(selectedDate.getFullYear(), selectedDate.getMonth()),
    [selectedDate],
  );

  const heading =
    view === "month"
      ? formatMonthHeading(selectedDay)
      : view === "week"
        ? formatWeekHeading(selectedDay)
        : formatDayHeading(selectedDay);

  function go(delta: number) {
    if (view === "month") {
      const d = parseDayKey(selectedDay) || startOfToday();
      d.setMonth(d.getMonth() + delta, 1);
      setSelectedDay(toDayKey(d));
      return;
    }
    if (view === "week") {
      setSelectedDay(shiftDayKey(selectedDay, delta * 7));
      return;
    }
    setSelectedDay(shiftDayKey(selectedDay, delta));
  }

  function openDay(day: string) {
    setSelectedDay(day);
    setView("day");
  }

  function submitSchedule(input: { technicianId: string; startAt: string; endAt: string }) {
    if (!scheduleLead) return;
    setScheduleError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("leadId", scheduleLead.id);
      fd.set("technicianId", input.technicianId);
      fd.set("startAt", input.startAt);
      fd.set("endAt", input.endAt);
      const result = await scheduleCrmLeadAction(fd);
      if (!result.ok) {
        setScheduleError(result.error || "Could not schedule");
        return;
      }
      setScheduleLead(null);
      router.refresh();
    });
  }

  return (
    <div className="dispatch-cal">
      <div className="dispatch-cal__toolbar">
        <div className="dispatch-cal__views" role="tablist" aria-label="Calendar view">
          {(
            [
              ["month", "Month"],
              ["week", "Week"],
              ["day", "Day"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? "active" : undefined}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="dispatch-cal__nav">
          <button type="button" onClick={() => go(-1)} aria-label="Previous">
            ‹
          </button>
          <strong>{heading}</strong>
          <button type="button" onClick={() => go(1)} aria-label="Next">
            ›
          </button>
          {selectedDay !== todayKey ? (
            <button type="button" className="dispatch-cal__today" onClick={() => setSelectedDay(todayKey)}>
              Today
            </button>
          ) : null}
        </div>
      </div>

      <p className="dispatch-cal__source">
        Synced from <strong>Sheet</strong> by work date — past Completed jobs stay on the calendar.
      </p>

      {queue.length > 0 ? (
        <div className="dispatch-cal__queue">
          <span className="dispatch-cal__queue-label">Waiting</span>
          <div className="dispatch-cal__queue-list">
            {queue.map((lead) => (
              <button
                key={lead.id}
                type="button"
                className="dispatch-cal__queue-chip"
                onClick={() => {
                  setScheduleError("");
                  setScheduleLead(lead);
                }}
              >
                {lead.name || "Lead"}
                <em>Schedule</em>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === "month" ? (
        <div className="dispatch-cal__month">
          <div className="dispatch-cal__weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="dispatch-cal__month-grid">
            {monthGrid.map((cell, idx) => {
              if (!cell) return <div key={`e-${idx}`} className="dispatch-cal__mcell is-empty" />;
              const dayEntries = entriesForDay(entries, cell.key);
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDay;
              const isPast = cell.key < todayKey;
              const techs = [
                ...new Set(
                  dayEntries
                    .map((e) => e.technicianName)
                    .filter(Boolean),
                ),
              ].slice(0, 4);
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`dispatch-cal__mcell${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${isPast ? " is-past" : ""}${dayEntries.length ? " has-jobs" : ""}`}
                  onClick={() => openDay(cell.key)}
                >
                  <span className="dispatch-cal__mnum">{cell.day}</span>
                  {dayEntries.length > 0 ? (
                    <span className="dispatch-cal__mcount">{dayEntries.length}</span>
                  ) : null}
                  <div className="dispatch-cal__mchips">
                    {techs.map((name) => (
                      <i key={name} title={name}>
                        {techShort(name)}
                      </i>
                    ))}
                    {dayEntries.length > techs.length ? (
                      <i>+{dayEntries.length - techs.length}</i>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "week" ? (
        <div className="dispatch-cal__week-wrap">
          <table className="dispatch-cal__week">
            <thead>
              <tr>
                <th>Time</th>
                {weekKeys.map((key) => {
                  const d = parseDayKey(key)!;
                  const dayCount = entriesForDay(entries, key).length;
                  return (
                    <th key={key}>
                      <button type="button" onClick={() => openDay(key)}>
                        <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                        <strong className={key === todayKey ? "is-today" : undefined}>
                          {d.getDate()}
                        </strong>
                        {dayCount > 0 ? <em>{dayCount}</em> : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="dispatch-cal__untimed-row">
                <th scope="row">Sheet</th>
                {weekKeys.map((key) => {
                  const untimed = untimedEntriesForDay(entries, key);
                  return (
                    <td
                      key={key}
                      className={untimed.length ? "has-jobs" : undefined}
                      onClick={() => openDay(key)}
                    >
                      {untimed.slice(0, 4).map((entry) => (
                        <Link
                          key={entry.id}
                          href={entryHref(entry)}
                          className={`dispatch-cal__pill ${statusClass(entry.status)}`}
                          onClick={(e) => e.stopPropagation()}
                          title={`${entry.title} · ${entry.status} · ${entry.technicianName || "—"}`}
                        >
                          <strong>
                            {entry.technicianName
                              ? techShort(entry.technicianName)
                              : "?"}
                          </strong>
                          <span>{entry.title}</span>
                        </Link>
                      ))}
                      {untimed.length > 4 ? (
                        <span className="dispatch-cal__more">+{untimed.length - 4}</span>
                      ) : null}
                      {untimed.length === 0 ? (
                        <span className="dispatch-cal__free">·</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
              {SCHEDULE_WINDOWS.map((window) => (
                <tr key={window.id}>
                  <th scope="row">{window.label}</th>
                  {weekKeys.map((key) => {
                    const cellEntries = entriesForDay(entries, key).filter((e) =>
                      entryMatchesWindow(e, window.startHour),
                    );
                    return (
                      <td
                        key={key}
                        className={cellEntries.length ? "has-jobs" : undefined}
                        onClick={() => openDay(key)}
                      >
                        {cellEntries.length === 0 ? (
                          <span className="dispatch-cal__free">·</span>
                        ) : (
                          cellEntries.slice(0, 3).map((entry) => (
                            <Link
                              key={entry.id}
                              href={entryHref(entry)}
                              className={`dispatch-cal__pill ${statusClass(entry.status)}`}
                              onClick={(e) => e.stopPropagation()}
                              title={`${entry.title} · ${entry.status}`}
                            >
                              <strong>
                                {entry.technicianName
                                  ? techShort(entry.technicianName)
                                  : "?"}
                              </strong>
                              <span>{entry.title}</span>
                            </Link>
                          ))
                        )}
                        {cellEntries.length > 3 ? (
                          <span className="dispatch-cal__more">+{cellEntries.length - 3}</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {view === "day" ? (
        <div className="dispatch-cal__day">
          <div className="dispatch-cal__day-table-wrap">
            <table className="dispatch-cal__day-table">
              <thead>
                <tr>
                  <th>Window</th>
                  {technicians.map((t) => (
                    <th key={t.id}>{t.name}</th>
                  ))}
                  <th>Unassigned</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE_WINDOWS.map((window) => (
                  <tr key={window.id}>
                    <th scope="row">
                      <div className="dispatch-cal__win">
                        <strong>{window.label}</strong>
                        <span>
                          {window.startHour}:00–{window.endHour}:00
                        </span>
                      </div>
                    </th>
                    {technicians.map((tech) => {
                      const cell = entriesForTechWindow(
                        entries,
                        selectedDay,
                        tech.id,
                        window.startHour,
                      );
                      if (!cell.length) {
                        return (
                          <td key={tech.id} className="is-free">
                            Free
                          </td>
                        );
                      }
                      return (
                        <td key={tech.id} className="is-busy">
                          {cell.map((entry) => (
                            <Link
                              key={entry.id}
                              href={entryHref(entry)}
                              className={`dispatch-cal__jobcard ${statusClass(entry.status)}`}
                            >
                              <strong>{entry.title}</strong>
                              <span>
                                {entry.scheduled_start
                                  ? `${formatTime(entry.scheduled_start)}${
                                      entry.scheduled_end
                                        ? ` – ${formatTime(entry.scheduled_end)}`
                                        : ""
                                    }`
                                  : entry.status}
                              </span>
                              <span>
                                {[entry.address, entry.zip].filter(Boolean).join(", ") ||
                                  entry.service ||
                                  "—"}
                              </span>
                              <em>{entry.status}</em>
                            </Link>
                          ))}
                        </td>
                      );
                    })}
                    <td
                      className={
                        entriesForTechWindow(entries, selectedDay, null, window.startHour).length
                          ? "is-busy"
                          : "is-free"
                      }
                    >
                      {(() => {
                        const unassigned = entriesForTechWindow(
                          entries,
                          selectedDay,
                          null,
                          window.startHour,
                        );
                        if (!unassigned.length) return "—";
                        return unassigned.map((entry) => (
                          <Link
                            key={entry.id}
                            href={entryHref(entry)}
                            className="dispatch-cal__jobcard"
                          >
                            <strong>{entry.title}</strong>
                            <span>{entry.status}</span>
                          </Link>
                        ));
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {untimedEntriesForDay(entries, selectedDay).length > 0 ? (
            <div className="dispatch-cal__day-list">
              <h3>Sheet rows this day (no timed window)</h3>
              <table className="bos-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Tech</th>
                    <th>Status</th>
                    <th>Service</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {untimedEntriesForDay(entries, selectedDay).map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <Link href={entryHref(entry)}>{entry.title}</Link>
                      </td>
                      <td>{entry.technicianName || "—"}</td>
                      <td>{entry.status}</td>
                      <td>{entry.service || "—"}</td>
                      <td>{[entry.address, entry.zip].filter(Boolean).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {entriesForDay(entries, selectedDay).length > 0 ? (
            <div className="dispatch-cal__day-list">
              <h3>All Sheet work this day</h3>
              <table className="bos-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Client</th>
                    <th>Tech</th>
                    <th>Status</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {entriesForDay(entries, selectedDay).map((entry) => (
                    <tr key={entry.id} className={statusClass(entry.status)}>
                      <td>
                        {entry.scheduled_start
                          ? `${formatTime(entry.scheduled_start)}${
                              entry.scheduled_end ? ` – ${formatTime(entry.scheduled_end)}` : ""
                            }`
                          : "—"}
                      </td>
                      <td>
                        <Link href={entryHref(entry)}>{entry.title}</Link>
                      </td>
                      <td>{entry.technicianName || "—"}</td>
                      <td>{entry.status}</td>
                      <td>{[entry.address, entry.zip].filter(Boolean).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="kanban-empty">No Sheet work on this day.</p>
          )}
        </div>
      ) : null}

      {scheduleLead ? (
        <ScheduleLeadModal
          leadName={scheduleLead.name}
          technicians={technicians}
          jobs={jobs}
          dayKey={selectedDay}
          pending={pending}
          error={scheduleError}
          onClose={() => setScheduleLead(null)}
          onSubmit={submitSchedule}
        />
      ) : null}
    </div>
  );
}
