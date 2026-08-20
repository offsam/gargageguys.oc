import Link from "next/link";
import { BosShell } from "@/components/bos/BosShell";
import { FieldCalendar } from "@/components/bos/FieldCalendar";
import { FieldDayTimeline } from "@/components/bos/FieldDayTimeline";
import { FieldScheduleFab } from "@/components/bos/FieldScheduleFab";
import { FieldShell } from "@/components/bos/FieldShell";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFieldAttentionCount } from "@/lib/field/load-attention";
import {
  formatDayHeading,
  jobCountsByDay,
  jobsForDay,
  parseDayKey,
  startOfToday,
  toDayKey,
  type FieldJob,
} from "@/lib/field/days";
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

  const counts = jobCountsByDay(jobs);
  const dayJobs = jobsForDay(jobs, selectedDay);
  const open = dayJobs.filter((j) => j.status !== "done");
  const done = dayJobs.filter((j) => j.status === "done");
  const isToday = selectedDay === todayKey;
  const heading = isToday ? "Today" : formatDayHeading(selectedDay);
  const attentionCount =
    user.role === "technician" ? await getFieldAttentionCount(user.id) : 0;

  const body = (
    <div className="field-home">
      {user.role === "technician" ? <FieldScheduleFab /> : null}

      <section className="field-section">
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

        <FieldDayTimeline jobs={dayJobs} />
      </section>

      <section className="field-section">
        <h2>Calendar</h2>
        <FieldCalendar counts={counts} selectedDay={selectedDay} />
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
