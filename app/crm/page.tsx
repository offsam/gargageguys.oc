import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateLeadStageAction, updateInboxStatusAction } from "@/app/actions/crm";

const STAGES = ["new", "qualified", "scheduled", "in_progress", "completed", "won", "lost"] as const;

export default async function CrmPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [{ data: leads }, { data: customers }, { data: inbox }] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("inbox_items").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <BosShell
      user={user}
      active="/crm"
      title="CRM"
      subtitle="Leads, customers, and inbox — classic desk, no Canvas"
    >
      <h2 style={{ marginTop: 0 }}>Leads board</h2>
      <div className="kanban">
        {STAGES.map((stage) => {
          const column = (leads || []).filter((l) => l.stage === stage);
          return (
            <div key={stage} className="kanban-col">
              <h3>
                {stage} ({column.length})
              </h3>
              {column.map((lead) => (
                <div key={lead.id} className="kanban-card">
                  <strong>{lead.name || "Unknown"}</strong>
                  <span>
                    {lead.phone} · {lead.zip}
                  </span>
                  <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--bos-muted)" }}>
                    {lead.message || lead.problem || lead.source}
                  </div>
                  <form action={updateLeadStageAction} style={{ marginTop: 8 }}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <select name="stage" defaultValue={lead.stage} style={{ width: "100%" }}>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button type="submit" style={{ marginTop: 6, width: "100%" }}>
                      Update
                    </button>
                  </form>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <h2>Customers</h2>
      <table className="bos-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>ZIP</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {(customers || []).map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.phone}</td>
              <td>{c.zip}</td>
              <td>{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Inbox</h2>
      <table className="bos-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Source</th>
            <th>Status</th>
            <th>When</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(inbox || []).map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.source}</td>
              <td>
                <span className={`bos-badge ${item.status}`}>{item.status}</span>
              </td>
              <td>{new Date(item.created_at).toLocaleString()}</td>
              <td>
                <form action={updateInboxStatusAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <select name="status" defaultValue={item.status}>
                    <option value="new">new</option>
                    <option value="reviewed">reviewed</option>
                    <option value="done">done</option>
                    <option value="ignored">ignored</option>
                  </select>
                  <button type="submit">Save</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </BosShell>
  );
}
