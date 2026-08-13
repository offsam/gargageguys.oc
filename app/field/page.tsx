import Link from "next/link";
import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateJobStatusAction } from "@/app/actions/dispatch";
import { ensureStockSeeded, techQty } from "@/lib/stock/store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function FieldPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("jobs").select("*").order("scheduled_start", { ascending: true });
  if (user.role === "technician") {
    query = query.eq("technician_id", user.id);
  }
  const { data: jobs } = await query.limit(100);

  const open = (jobs || []).filter((j) => j.status !== "done" && j.status !== "cancelled");
  const done = (jobs || []).filter((j) => j.status === "done");

  let vanLines = 0;
  let vanUnits = 0;
  if (user.role === "technician" || user.role === "owner") {
    const admin = getSupabaseAdmin();
    const techId =
      user.role === "technician"
        ? user.id
        : (
            await admin
              .from("profiles")
              .select("id")
              .eq("role", "technician")
              .order("created_at", { ascending: true })
              .limit(1)
          ).data?.[0]?.id;
    if (techId) {
      const state = await ensureStockSeeded(techId);
      for (const item of state.items) {
        const q = techQty(state, item.id, techId);
        if (q > 0) {
          vanLines += 1;
          vanUnits += q;
        }
      }
    }
  }

  return (
    <BosShell user={user} active="/field" title="Field" subtitle="Technician jobs">
      <div className="bos-grid">
        <div className="bos-card">
          <h3>Open</h3>
          <div className="value">{open.length}</div>
        </div>
        <div className="bos-card">
          <h3>Done</h3>
          <div className="value">{done.length}</div>
        </div>
        <div className="bos-card">
          <h3>My van</h3>
          <div className="value">{vanLines}</div>
          <p style={{ margin: "6px 0 0", color: "var(--bos-muted)", fontSize: "0.85rem" }}>
            {vanUnits} units · <Link href="/stock?view=tech">View stock</Link>
          </p>
        </div>
      </div>

      <h2>My jobs</h2>
      <div className="kanban" style={{ gridTemplateColumns: "1fr" }}>
        {open.map((job) => (
          <div key={job.id} className="kanban-card">
            <strong>
              <Link href={`/field/jobs/${job.id}`}>{job.title}</Link>
            </strong>
            <span>
              {job.zip || "—"} · {job.status}
            </span>
            {job.notes ? <div style={{ marginTop: 6 }}>{job.notes}</div> : null}
            <form action={updateJobStatusAction} style={{ marginTop: 8, display: "flex", gap: 6 }}>
              <input type="hidden" name="jobId" value={job.id} />
              <select name="status" defaultValue={job.status}>
                {["assigned", "en_route", "on_site", "done", "cancelled"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button type="submit">Update</button>
            </form>
          </div>
        ))}
        {open.length === 0 ? <div className="bos-card">No open jobs assigned.</div> : null}
      </div>
    </BosShell>
  );
}
