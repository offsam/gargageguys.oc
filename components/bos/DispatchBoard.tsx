"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { scheduleCrmLeadAction } from "@/app/actions/crm";
import { FieldDayTimeline } from "@/components/bos/FieldDayTimeline";
import { ScheduleLeadModal, type CrmTechnician } from "@/components/bos/ScheduleLeadModal";
import { formatTime, jobsForDay, type FieldJob } from "@/lib/field/days";
import { isBusyJob } from "@/lib/field/busy";
import { useBosLiveRefresh } from "@/lib/realtime/useBosLiveRefresh";

export type DispatchQueueLead = {
  id: string;
  name: string;
  phone: string;
  zip: string;
  address: string;
  message: string;
  jobStatus: string;
};

export function DispatchBoard({
  dayKey,
  technicians,
  jobs,
  queue,
}: {
  dayKey: string;
  technicians: CrmTechnician[];
  jobs: FieldJob[];
  queue: DispatchQueueLead[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scheduleLead, setScheduleLead] = useState<DispatchQueueLead | null>(null);
  const [scheduleError, setScheduleError] = useState("");

  useBosLiveRefresh(["leads", "jobs"]);

  const dayJobs = useMemo(() => jobsForDay(jobs, dayKey), [jobs, dayKey]);
  const unassigned = dayJobs.filter((j) => !j.technician_id);

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
    <div className="dispatch-board">
      <section className="dispatch-queue">
        <h2 style={{ marginTop: 0 }}>Waiting queue</h2>
        {queue.length === 0 ? (
          <p className="kanban-empty">No waiting leads</p>
        ) : (
          <div className="dispatch-queue-list">
            {queue.map((lead) => (
              <div key={lead.id} className="dispatch-queue-card">
                <div>
                  <strong>{lead.name || "Unknown"}</strong>
                  <span>
                    {[lead.phone, lead.zip || lead.address, lead.jobStatus]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {lead.message ? <em>{lead.message}</em> : null}
                </div>
                <button
                  type="button"
                  className="crm-btn-primary"
                  onClick={() => {
                    setScheduleError("");
                    setScheduleLead(lead);
                  }}
                >
                  Schedule
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Technician schedule</h2>
        <div className="dispatch-lanes">
          {technicians.map((tech) => {
            const techJobs = dayJobs.filter((j) => j.technician_id === tech.id);
            return (
              <div key={tech.id} className="dispatch-lane">
                <div className="dispatch-lane__head">
                  <h3>{tech.name}</h3>
                  <span>
                    {techJobs.length} job{techJobs.length === 1 ? "" : "s"}
                  </span>
                </div>
                {techJobs.length ? (
                  <FieldDayTimeline jobs={techJobs} />
                ) : (
                  <p className="kanban-empty">Free</p>
                )}
              </div>
            );
          })}
          {unassigned.length > 0 ? (
            <div className="dispatch-lane">
              <div className="dispatch-lane__head">
                <h3>Unassigned</h3>
                <span>{unassigned.length}</span>
              </div>
              <FieldDayTimeline jobs={unassigned} />
            </div>
          ) : null}
          {technicians.length === 0 ? (
            <p className="kanban-empty">No technicians in profiles yet.</p>
          ) : null}
        </div>
      </section>

      {dayJobs.length > 0 ? (
        <section>
          <h2>Day list</h2>
          <table className="bos-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Job</th>
                <th>Tech</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dayJobs.map((job) => {
                const busy = isBusyJob(job);
                const tech =
                  technicians.find((t) => t.id === job.technician_id)?.name || "Unassigned";
                return (
                  <tr key={job.id} className={busy ? "dispatch-row--busy" : undefined}>
                    <td>
                      {formatTime(job.scheduled_start)}
                      {job.scheduled_end ? ` – ${formatTime(job.scheduled_end)}` : ""}
                    </td>
                    <td>
                      <Link href={`/field/jobs/${job.id}`}>
                        {busy ? "Busy" : job.title}
                      </Link>
                    </td>
                    <td>{tech}</td>
                    <td>{busy ? "busy" : job.status.replace(/_/g, " ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {scheduleLead ? (
        <ScheduleLeadModal
          leadName={scheduleLead.name}
          technicians={technicians}
          jobs={jobs}
          dayKey={dayKey}
          pending={pending}
          error={scheduleError}
          onClose={() => setScheduleLead(null)}
          onSubmit={submitSchedule}
        />
      ) : null}
    </div>
  );
}
