import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assignJobAction, createJobFromLeadAction, updateJobStatusAction } from "@/app/actions/dispatch";
import { isBusyJob } from "@/lib/field/busy";

export default async function DispatchPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [{ data: jobs }, { data: queue }, { data: techs }] = await Promise.all([
    supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(100),
    supabase
      .from("leads")
      .select("*")
      .in("stage", ["qualified", "scheduled", "new"])
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id, full_name, email, role").eq("role", "technician"),
  ]);

  return (
    <BosShell
      user={user}
      active="/dispatch"
      title="Dispatch"
      subtitle="Queue, assign technicians, track jobs"
    >
      <h2 style={{ marginTop: 0 }}>Lead queue</h2>
      <table className="bos-table">
        <thead>
          <tr>
            <th>Lead</th>
            <th>Stage</th>
            <th>ZIP</th>
            <th>Create job</th>
          </tr>
        </thead>
        <tbody>
          {(queue || []).map((lead) => (
            <tr key={lead.id}>
              <td>
                <strong>{lead.name}</strong>
                <div style={{ color: "var(--bos-muted)", fontSize: "0.8rem" }}>{lead.message}</div>
              </td>
              <td>
                <span className={`bos-badge ${lead.stage}`}>{lead.stage}</span>
              </td>
              <td>{lead.zip}</td>
              <td>
                <form action={createJobFromLeadAction}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <button type="submit">Add to jobs</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Jobs</h2>
      <table className="bos-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Tech</th>
            <th>ZIP</th>
            <th>Assign / update</th>
          </tr>
        </thead>
        <tbody>
          {(jobs || []).map((job) => {
            const busy = isBusyJob(job);
            return (
            <tr key={job.id} className={busy ? "dispatch-row--busy" : undefined}>
              <td>
                {busy ? (
                  <>
                    <strong>Busy</strong>
                    <div style={{ color: "var(--bos-muted)", fontSize: "0.8rem" }}>
                      {String(job.notes || "")
                        .replace("[BUSY]", "")
                        .trim() || "Technician blocked this time"}
                      {job.scheduled_start
                        ? ` · ${new Date(job.scheduled_start).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}`
                        : ""}
                      {job.scheduled_end
                        ? ` – ${new Date(job.scheduled_end).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}`
                        : ""}
                    </div>
                  </>
                ) : (
                  job.title
                )}
              </td>
              <td>{busy ? "busy" : job.status}</td>
              <td>
                {(techs || []).find((t) => t.id === job.technician_id)?.full_name ||
                  (techs || []).find((t) => t.id === job.technician_id)?.email ||
                  "—"}
              </td>
              <td>{job.zip}</td>
              <td>
                <form action={assignJobAction} style={{ display: "inline-flex", gap: 6 }}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <select name="technicianId" defaultValue={job.technician_id || ""}>
                    <option value="">Unassigned</option>
                    {(techs || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.email}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Assign</button>
                </form>
                <form action={updateJobStatusAction} style={{ display: "inline-flex", gap: 6, marginLeft: 8 }}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <select name="status" defaultValue={job.status}>
                    {["queued", "assigned", "en_route", "on_site", "done", "cancelled"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Save</button>
                </form>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </BosShell>
  );
}
