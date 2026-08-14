import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { CrmBoard, type CrmLeadCard } from "@/components/bos/CrmBoard";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { updateInboxStatusAction } from "@/app/actions/crm";
import { sheetStatusFromLead } from "@/lib/leads/stage-sync";
import { loadStockState } from "@/lib/stock/store";
import { SEED_STOCK_ITEMS } from "@/lib/stock/seed-catalog";

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

export default async function CrmPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const [{ data: leads }, { data: customers }, { data: inbox }, { data: techs }, stockState] =
    await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("inbox_items").select("*").order("created_at", { ascending: false }).limit(50),
      admin
        .from("profiles")
        .select("full_name, email")
        .eq("role", "technician")
        .order("created_at", { ascending: true }),
      loadStockState().catch(() => null),
    ]);

  const technicians = (techs || [])
    .map((t) => t.full_name || t.email)
    .filter((v): v is string => Boolean(v));

  const stockParts = (() => {
    const fromStock = (stockState?.items || [])
      .filter((item) => item.active !== false && item.name)
      .map((item) => item.name);
    if (fromStock.length) return [...new Set(fromStock)].sort((a, b) => a.localeCompare(b));
    return SEED_STOCK_ITEMS.map((i) => i.name).sort((a, b) => a.localeCompare(b));
  })();

  const cards: CrmLeadCard[] = (leads || []).map((lead) => {
    const meta = asMeta(lead.metadata);
    const address =
      (typeof (lead as { address?: string | null }).address === "string"
        ? (lead as { address?: string | null }).address
        : null) ||
      pick(meta, "clientAddress", "address") ||
      "";
    return {
      id: lead.id,
      name: lead.name || pick(meta, "clientName") || "Unknown",
      phone: lead.phone || pick(meta, "phone") || "",
      address,
      source: lead.source || pick(meta, "leadSource") || "",
      jobType:
        pick(meta, "jobType") || lead.deal_title || lead.lead_type || lead.message || "",
      technician: pick(meta, "technician") || "",
      jobStatus: sheetStatusFromLead({ stage: lead.stage, metadata: lead.metadata }),
      createdAt: lead.created_at,
    };
  });

  return (
    <BosShell
      user={user}
      active="/crm"
      title="CRM"
      subtitle="Same funnel as Sheet — website forms and + Add land here"
    >
      <h2 style={{ marginTop: 0 }}>Lead funnel</h2>
      <CrmBoard leads={cards} technicians={technicians} stockParts={stockParts} />

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
