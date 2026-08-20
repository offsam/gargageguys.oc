import Link from "next/link";
import type { FieldJob } from "@/lib/field/days";
import { formatTime, statusLabel } from "@/lib/field/days";
import { isBusyJob } from "@/lib/field/busy";

const DEFAULT_DURATION_MS = 60 * 60 * 1000;
const MIN_SLOT_PX = 52;
const PACKED_SLOT_PX = 72;

type Timed = { job: FieldJob; startMs: number; endMs: number };
type LaidOut = Timed & { top: number; height: number; col: number; cols: number };

function jobWindow(job: FieldJob): { startMs: number; endMs: number } | null {
  if (!job.scheduled_start) return null;
  const startMs = new Date(job.scheduled_start).getTime();
  if (Number.isNaN(startMs)) return null;
  const endRaw = job.scheduled_end ? new Date(job.scheduled_end).getTime() : NaN;
  const endMs =
    Number.isFinite(endRaw) && endRaw > startMs ? endRaw : startMs + DEFAULT_DURATION_MS;
  return { startMs, endMs };
}

function layoutColumns(items: Timed[]): Array<Timed & { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const colById = new Map<string, number>();
  const active: Array<{ id: string; endMs: number; col: number }> = [];

  for (const item of sorted) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMs <= item.startMs) active.splice(i, 1);
    }
    const used = new Set(active.map((a) => a.col));
    let col = 0;
    while (used.has(col)) col += 1;
    colById.set(item.job.id, col);
    active.push({ id: item.job.id, endMs: item.endMs, col });
  }

  return sorted.map((item) => {
    const overlapping = sorted.filter(
      (other) => other.startMs < item.endMs && other.endMs > item.startMs,
    );
    const cols = Math.max(...overlapping.map((o) => colById.get(o.job.id) || 0)) + 1;
    return { ...item, col: colById.get(item.job.id) || 0, cols };
  });
}

function snapHourFloor(ms: number): number {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function snapHourCeil(ms: number): number {
  const d = new Date(ms);
  if (d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
    return d.getTime();
  }
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.getTime();
}

export function FieldDayTimeline({ jobs }: { jobs: FieldJob[] }) {
  const timed: Timed[] = [];
  const untimed: FieldJob[] = [];
  for (const job of jobs) {
    const w = jobWindow(job);
    if (w) timed.push({ job, ...w });
    else untimed.push(job);
  }

  if (timed.length === 0 && untimed.length === 0) {
    return <div className="field-empty">No clients on this day.</div>;
  }

  if (timed.length === 0) {
    return (
      <div className="field-timeline field-timeline--compact">
        <div className="field-timeline-untimed">
          {untimed.map((job) => (
            <Link key={job.id} href={`/field/jobs/${job.id}`} className="field-tl-block">
              <strong>{job.title}</strong>
              <span>{[job.address, job.zip].filter(Boolean).join(" · ") || "No address"}</span>
              <em className={`field-pill field-pill--${job.status}`}>{statusLabel(job.status)}</em>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const padMs = 30 * 60 * 1000;
  const rangeStart = snapHourFloor(Math.min(...timed.map((t) => t.startMs)) - padMs);
  const rangeEnd = snapHourCeil(Math.max(...timed.map((t) => t.endMs)) + padMs);
  const rangeMs = Math.max(rangeEnd - rangeStart, DEFAULT_DURATION_MS);
  const hours = rangeMs / (60 * 60 * 1000);
  const packed = timed.length >= 4 || hours >= 8;
  const pxPerHour = packed ? PACKED_SLOT_PX : MIN_SLOT_PX;
  const trackHeight = Math.max(hours * pxPerHour, timed.length * (MIN_SLOT_PX + 8));

  const laid: LaidOut[] = layoutColumns(timed).map((item) => ({
    ...item,
    top: ((item.startMs - rangeStart) / rangeMs) * trackHeight,
    height: Math.max(((item.endMs - item.startMs) / rangeMs) * trackHeight, MIN_SLOT_PX * 0.85),
  }));

  const hourMarks: number[] = [];
  for (let t = rangeStart; t <= rangeEnd; t += 60 * 60 * 1000) hourMarks.push(t);

  return (
    <div
      className={`field-timeline${packed ? " field-timeline--packed" : " field-timeline--compact"}`}
    >
      <div className="field-timeline-track" style={{ height: trackHeight }}>
        <div className="field-timeline-hours" aria-hidden>
          {hourMarks.map((t) => (
            <div
              key={t}
              className="field-timeline-hour"
              style={{ top: ((t - rangeStart) / rangeMs) * trackHeight }}
            >
              <span>
                {new Date(t).toLocaleTimeString("en-US", {
                  timeZone: "America/Los_Angeles",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>

        <div className="field-timeline-canvas">
          {hourMarks.map((t) => (
            <div
              key={`line-${t}`}
              className="field-timeline-line"
              style={{ top: ((t - rangeStart) / rangeMs) * trackHeight }}
            />
          ))}

          {laid.map((item) => {
            const widthPct = 100 / item.cols;
            const leftPct = item.col * widthPct;
            const busy = isBusyJob(item.job);
            return (
              <Link
                key={item.job.id}
                href={`/field/jobs/${item.job.id}`}
                className={`field-tl-block field-tl-block--${item.job.status}${busy ? " field-tl-block--busy" : ""}`}
                style={{
                  top: item.top,
                  height: item.height,
                  left: `calc(${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
              >
                <span className="field-tl-time">{formatTime(item.job.scheduled_start)}</span>
                <strong>{busy ? "Busy" : item.job.title}</strong>
                <span className="field-tl-addr">
                  {busy
                    ? String(item.job.notes || "").replace("[BUSY]", "").trim() || "Blocked for dispatcher"
                    : [item.job.address, item.job.zip].filter(Boolean).join(" · ") || "No address"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {untimed.length > 0 ? (
        <div className="field-timeline-untimed">
          <p>Anytime</p>
          {untimed.map((job) => (
            <Link key={job.id} href={`/field/jobs/${job.id}`} className="field-tl-block">
              <strong>{job.title}</strong>
              <span>{[job.address, job.zip].filter(Boolean).join(" · ") || "No address"}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
