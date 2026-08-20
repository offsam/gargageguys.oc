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
  jobsForDay,
  parseDayKey,
  shiftDayKey,
  startOfToday,
  toDayKey,
  weekDayKeys,
  type FieldJob,
} from "@/lib/field/days";
import { isBusyJob } from "@/lib/field/busy";
import { SCHEDULE_WINDOWS, slotStatusForTech } from "@/lib/schedule/windows";
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

function jobsOnDay(jobs: FieldJob[], dayKey: string) {
  return jobsForDay(jobs, dayKey);
}

export function DispatchCalendar({
  dayKey: initialDay,
  view: initialView = "week",
  technicians,
  jobs,
  queue = [],
}: {
  dayKey: string;
  view?: DispatchCalView;
  technicians: CrmTechnician[];
  jobs: FieldJob[];
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

  function techName(id: string | null) {
    if (!id) return "Unassigned";
    return technicians.find((t) => t.id === id)?.name || "Unassigned";
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
              const dayJobs = jobsOnDay(jobs, cell.key);
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDay;
              const techs = [
                ...new Set(dayJobs.map((j) => j.technician_id).filter(Boolean) as string[]),
              ].slice(0, 4);
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`dispatch-cal__mcell${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${dayJobs.length ? " has-jobs" : ""}`}
                  onClick={() => openDay(cell.key)}
                >
                  <span className="dispatch-cal__mnum">{cell.day}</span>
                  {dayJobs.length > 0 ? (
                    <span className="dispatch-cal__mcount">{dayJobs.length}</span>
                  ) : null}
                  <div className="dispatch-cal__mchips">
                    {techs.map((id) => (
                      <i key={id} title={techName(id)}>
                        {techShort(techName(id))}
                      </i>
                    ))}
                    {dayJobs.length > techs.length ? (
                      <i>+{dayJobs.length - techs.length}</i>
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
                  return (
                    <th key={key}>
                      <button type="button" onClick={() => openDay(key)}>
                        <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                        <strong className={key === todayKey ? "is-today" : undefined}>
                          {d.getDate()}
                        </strong>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {SCHEDULE_WINDOWS.map((window) => (
                <tr key={window.id}>
                  <th scope="row">{window.label}</th>
                  {weekKeys.map((key) => {
                    const cellJobs = jobsOnDay(jobs, key).filter((j) =>
                      j.scheduled_start
                        ? new Date(j.scheduled_start).getHours() === window.startHour &&
                          new Date(j.scheduled_start).getMinutes() === 0
                        : false,
                    );
                    return (
                      <td
                        key={key}
                        className={cellJobs.length ? "has-jobs" : undefined}
                        onClick={() => openDay(key)}
                      >
                        {cellJobs.length === 0 ? (
                          <span className="dispatch-cal__free">·</span>
                        ) : (
                          cellJobs.slice(0, 3).map((job) => (
                            <Link
                              key={job.id}
                              href={`/field/jobs/${job.id}`}
                              className="dispatch-cal__pill"
                              onClick={(e) => e.stopPropagation()}
                              title={`${job.title} · ${techName(job.technician_id)}`}
                            >
                              <strong>{techShort(techName(job.technician_id))}</strong>
                              <span>{isBusyJob(job) ? "Busy" : job.title}</span>
                            </Link>
                          ))
                        )}
                        {cellJobs.length > 3 ? (
                          <span className="dispatch-cal__more">+{cellJobs.length - 3}</span>
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
                {SCHEDULE_WINDOWS.map((window) => {
                  const dayJobs = jobsOnDay(jobs, selectedDay);
                  const unassigned = dayJobs.filter(
                    (j) =>
                      !j.technician_id &&
                      j.scheduled_start &&
                      new Date(j.scheduled_start).getHours() === window.startHour,
                  );
                  return (
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
                        const slot = slotStatusForTech(jobs, tech.id, selectedDay, window);
                        if (slot.status === "busy" && slot.job) {
                          const job = slot.job;
                          return (
                            <td key={tech.id} className="is-busy">
                              <Link href={`/field/jobs/${job.id}`} className="dispatch-cal__jobcard">
                                <strong>{isBusyJob(job) ? "Busy" : job.title}</strong>
                                <span>
                                  {formatTime(job.scheduled_start)}
                                  {job.scheduled_end ? ` – ${formatTime(job.scheduled_end)}` : ""}
                                </span>
                                <span>
                                  {[job.address, job.zip].filter(Boolean).join(", ") || "No address"}
                                </span>
                                <em>{job.status.replace(/_/g, " ")}</em>
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
                      <td className={unassigned.length ? "is-busy" : "is-free"}>
                        {unassigned.length === 0
                          ? "—"
                          : unassigned.map((job) => (
                              <Link
                                key={job.id}
                                href={`/field/jobs/${job.id}`}
                                className="dispatch-cal__jobcard"
                              >
                                <strong>{job.title}</strong>
                                <span>{formatTime(job.scheduled_start)}</span>
                              </Link>
                            ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {jobsOnDay(jobs, selectedDay).length > 0 ? (
            <div className="dispatch-cal__day-list">
              <h3>All jobs this day</h3>
              <table className="bos-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Job</th>
                    <th>Tech</th>
                    <th>Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsOnDay(jobs, selectedDay).map((job) => {
                    const busy = isBusyJob(job);
                    return (
                      <tr key={job.id}>
                        <td>
                          {formatTime(job.scheduled_start)}
                          {job.scheduled_end ? ` – ${formatTime(job.scheduled_end)}` : ""}
                        </td>
                        <td>
                          <Link href={`/field/jobs/${job.id}`}>
                            {busy ? "Busy" : job.title}
                          </Link>
                        </td>
                        <td>{techName(job.technician_id)}</td>
                        <td>{[job.address, job.zip].filter(Boolean).join(", ") || "—"}</td>
                        <td>{busy ? "busy" : job.status.replace(/_/g, " ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="kanban-empty">No jobs on this day.</p>
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
