import Link from "next/link";
import { BosShell } from "@/components/bos/BosShell";
import { DispatchBoard } from "@/components/bos/DispatchBoard";
import { FieldCalendar } from "@/components/bos/FieldCalendar";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatDayHeading,
  jobCountsByDay,
  parseDayKey,
  startOfToday,
  toDayKey,
  type FieldJob,
} from "@/lib/field/days";
import { sheetStatusFromLead } from "@/lib/leads/stage-sync";
import { ensureInvoicesForScheduledJobs } from "@/lib/field/job-invoice";

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pick(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function shiftDay(dayKey: string, delta: number): string {
  const d = parseDayKey(dayKey) || startOfToday();
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireRouteAccess("/dispatch");

  const params = await searchParams;
  const todayKey = toDayKey(startOfToday());
  const selectedDay = params.day && parseDayKey(params.day) ? params.day : todayKey;
  const isToday = selectedDay === todayKey;

  const supabase = await createSupabaseServerClient();
  try {
    await ensureInvoicesForScheduledJobs(user.id);
  } catch (err) {
    console.error("[dispatch] ensure invoices", err);
  }
  const [{ data: jobsRaw }, { data: queueRaw }, { data: techs }] = await Promise.all([
    supabase.from("jobs").select("*").order("scheduled_start", { ascending: true }).limit(500),
    supabase
      .from("leads")
      .select("*")
      .in("stage", ["qualified", "new"])
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("role", "technician")
      .order("created_at", { ascending: true }),
  ]);

  const jobs = (jobsRaw || []) as FieldJob[];
  const technicians = (techs || []).map((t) => ({
    id: t.id,
    name: t.full_name || t.email || "Technician",
  }));

  const queue = (queueRaw || [])
    .map((lead) => {
      const meta = asMeta(lead.metadata);
      const jobStatus = sheetStatusFromLead({ stage: lead.stage, metadata: lead.metadata });
      return {
        id: lead.id,
        name: lead.name || pick(meta, "clientName") || "Unknown",
        phone: lead.phone || pick(meta, "phone") || "",
        zip: lead.zip || pick(meta, "zip") || "",
        address:
          (typeof (lead as { address?: string | null }).address === "string"
            ? (lead as { address?: string | null }).address
            : "") ||
          pick(meta, "clientAddress", "address"),
        message: lead.message || lead.deal_title || "",
        jobStatus,
      };
    })
    .filter((lead) => lead.jobStatus === "Waiting" || lead.jobStatus === "No answer");

  const counts = jobCountsByDay(jobs);
  const heading = isToday ? "Today" : formatDayHeading(selectedDay);

  return (
    <BosShell
      user={user}
      active="/dispatch"
      title="Dispatch"
      subtitle="Schedule technicians by day — Waiting leads need time + tech"
    >
      <div className="dispatch-day-nav">
        <Link href={`/dispatch?day=${shiftDay(selectedDay, -1)}`}>‹ Prev</Link>
        <strong>{heading}</strong>
        <Link href={`/dispatch?day=${shiftDay(selectedDay, 1)}`}>Next ›</Link>
        {!isToday ? <Link href="/dispatch">Jump to today</Link> : null}
      </div>

      <DispatchBoard
        dayKey={selectedDay}
        technicians={technicians}
        jobs={jobs}
        queue={queue}
      />

      <section>
        <h2>Calendar</h2>
        <FieldCalendar counts={counts} selectedDay={selectedDay} basePath="/dispatch" />
      </section>
    </BosShell>
  );
}
