"use client";

import { useMemo, useState } from "react";
import { toDayKey, startOfToday, type FieldJob } from "@/lib/field/days";
import {
  SCHEDULE_WINDOWS,
  firstFreeWindow,
  slotStatusForTech,
  windowRange,
  type ScheduleWindow,
} from "@/lib/schedule/windows";

export type CrmTechnician = { id: string; name: string };

function formatWindowClock(window: ScheduleWindow) {
  const pad = (h: number) => `${h > 12 ? h - 12 : h || 12}${h >= 12 ? "pm" : "am"}`;
  return `${pad(window.startHour)} – ${pad(window.endHour)}`;
}

export function ScheduleLeadModal({
  leadName,
  technicians,
  jobs = [],
  dayKey,
  initialTechnicianId,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  leadName: string;
  technicians: CrmTechnician[];
  jobs?: FieldJob[];
  dayKey?: string;
  initialTechnicianId?: string;
  pending?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: { technicianId: string; startAt: string; endAt: string }) => void;
}) {
  const todayKey = toDayKey(startOfToday());
  const defaultTech =
    (initialTechnicianId && technicians.some((t) => t.id === initialTechnicianId)
      ? initialTechnicianId
      : "") ||
    technicians[0]?.id ||
    "";
  const defaultDay =
    dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey) ? dayKey : todayKey;

  const [technicianId, setTechnicianId] = useState(defaultTech);
  const [day, setDay] = useState(defaultDay);
  const [selectedWindowId, setSelectedWindowId] = useState(() => {
    if (!defaultTech) return "";
    return firstFreeWindow(jobs, defaultTech, defaultDay)?.id || "";
  });

  const slots = useMemo(() => {
    if (!technicianId) return [];
    return SCHEDULE_WINDOWS.map((window) => ({
      window,
      ...slotStatusForTech(jobs, technicianId, day, window),
    }));
  }, [jobs, technicianId, day]);

  const selectedWindow = useMemo(
    () => SCHEDULE_WINDOWS.find((w) => w.id === selectedWindowId) || null,
    [selectedWindowId],
  );

  const selectedTechName =
    technicians.find((t) => t.id === technicianId)?.name || "";

  const summary =
    selectedTechName && selectedWindow
      ? `${day} · ${selectedWindow.label} · ${selectedTechName}`
      : "";

  function pickTech(nextId: string) {
    setTechnicianId(nextId);
    const free = firstFreeWindow(jobs, nextId, day);
    setSelectedWindowId(free?.id || "");
  }

  function pickDay(nextDay: string) {
    setDay(nextDay);
    if (!technicianId) {
      setSelectedWindowId("");
      return;
    }
    const free = firstFreeWindow(jobs, technicianId, nextDay);
    setSelectedWindowId(free?.id || "");
  }

  function pickWindow(window: ScheduleWindow) {
    const status = slotStatusForTech(jobs, technicianId, day, window);
    if (status.status === "busy") return;
    setSelectedWindowId(window.id);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!technicianId || !selectedWindow) return;
    const range = windowRange(day, selectedWindow);
    if (!range) return;
    onSubmit({
      technicianId,
      startAt: range.startLocal,
      endAt: range.endLocal,
    });
  }

  return (
    <div className="crm-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-title">
      <button type="button" className="crm-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="crm-modal__panel crm-modal__panel--schedule">
        <div className="crm-modal__head">
          <h3 id="schedule-title">Schedule job</h3>
          <button type="button" className="crm-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="crm-modal__hint">
          Assign <strong>{leadName || "this lead"}</strong> with date, technician, and a free
          arrival window. Busy slots come from the tech&apos;s Field schedule and Sheet bookings.
        </p>
        <form className="crm-add-form" onSubmit={submit}>
          <label className="crm-span-2">
            Technician
            <select
              value={technicianId}
              onChange={(e) => pickTech(e.target.value)}
              required
            >
              <option value="">Pick technician</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-span-2">
            Date
            <input
              type="date"
              value={day}
              onChange={(e) => pickDay(e.target.value)}
              required
            />
          </label>

          <div className="crm-span-2">
            <div className="sched-slot-label">Free time windows</div>
            <div className="sched-slot-grid" role="listbox" aria-label="Arrival windows">
              {slots.map(({ window, status, job }) => {
                const selected = selectedWindowId === window.id;
                const busy = status === "busy";
                return (
                  <button
                    key={window.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={busy || !technicianId || pending}
                    className={`sched-slot${busy ? " is-busy" : " is-free"}${selected ? " is-selected" : ""}`}
                    onClick={() => pickWindow(window)}
                  >
                    <strong>{window.label}</strong>
                    <span className="sched-slot-clock">{formatWindowClock(window)}</span>
                    <span>
                      {busy
                        ? job?.title || "Booked"
                        : selected
                          ? "Selected"
                          : "Free"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {summary ? (
            <p className="crm-span-2 sched-slot-summary">
              Selected: <strong>{summary}</strong>
            </p>
          ) : null}

          {technicianId && !selectedWindow ? (
            <p className="crm-form-error crm-span-2">
              No free windows left this day for that tech — pick another date.
            </p>
          ) : null}
          {error ? <p className="crm-form-error crm-span-2">{error}</p> : null}
          <div className="crm-form-actions crm-span-2">
            <button type="button" className="crm-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="crm-btn-primary"
              disabled={pending || !technicianId || !selectedWindow}
            >
              {pending ? "Saving…" : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
