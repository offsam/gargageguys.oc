import { redirect } from "next/navigation";
import Link from "next/link";
import { FieldShell } from "@/components/bos/FieldShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ensureStockSeeded } from "@/lib/stock/store";
import {
  buildAttentionItems,
  formatMoney,
  isInRange,
  money,
  startOfMonth,
} from "@/lib/field/attention";
import { startOfToday, type FieldJob } from "@/lib/field/days";
import { ensureTechFieldJobsFromSheet } from "@/lib/sheet/sync-job-from-sheet";

export default async function FieldReportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "technician") redirect("/field");

  try {
    await ensureTechFieldJobsFromSheet({
      technicianId: user.id,
      technicianName: user.fullName || user.email || "",
    });
  } catch (err) {
    console.error("[field/report] sheet→job backfill", err);
  }

  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const [{ data: jobsRaw }, { data: leads }, stock] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .eq("technician_id", user.id)
      .order("scheduled_start", { ascending: false })
      .limit(800),
    admin.from("leads").select("id, name, stage, deal_price, metadata, assigned_to, updated_at, created_at").limit(500),
    ensureStockSeeded(user.id),
  ]);

  const jobs = (jobsRaw || []) as FieldJob[];
  const attention = buildAttentionItems({
    jobs,
    stock,
    technicianId: user.id,
  });

  const monthStart = startOfMonth();
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const weekStart = startOfToday();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const doneJobs = jobs.filter((j) => j.status === "done");
  const doneThisMonth = doneJobs.filter((j) =>
    isInRange(j.scheduled_start || j.updated_at || j.created_at || null, monthStart, nextMonth),
  );
  const doneThisWeek = doneJobs.filter((j) =>
    isInRange(j.scheduled_start || j.updated_at || j.created_at || null, weekStart, weekEnd),
  );

  const techName = (user.fullName || user.email || "").trim().toLowerCase();
  const myLeads = (leads || []).filter((lead) => {
    if (lead.assigned_to === user.id) return true;
    const meta = (lead.metadata || {}) as Record<string, unknown>;
    const tech = String(meta.technician || "").trim().toLowerCase();
    return Boolean(tech && tech === techName);
  });

  const completedLeads = myLeads.filter((l) =>
    ["completed", "won"].includes(String(l.stage || "")),
  );

  function commissionFor(lead: (typeof myLeads)[number]) {
    const meta = (lead.metadata || {}) as Record<string, unknown>;
    return money(meta.techSalary ?? meta.tech_salary);
  }

  const commissionMonth = completedLeads
    .filter((l) => isInRange(l.updated_at || l.created_at, monthStart, nextMonth))
    .reduce((sum, l) => sum + commissionFor(l), 0);

  const commissionWeek = completedLeads
    .filter((l) => isInRange(l.updated_at || l.created_at, weekStart, weekEnd))
    .reduce((sum, l) => sum + commissionFor(l), 0);

  const commissionAll = completedLeads.reduce((sum, l) => sum + commissionFor(l), 0);

  const recentJobs = doneJobs
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.scheduled_start || a.updated_at || a.created_at || 0).getTime();
      const tb = new Date(b.scheduled_start || b.updated_at || b.created_at || 0).getTime();
      return tb - ta;
    })
    .slice(0, 12);

  const recent = completedLeads
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime(),
    )
    .slice(0, 8);

  return (
    <FieldShell
      user={user}
      title="Report"
      subtitle="Jobs & commission"
      active="report"
      attentionCount={attention.length}
    >
      <div className="field-report">
        <div className="field-summary field-summary--3">
          <div>
            <strong>{doneThisWeek.length}</strong>
            <span>jobs this week</span>
          </div>
          <div>
            <strong>{doneThisMonth.length}</strong>
            <span>jobs this month</span>
          </div>
          <div>
            <strong>{doneJobs.length}</strong>
            <span>jobs all time</span>
          </div>
        </div>

        <section className="field-section">
          <h2>Commission</h2>
          <div className="field-summary">
            <div>
              <strong>{formatMoney(commissionWeek)}</strong>
              <span>this week</span>
            </div>
            <div>
              <strong>{formatMoney(commissionMonth)}</strong>
              <span>this month</span>
            </div>
          </div>
          <p className="field-muted">
            From Sheet Tech salary on your completed jobs. Logged total: {formatMoney(commissionAll)}.
          </p>
        </section>

        <section className="field-section">
          <h2>Past jobs</h2>
          {recentJobs.length === 0 ? (
            <div className="field-empty">
              No past jobs on your calendar yet. Completed Sheet rows with Date + Technician sync here.
            </div>
          ) : (
            <ul className="field-report-list">
              {recentJobs.map((job) => {
                const when = job.scheduled_start
                  ? new Date(job.scheduled_start).toLocaleString("en-US", {
                      timeZone: "America/Los_Angeles",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Anytime";
                return (
                  <li key={job.id}>
                    <div>
                      <strong>
                        <Link href={`/field/jobs/${job.id}`}>{job.title || "Job"}</Link>
                      </strong>
                      <span>{when}</span>
                    </div>
                    <em>{job.status.replace(/_/g, " ")}</em>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="field-section">
          <h2>Recent completed (Sheet)</h2>
          {recent.length === 0 ? (
            <div className="field-empty">No completed Sheet jobs with commission yet.</div>
          ) : (
            <ul className="field-report-list">
              {recent.map((lead) => {
                const meta = (lead.metadata || {}) as Record<string, unknown>;
                const pay = commissionFor(lead);
                return (
                  <li key={lead.id}>
                    <div>
                      <strong>{lead.name || "Client"}</strong>
                    <span>
                      {String(meta.service || meta.jobType || meta.job_type || "Job")}
                    </span>
                    </div>
                    <em>{pay ? formatMoney(pay) : "—"}</em>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {attention.length > 0 ? (
          <p className="field-muted">
            {attention.length} alert{attention.length === 1 ? "" : "s"}.{" "}
            <Link href="/field/attention">Open Alerts</Link>
          </p>
        ) : null}
      </div>
    </FieldShell>
  );
}
