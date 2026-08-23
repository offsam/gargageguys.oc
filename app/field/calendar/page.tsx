import Link from "next/link";
import { BosShell } from "@/components/bos/BosShell";
import { FieldCalendar } from "@/components/bos/FieldCalendar";
import { FieldShell } from "@/components/bos/FieldShell";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFieldAttentionCount } from "@/lib/field/load-attention";
import {
  formatDayHeading,
  jobCountsByDay,
  parseDayKey,
  startOfToday,
  toDayKey,
  type FieldJob,
} from "@/lib/field/days";
import { ensureTechFieldJobsFromSheet } from "@/lib/sheet/sync-job-from-sheet";

export default async function FieldCalendarPage({
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
      console.error("[field calendar] sheet→job backfill", err);
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
  const isToday = selectedDay === todayKey;
  const heading = isToday ? "Today" : formatDayHeading(selectedDay);
  const attentionCount =
    user.role === "technician" ? await getFieldAttentionCount(user.id) : 0;

  const body = (
    <div className="field-home">
      <section className="field-section">
        <div className="field-section-head">
          <h2>Calendar</h2>
          <Link href={`/field?day=${selectedDay}`} className="field-today-link">
            Day view
          </Link>
        </div>
        <p className="field-muted">
          Tap a day to open that schedule with the map. Selected: {heading}.
        </p>
        <FieldCalendar counts={counts} selectedDay={selectedDay} />
      </section>
    </div>
  );

  if (user.role === "technician") {
    return (
      <FieldShell
        user={user}
        title="Calendar"
        subtitle={heading}
        active="calendar"
        attentionCount={attentionCount}
      >
        {body}
      </FieldShell>
    );
  }

  return (
    <BosShell user={user} active="/field" title="Field calendar" subtitle={heading}>
      {body}
    </BosShell>
  );
}
