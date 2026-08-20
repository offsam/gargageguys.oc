import { BosShell } from "@/components/bos/BosShell";
import { ScheduleMonthBoard } from "@/components/bos/ScheduleMonthBoard";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseDayKey, startOfToday, toDayKey, type FieldJob } from "@/lib/field/days";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; tech?: string }>;
}) {
  const user = await requireRouteAccess("/schedule");
  const params = await searchParams;
  const todayKey = toDayKey(startOfToday());
  const selectedDay = params.day && parseDayKey(params.day) ? params.day : todayKey;

  const supabase = await createSupabaseServerClient();
  const [{ data: jobsRaw }, { data: techs }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, status, zip, address, notes, scheduled_start, scheduled_end, technician_id, updated_at, created_at",
      )
      .neq("status", "cancelled")
      .order("scheduled_start", { ascending: true })
      .limit(800),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "technician")
      .order("created_at", { ascending: true }),
  ]);

  const technicians = (techs || []).map((t) => ({
    id: t.id,
    name: t.full_name || t.email || "Technician",
  }));
  const initialTech =
    params.tech && technicians.some((t) => t.id === params.tech) ? params.tech : "all";

  return (
    <BosShell
      user={user}
      active="/schedule"
      title="Schedule"
      subtitle="Month view · arrival windows · same jobs as Field"
    >
      <ScheduleMonthBoard
        technicians={technicians}
        jobs={(jobsRaw || []) as FieldJob[]}
        initialDay={selectedDay}
        initialTech={initialTech}
      />
    </BosShell>
  );
}
