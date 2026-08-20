import { BosShell } from "@/components/bos/BosShell";
import { ScheduleMonthBoard } from "@/components/bos/ScheduleMonthBoard";
import { requireRouteAccess } from "@/lib/auth/require";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseDayKey, startOfToday, toDayKey, type FieldJob } from "@/lib/field/days";
import { calendarEntriesFromSheet } from "@/lib/schedule/sheet-entries";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; tech?: string }>;
}) {
  const user = await requireRouteAccess("/schedule");
  const params = await searchParams;
  const todayKey = toDayKey(startOfToday());
  const selectedDay = params.day && parseDayKey(params.day) ? params.day : todayKey;

  const admin = getSupabaseAdmin();
  const [{ data: jobsRaw }, { data: leadsRaw }, { data: techs }] = await Promise.all([
    admin
      .from("jobs")
      .select(
        "id, lead_id, title, status, zip, address, notes, scheduled_start, scheduled_end, technician_id, updated_at, created_at, job_number",
      )
      .neq("status", "cancelled")
      .order("scheduled_start", { ascending: true })
      .limit(1500),
    admin
      .from("leads")
      .select(
        "id, name, phone, zip, address, stage, source, message, created_at, deal_title, deal_price, lead_type, metadata, assigned_to",
      )
      .order("created_at", { ascending: false })
      .limit(1500),
    admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "technician")
      .order("created_at", { ascending: true }),
  ]);

  const jobs = (jobsRaw || []) as Array<
    FieldJob & { lead_id?: string | null; job_number?: number | string | null }
  >;
  const technicians = (techs || []).map((t) => ({
    id: t.id,
    name: t.full_name || t.email || "Technician",
  }));
  const entries = calendarEntriesFromSheet({
    leads: leadsRaw || [],
    jobs,
    technicians,
  });
  const initialTech =
    params.tech && technicians.some((t) => t.id === params.tech) ? params.tech : "all";

  return (
    <BosShell
      user={user}
      active="/schedule"
      title="Schedule"
      subtitle="Month view · Sheet work dates · arrival windows"
    >
      <ScheduleMonthBoard
        technicians={technicians}
        jobs={jobs}
        entries={entries}
        initialDay={selectedDay}
        initialTech={initialTech}
      />
    </BosShell>
  );
}
