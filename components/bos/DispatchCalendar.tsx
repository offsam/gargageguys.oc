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

function filterByTech(
  list: CalendarSheetEntry[],
  techFilter: string,
): CalendarSheetEntry[] {
  if (techFilter === "all") return list;
  return list.filter((e) => e.technicianId === techFilter);
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
  const [techFilter, setTechFilter] = useState("all");
  const [pending, startTransition] = useTransition();
  const [scheduleLead, setScheduleLead] = useState<DispatchQueueLead | null>(null);
  const [scheduleError, setScheduleError] = useState("");

  const selectedDate = parseDayKey(selectedDay) || startOfToday();
  const weekKeys = useMemo(() => weekDayKeys(selectedDay), [selectedDay]);
  const monthGrid = useMemo(
    () => monthCells(selectedDate.getFullYear(), selectedDate.getMonth()),
    [selectedDate],
  );

  const visibleEntries = useMemo(
    () => filterByTech(entries, techFilter),
    [entries, techFilter],
  );

  const visibleTechs = useMemo(() => {
    if (techFilter === "all") return technicians;
    return technicians.filter((t) => t.id === techFilter);
  }, [technicians, techFilter]);

  const dayEntries = useMemo(
    () => filterByTech(entriesForDay(entries, selectedDay), techFilter),
    [entries, selectedDay, techFilter],
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

  function submitSchedule(input: {
    technicianId: string;
    startAt: string;
    endAt: string;
    clientName: string;
    clientAddress: string;
    zip?: string;
  }) {
    if (!scheduleLead) return;
    setScheduleError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("leadId", scheduleLead.id);
      fd.set("technicianId", input.technicianId);
      fd.set("startAt", input.startAt);
      fd.set("endAt", input.endAt);
      fd.set("clientName", input.clientName);
      fd.set("clientAddress", input.clientAddress);
      if (input.zip) fd.set("zip", input.zip);
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

      <div className="dispatch-cal__techs" role="tablist" aria-label="Technician filter">
        <button
          type="button"
          role="tab"
          aria-selected={techFilter === "all"}
          className={techFilter === "all" ? "active" : undefined}
          onClick={() => setTechFilter("all")}
        >
          All technicians
        </button>
        {technicians.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={techFilter === t.id}
            className={techFilter === t.id ? "active" : undefined}
            onClick={() => setTechFilter(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <p className="dispatch-cal__source">
        Synced from <strong>Sheet</strong> · client names in order · filter by technician
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
              const dayList = filterByTech(entriesForDay(entries, cell.key), techFilter);
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDay;
              const isPast = cell.key < todayKey;
              const shown = dayList.slice(0, 5);
              const more = dayList.length - shown.length;
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`dispatch-cal__mcell${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${isPast ? " is-past" : ""}${dayList.length ? " has-jobs" : ""}`}
                  onClick={() => openDay(cell.key)}
                >
                  <span className="dispatch-cal__mnum">{cell.day}</span>
                  <ul className="dispatch-cal__mnames">
                    {shown.map((entry) => (
                      <li key={entry.id} title={`${entry.title} · ${entry.technicianName || "—"}`}>
                        <span className="dispatch-cal__mclient">{entry.title}</span>
                        {techFilter === "all" && entry.technicianName ? (
                          <span className="dispatch-cal__mtech">{entry.technicianName}</span>
                        ) : null}
                      </li>
                    ))}
                    {more > 0 ? <li className="dispatch-cal__mmore">+{more} more</li> : null}
                  </ul>
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
                  const names = filterByTech(entriesForDay(entries, key), techFilter);
                  return (
                    <th key={key}>
                      <button type="button" onClick={() => openDay(key)}>
                        <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                        <strong className={key === todayKey ? "is-today" : undefined}>
                          {d.getDate()}
                        </strong>
                      </button>
                      {names.length > 0 ? (
                        <ul className="dispatch-cal__week-names">
                          {names.slice(0, 4).map((entry) => (
                            <li key={entry.id}>
                              <Link
                                href={entryHref(entry)}
                                onClick={(e) => e.stopPropagation()}
                                title={`${entry.title} · ${entry.technicianName || "—"}`}
                              >
                                {entry.title}
                                {techFilter === "all" && entry.technicianName
                                  ? ` · ${entry.technicianName}`
                                  : ""}
                              </Link>
                            </li>
                          ))}
                          {names.length > 4 ? (
                            <li className="dispatch-cal__week-names-more">
                              +{names.length - 4}
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="dispatch-cal__untimed-row">
                <th scope="row">Sheet</th>
                {weekKeys.map((key) => {
                  const untimed = filterByTech(untimedEntriesForDay(entries, key), techFilter);
                  return (
                    <td
                      key={key}
                      className={untimed.length ? "has-jobs" : undefined}
                      onClick={() => openDay(key)}
                    >
                      {untimed.slice(0, 5).map((entry) => (
                        <Link
                          key={entry.id}
                          href={entryHref(entry)}
                          className={`dispatch-cal__pill ${statusClass(entry.status)}`}
                          onClick={(e) => e.stopPropagation()}
                          title={`${entry.title} · ${entry.status} · ${entry.technicianName || "—"}`}
                        >
                          <span className="dispatch-cal__pill-client">{entry.title}</span>
                          {techFilter === "all" ? (
                            <em className="dispatch-cal__pill-tech">
                              {entry.technicianName || "—"}
                            </em>
                          ) : null}
                        </Link>
                      ))}
                      {untimed.length > 5 ? (
                        <span className="dispatch-cal__more">+{untimed.length - 5}</span>
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
                    const cellEntries = filterByTech(
                      entriesForDay(entries, key).filter((e) =>
                        entryMatchesWindow(e, window.startHour),
                      ),
                      techFilter,
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
                          cellEntries.slice(0, 4).map((entry) => (
                            <Link
                              key={entry.id}
                              href={entryHref(entry)}
                              className={`dispatch-cal__pill ${statusClass(entry.status)}`}
                              onClick={(e) => e.stopPropagation()}
                              title={`${entry.title} · ${entry.status}`}
                            >
                              <span className="dispatch-cal__pill-client">{entry.title}</span>
                              {techFilter === "all" ? (
                                <em className="dispatch-cal__pill-tech">
                                  {entry.technicianName || "—"}
                                </em>
                              ) : null}
                            </Link>
                          ))
                        )}
                        {cellEntries.length > 4 ? (
                          <span className="dispatch-cal__more">+{cellEntries.length - 4}</span>
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
          <div className="dispatch-cal__day-list dispatch-cal__day-roster">
            <h3>
              {techFilter === "all"
                ? `Jobs this day (${dayEntries.length})`
                : `${visibleTechs[0]?.name || "Technician"} · ${dayEntries.length}`}
            </h3>
            {dayEntries.length === 0 ? (
              <p className="kanban-empty">No Sheet work on this day.</p>
            ) : (
              <ol className="dispatch-cal__roster">
                {dayEntries.map((entry, i) => (
                  <li key={entry.id} className={statusClass(entry.status)}>
                    <span className="dispatch-cal__roster-n">{i + 1}</span>
                    <Link href={entryHref(entry)} className="dispatch-cal__roster-client">
                      {entry.title}
                    </Link>
                    <span className="dispatch-cal__roster-tech">
                      {entry.technicianName || "Unassigned"}
                    </span>
                    <span className="dispatch-cal__roster-meta">
                      {entry.scheduled_start
                        ? formatTime(entry.scheduled_start)
                        : entry.status}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="dispatch-cal__day-table-wrap">
            <table className="dispatch-cal__day-table">
              <thead>
                <tr>
                  <th>Window</th>
                  {visibleTechs.map((t) => (
                    <th key={t.id}>{t.name}</th>
                  ))}
                  {techFilter === "all" ? <th>Unassigned</th> : null}
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
                    {visibleTechs.map((tech) => {
                      const cell = entriesForTechWindow(
                        visibleEntries,
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
                              <span className="dispatch-cal__jobcard-tech">
                                {entry.technicianName || "—"}
                              </span>
                              <span>
                                {entry.scheduled_start
                                  ? `${formatTime(entry.scheduled_start)}${
                                      entry.scheduled_end
                                        ? ` – ${formatTime(entry.scheduled_end)}`
                                        : ""
                                    }`
                                  : entry.status}
                              </span>
                            </Link>
                          ))}
                        </td>
                      );
                    })}
                    {techFilter === "all" ? (
                      <td
                        className={
                          entriesForTechWindow(entries, selectedDay, null, window.startHour)
                            .length
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
                              <span>Unassigned</span>
                            </Link>
                          ));
                        })()}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {scheduleLead ? (
        <ScheduleLeadModal
          leadName={scheduleLead.name}
          initialClientName={scheduleLead.name}
          initialAddress={scheduleLead.address}
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
