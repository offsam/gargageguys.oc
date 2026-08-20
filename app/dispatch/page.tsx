import { BosShell } from "@/components/bos/BosShell";
import { DispatchCalendar } from "@/components/bos/DispatchCalendar";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
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

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; view?: string }>;
}) {
  const user = await requireRouteAccess("/dispatch");

  const params = await searchParams;
  const todayKey = toDayKey(startOfToday());
  const selectedDay = params.day && parseDayKey(params.day) ? params.day : todayKey;
  const view =
    params.view === "month" || params.view === "week" || params.view === "day"
      ? params.view
      : "week";

  const supabase = await createSupabaseServerClient();
  try {
    await ensureInvoicesForScheduledJobs(user.id);
  } catch (err) {
    console.error("[dispatch] ensure invoices", err);
  }
  const [{ data: jobsRaw }, { data: queueRaw }, { data: techs }] = await Promise.all([
    supabase.from("jobs").select("*").order("scheduled_start", { ascending: true }).limit(800),
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

  return (
    <BosShell
      user={user}
      active="/dispatch"
      title="Dispatch"
      subtitle="Full calendar · Month / Week / Day · same jobs as Field"
    >
      <DispatchCalendar
        dayKey={selectedDay}
        view={view}
        technicians={technicians}
        jobs={jobs}
        queue={queue}
      />
    </BosShell>
  );
}
