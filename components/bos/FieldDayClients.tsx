"use client";

import Link from "next/link";
import type { FieldJob } from "@/lib/field/days";
import { formatTime, statusLabel } from "@/lib/field/days";
import { isBusyJob } from "@/lib/field/busy";
import { formatJobAddress } from "@/lib/field/maps";
import { FieldMapsLink } from "@/components/bos/FieldMapsLink";

type Props = {
  jobs: FieldJob[];
  onHoverJob?: (jobId: string | null) => void;
};

export function FieldDayClients({ jobs, onHoverJob }: Props) {
  if (jobs.length === 0) {
    return <div className="field-empty">No clients on this day.</div>;
  }

  return (
    <ul className="field-day-clients">
      {jobs.map((job) => {
        const busy = isBusyJob(job);
        const address = formatJobAddress(job.address, job.zip);
        return (
          <li
            key={job.id}
            className={`field-day-client field-day-client--${job.status}${busy ? " field-day-client--busy" : ""}`}
            onMouseEnter={() => onHoverJob?.(job.id)}
            onMouseLeave={() => onHoverJob?.(null)}
            onFocus={() => onHoverJob?.(job.id)}
            onBlur={() => onHoverJob?.(null)}
          >
            <Link href={`/field/jobs/${job.id}`} className="field-day-client__main">
              <span className="field-day-client__time">
                {formatTime(job.scheduled_start) || "Anytime"}
              </span>
              <strong className="field-day-client__title">
                {busy ? "Busy" : job.title || "Client"}
              </strong>
              <em className={`field-pill field-pill--${job.status}`}>{statusLabel(job.status)}</em>
            </Link>
            {busy ? (
              <span className="field-day-client__addr field-day-client__addr--muted">
                {String(job.notes || "").replace("[BUSY]", "").trim() || "Blocked for dispatcher"}
              </span>
            ) : address ? (
              <span
                className="field-day-client__addr-wrap"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <FieldMapsLink address={address} className="field-day-client__addr" />
              </span>
            ) : (
              <span className="field-day-client__addr field-day-client__addr--muted">No address</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
