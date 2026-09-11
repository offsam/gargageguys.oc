"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FieldJob } from "@/lib/field/days";
import { formatTime } from "@/lib/field/days";
import { isBusyJob } from "@/lib/field/busy";
import { fieldStatusLabel } from "@/lib/field/job-status";
import {
  formatJobAddress,
  googleMapsFallbackUrl,
  mapsAppUrl,
  type GeoPoint,
} from "@/lib/field/maps";
import { FieldDayClients } from "@/components/bos/FieldDayClients";
import { FieldDayMap, type FieldMapPin } from "@/components/bos/FieldDayMap";

export type FieldDayFilter = "yesterday" | "today" | "tomorrow" | "all";
type ViewMode = "map" | "list";

export type FieldDayBucket = {
  jobs: FieldJob[];
  pins: FieldMapPin[];
  label: string;
  count: number;
};

type Props = {
  buckets: Record<FieldDayFilter, FieldDayBucket>;
  initialFilter?: FieldDayFilter;
  lastKnownTech?: GeoPoint | null;
  lastKnownTechAt?: string | null;
};

function homeStatusLabel(status: string): string {
  if (status === "en_route") return "On the way";
  if (status === "queued") return "Waiting";
  if (status === "assigned") return "Waiting";
  return fieldStatusLabel(status);
}

function serviceHint(job: FieldJob): string {
  const notes = String(job.notes || "")
    .replace(/\[BUSY\]/gi, "")
    .trim();
  if (notes) {
    const first = notes.split(/\n/)[0]?.trim();
    if (first && first.length <= 80) return first;
  }
  return "Service call";
}

function MapsNavButton({ address }: { address: string }) {
  const [href, setHref] = useState(() => googleMapsFallbackUrl(address) || mapsAppUrl(address));

  useEffect(() => {
    const next = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? mapsAppUrl(address)
      : googleMapsFallbackUrl(address) || mapsAppUrl(address);
    setHref(next);
  }, [address]);

  if (!address.trim() || !href) return null;

  return (
    <a
      className="field-next-job__nav"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open in Maps"
      onClick={(e) => e.stopPropagation()}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3.5 5.5 19.2l6.5-3.1 6.5 3.1L12 3.5Z" fill="currentColor" />
      </svg>
    </a>
  );
}

function NextJobCard({ jobs }: { jobs: FieldJob[] }) {
  const items = useMemo(
    () => jobs.filter((j) => !isBusyJob(j) && j.status !== "cancelled"),
    [jobs],
  );
  const initial = useMemo(() => {
    const idx = items.findIndex((j) => j.status !== "done");
    return idx >= 0 ? idx : 0;
  }, [items]);
  const [index, setIndex] = useState(initial);

  useEffect(() => {
    setIndex(initial);
  }, [initial, items.length]);

  if (items.length === 0) {
    return (
      <section className="field-next-job field-next-job--empty field-glass-card">
        <p className="field-next-job__eyebrow">Next Job</p>
        <strong>No jobs on the schedule</strong>
        <span className="field-muted">You’re clear for this day.</span>
      </section>
    );
  }

  const safeIndex = Math.min(index, items.length - 1);
  const job = items[safeIndex];
  const address = formatJobAddress(job.address, job.zip);
  const accent =
    job.status === "done"
      ? "ok"
      : job.status === "cancelled"
        ? "danger"
        : job.status === "en_route" || job.status === "on_site"
          ? "warn"
          : "wait";

  function step(delta: number) {
    setIndex((i) => {
      const next = i + delta;
      if (next < 0) return items.length - 1;
      if (next >= items.length) return 0;
      return next;
    });
  }

  return (
    <section className={`field-next-job field-glass-card field-next-job--${accent}`}>
      <div className="field-next-job__accent" aria-hidden />
      <Link
        href={`/field/jobs/${job.id}`}
        className="field-next-job__hit"
        aria-label={`Open job ${job.title || "details"}`}
      >
        <div className="field-next-job__head">
          <p className="field-next-job__eyebrow">Next Job</p>
          <span className="field-next-job__count">
            {safeIndex + 1} / {items.length}
          </span>
        </div>

        <div className="field-next-job__row">
          <div className="field-next-job__main">
            <div className="field-next-job__time-row">
              <strong className="field-next-job__time">
                {formatTime(job.scheduled_start) || "Anytime"}
              </strong>
              <em className={`field-status-badge field-status-badge--${job.status}`}>
                {homeStatusLabel(job.status)}
              </em>
            </div>
            <p className="field-next-job__client">{job.title || "Client"}</p>
            {address ? (
              <p className="field-next-job__addr">{address}</p>
            ) : (
              <p className="field-next-job__addr field-next-job__addr--muted">No address</p>
            )}
            <p className="field-next-job__service">{serviceHint(job)}</p>
          </div>
        </div>
      </Link>

      <div className="field-next-job__actions">
        {address ? <MapsNavButton address={address} /> : null}
        <span className="field-next-job__chevron" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {items.length > 1 ? (
        <div className="field-next-job__pager">
          <button type="button" onClick={() => step(-1)} aria-label="Previous job">
            ‹
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next job">
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}

const FILTERS: Array<{ id: FieldDayFilter; short: string }> = [
  { id: "yesterday", short: "Yesterday" },
  { id: "today", short: "Today" },
  { id: "tomorrow", short: "Tomorrow" },
  { id: "all", short: "All" },
];

export function FieldTodayHome({
  buckets,
  initialFilter = "today",
  lastKnownTech = null,
  lastKnownTechAt = null,
}: Props) {
  const [filter, setFilter] = useState<FieldDayFilter>(initialFilter);
  const [view, setView] = useState<ViewMode>("map");
  const [focusId, setFocusId] = useState<string | null>(null);

  const bucket = buckets[filter] || buckets.today;
  const jobs = bucket.jobs;
  const pins = bucket.pins;

  return (
    <div className="field-home field-home--glass">
      <NextJobCard jobs={jobs} />

      <section className="field-map-panel field-glass-card">
        <div className="field-seg field-seg--days" role="tablist" aria-label="Day filter">
          {FILTERS.map((tab) => {
            const count = buckets[tab.id]?.count ?? 0;
            const label =
              tab.id === "all" ? `All (${count})` : `${tab.short}${count ? ` (${count})` : ""}`;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={filter === tab.id ? "active" : undefined}
                onClick={() => setFilter(tab.id)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="field-seg field-seg--view" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            className={view === "map" ? "active" : undefined}
            onClick={() => setView("map")}
          >
            Map
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={view === "list" ? "active" : undefined}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>

        <p className="field-map-panel__caption">{bucket.label}</p>

        {view === "list" ? (
          <div className="field-map-panel__list">
            <FieldDayClients jobs={jobs} onHoverJob={setFocusId} />
          </div>
        ) : (
          <FieldDayMap
            pins={pins}
            focusId={focusId}
            showLegend
            showLocate
            lastKnownTech={lastKnownTech}
            lastKnownTechAt={lastKnownTechAt}
          />
        )}
      </section>
    </div>
  );
}
