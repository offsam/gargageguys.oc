"use client";

import { useState } from "react";
import { defaultScheduleStart } from "@/lib/datetime";

export type CrmTechnician = { id: string; name: string };

export function ScheduleLeadModal({
  leadName,
  technicians,
  dayKey,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  leadName: string;
  technicians: CrmTechnician[];
  dayKey?: string;
  pending?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: { technicianId: string; startAt: string; endAt: string }) => void;
}) {
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id || "");
  const [startAt, setStartAt] = useState(() => defaultScheduleStart(dayKey));
  const [endAt, setEndAt] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ technicianId, startAt, endAt });
  }

  return (
    <div className="crm-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-title">
      <button type="button" className="crm-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="crm-modal__panel crm-modal__panel--narrow">
        <div className="crm-modal__head">
          <h3 id="schedule-title">Schedule job</h3>
          <button type="button" className="crm-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="crm-modal__hint">
          Time and technician are required to move <strong>{leadName || "this lead"}</strong> to
          Scheduled.
        </p>
        <form className="crm-add-form" onSubmit={submit}>
          <label className="crm-span-2">
            Technician
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
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
          <label>
            Start
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </label>
          <label>
            End (optional)
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
          {error ? <p className="crm-form-error crm-span-2">{error}</p> : null}
          <div className="crm-form-actions crm-span-2">
            <button type="button" className="crm-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="crm-btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
