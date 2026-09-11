import { BosShell } from "@/components/bos/BosShell";
import { FieldScheduleFab } from "@/components/bos/FieldScheduleFab";
import { FieldShell } from "@/components/bos/FieldShell";
import { FieldTodayHome } from "@/components/bos/FieldTodayHome";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFieldAttentionCount } from "@/lib/field/load-attention";
import {
  dayKeyFromIso,
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

function buildPins(jobs: FieldJob[], points: Record<string, { lat: number; lng: number }>): FieldMapPin[] {
  return jobs
    .filter((j) => points[j.id] && !isBusyJob(j))
    .map((j) => {
      const address = formatJobAddress(j.address, j.zip);
      return {
        id: j.id,
        title: j.title || "Client",
        label: `${j.title || "Client"}${address ? ` · ${address}` : ""}`,
        href: `/field/jobs/${j.id}`,
        point: points[j.id],
        status: j.status,
      };
    });
}

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
  const dayJobsWithCancelled = jobs
    .filter((j) => dayKeyFromIso(j.scheduled_start) === selectedDay)
    .sort((a, b) => {
      const ta = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const tb = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return ta - tb;
    });

  const upcoming = jobs
    .filter((j) => j.status !== "cancelled")
    .sort((a, b) => {
      const ta = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const tb = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return ta - tb;
    })
    .slice(0, 40);

  const isToday = selectedDay === todayKey;
  const heading = isToday ? "Today" : formatDayHeading(selectedDay);
  const attentionCount =
    user.role === "technician" ? await getFieldAttentionCount(user.id) : 0;

  const geocodeSource = [...dayJobsWithCancelled, ...upcoming];
  const seen = new Set<string>();
  const geocodeQueries = geocodeSource
    .filter((j) => {
      if (seen.has(j.id) || isBusyJob(j)) return false;
      seen.add(j.id);
      return true;
    })
    .map((j) => {
      const text = formatJobAddress(j.address, j.zip);
      return text ? { id: j.id, text } : null;
    })
    .filter((row): row is { id: string; text: string } => Boolean(row));

  const points = await geocodeMany(geocodeQueries);
  const todayPins = buildPins(dayJobsWithCancelled, points);
  const allPins = buildPins(upcoming, points);

  const body = (
    <div className="field-home-wrap">
      {user.role === "technician" ? <FieldScheduleFab /> : null}
      <FieldTodayHome
        todayJobs={dayJobs}
        allJobs={upcoming}
        todayPins={todayPins}
        allPins={allPins}
        isToday={isToday}
        heading={heading}
      />
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
