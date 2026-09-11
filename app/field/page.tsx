import { BosShell } from "@/components/bos/BosShell";
import { FieldScheduleFab } from "@/components/bos/FieldScheduleFab";
import { FieldShell } from "@/components/bos/FieldShell";
import { FieldTodayHome, type FieldDayBucket, type FieldDayFilter } from "@/components/bos/FieldTodayHome";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFieldAttentionCount } from "@/lib/field/load-attention";
import {
  dayKeyFromIso,
  formatDayHeading,
  jobsForDay,
  shiftDayKey,
  startOfToday,
  toDayKey,
  type FieldJob,
} from "@/lib/field/days";
import { isBusyJob } from "@/lib/field/busy";
import { geocodeMany } from "@/lib/field/geocode";
import { formatJobAddress } from "@/lib/field/maps";
import type { FieldMapPin } from "@/components/bos/FieldDayMap";
import { ensureTechFieldJobsFromSheet } from "@/lib/sheet/sync-job-from-sheet";
import { getTechLocation } from "@/lib/field/tech-location-store";

function buildPins(
  jobs: FieldJob[],
  points: Record<string, { lat: number; lng: number }>,
): FieldMapPin[] {
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

function jobsForDayIncludingCancelled(jobs: FieldJob[], dayKey: string): FieldJob[] {
  return jobs
    .filter((j) => dayKeyFromIso(j.scheduled_start) === dayKey)
    .sort((a, b) => {
      const ta = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const tb = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return ta - tb;
    });
}

export default async function FieldPage() {
  const user = await requireRouteAccess("/field");

  const todayKey = toDayKey(startOfToday());
  const yesterdayKey = shiftDayKey(todayKey, -1);
  const tomorrowKey = shiftDayKey(todayKey, 1);

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

  const todayJobs = jobsForDay(jobs, todayKey);
  const yesterdayJobs = jobsForDay(jobs, yesterdayKey);
  const tomorrowJobs = jobsForDay(jobs, tomorrowKey);
  const allJobs = jobs
    .filter((j) => j.status !== "cancelled")
    .sort((a, b) => {
      const ta = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const tb = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return ta - tb;
    })
    .slice(0, 60);

  const mapJobs = [
    ...jobsForDayIncludingCancelled(jobs, yesterdayKey),
    ...jobsForDayIncludingCancelled(jobs, todayKey),
    ...jobsForDayIncludingCancelled(jobs, tomorrowKey),
    ...allJobs,
  ];

  const attentionCount =
    user.role === "technician" ? await getFieldAttentionCount(user.id) : 0;

  const seen = new Set<string>();
  const geocodeQueries = mapJobs
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

  const [points, techLoc] = await Promise.all([
    geocodeMany(geocodeQueries),
    user.role === "technician" ? getTechLocation(user.id).catch(() => null) : Promise.resolve(null),
  ]);

  function bucket(
    list: FieldJob[],
    dayKey: string | null,
    label: string,
  ): FieldDayBucket {
    const withCancel = dayKey ? jobsForDayIncludingCancelled(jobs, dayKey) : list;
    return {
      jobs: list,
      pins: buildPins(withCancel, points),
      label,
      count: list.length,
    };
  }

  const buckets: Record<FieldDayFilter, FieldDayBucket> = {
    yesterday: bucket(yesterdayJobs, yesterdayKey, formatDayHeading(yesterdayKey)),
    today: bucket(todayJobs, todayKey, "Today"),
    tomorrow: bucket(tomorrowJobs, tomorrowKey, formatDayHeading(tomorrowKey)),
    all: bucket(allJobs, null, "All upcoming / recent jobs"),
  };

  const lastKnownTech =
    techLoc && Number.isFinite(techLoc.lat) && Number.isFinite(techLoc.lng)
      ? { lat: techLoc.lat, lng: techLoc.lng }
      : null;

  const body = (
    <div className="field-home-wrap">
      {user.role === "technician" ? <FieldScheduleFab /> : null}
      <FieldTodayHome
        buckets={buckets}
        initialFilter="today"
        lastKnownTech={lastKnownTech}
        lastKnownTechAt={techLoc?.updatedAt || null}
      />
    </div>
  );

  if (user.role === "technician") {
    return (
      <FieldShell
        user={user}
        title="Schedule"
        subtitle="Today"
        active="schedule"
        attentionCount={attentionCount}
      >
        {body}
      </FieldShell>
    );
  }

  return (
    <BosShell user={user} active="/field" title="Field" subtitle="Today">
      {body}
    </BosShell>
  );
}
