import Link from "next/link";
import { BosShell } from "@/components/bos/BosShell";
import { FieldDayBoard } from "@/components/bos/FieldDayBoard";
import { FieldScheduleFab } from "@/components/bos/FieldScheduleFab";
import { FieldShell } from "@/components/bos/FieldShell";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFieldAttentionCount } from "@/lib/field/load-attention";
import {
  formatDayHeading,
  jobsForDay,
  parseDayKey,
  startOfToday,
  toDayKey,
  type FieldJob,
} from "@/lib/field/days";
import { isBusyJob } from "@/lib/field/busy";
import { geocodeMany } from "@/lib/field/geocode";
import { formatJobAddress } from "@/lib/field/maps";
import type { FieldMapPin } from "@/components/bos/FieldDayMap";
import { ensureTechFieldJobsFromSheet } from "@/lib/sheet/sync-job-from-sheet";

export default async function FieldPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireRouteAccess("/field");

  const params = await searchParams;
  const todayKey = toDayKey(startOfToday());
  const selectedDay = params.day && parseDayKey(params.day) ? params.day : todayKey;

  const supabase = await createSupabaseServerClient();

  if (user.role === "technician") {
    try {
      await ensureTechFieldJobsFromSheet({
        technicianId: user.id,
        technicianName: user.fullName || user.email || "",
      });
    } catch (err) {
      console.error("[field] sheet→job backfill", err);
    }
  }

  let query = supabase
    .from("jobs")
    .select("*")
    .not("scheduled_start", "is", null)
    .order("scheduled_start", { ascending: false });
  if (user.role === "technician") {
    query = query.eq("technician_id", user.id);
  }
  const { data: jobsRaw } = await query.limit(800);
  const jobs = (jobsRaw || []) as FieldJob[];

  const dayJobs = jobsForDay(jobs, selectedDay);
  const open = dayJobs.filter((j) => j.status !== "done");
  const done = dayJobs.filter((j) => j.status === "done");
  const isToday = selectedDay === todayKey;
  const heading = isToday ? "Today" : formatDayHeading(selectedDay);
  const attentionCount =
    user.role === "technician" ? await getFieldAttentionCount(user.id) : 0;

  const geocodeQueries = dayJobs
    .filter((j) => !isBusyJob(j))
    .map((j) => {
      const text = formatJobAddress(j.address, j.zip);
      return text ? { id: j.id, text } : null;
    })
    .filter((row): row is { id: string; text: string } => Boolean(row));

  const points = await geocodeMany(geocodeQueries);
  const pins: FieldMapPin[] = dayJobs
    .filter((j) => points[j.id])
    .map((j) => {
      const address = formatJobAddress(j.address, j.zip);
      return {
        id: j.id,
        title: j.title || "Client",
        label: `${j.title || "Client"}${address ? ` · ${address}` : ""}`,
        href: `/field/jobs/${j.id}`,
        point: points[j.id],
      };
    });

  const body = (
    <div className="field-home field-home--map">
      {user.role === "technician" ? <FieldScheduleFab /> : null}

      <section className="field-section field-section--day">
        <div className="field-section-head">
          <h2>{heading}</h2>
          {!isToday ? (
            <Link href="/field" className="field-today-link">
              Jump to today
            </Link>
          ) : null}
        </div>

        <div className="field-summary">
          <div>
            <strong>{open.length}</strong>
            <span>{isToday ? "left today" : "open"}</span>
          </div>
          <div>
            <strong>{done.length}</strong>
            <span>done</span>
          </div>
        </div>

        <FieldDayBoard jobs={dayJobs} pins={pins} />
      </section>
    </div>
  );

  if (user.role === "technician") {
    return (
      <FieldShell
        user={user}
        title="Schedule"
        subtitle={heading}
        active="schedule"
        attentionCount={attentionCount}
      >
        {body}
      </FieldShell>
    );
  }

  return (
    <BosShell user={user} active="/field" title="Field" subtitle={heading}>
      {body}
    </BosShell>
  );
}
