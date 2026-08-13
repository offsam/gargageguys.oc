import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInvoiceAction, updateInvoiceStatusAction } from "@/app/actions/finance";

export default async function FinancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [{ data: invoices }, { data: customers }] = await Promise.all([
    supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("customers").select("id, name, phone").order("name").limit(200),
  ]);

  const paid = (invoices || [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.amount_cents || 0), 0);
  const open = (invoices || [])
    .filter((i) => i.status === "sent" || i.status === "overdue" || i.status === "draft")
    .reduce((sum, i) => sum + (i.amount_cents || 0), 0);

  return (
    <BosShell
      user={user}
      active="/finance"
      title="Finance"
      subtitle="Billing & accounting"
    >
      <div className="bos-grid">
        <div className="bos-card">
          <h3>Open (cents)</h3>
          <div className="value">${(open / 100).toFixed(2)}</div>
        </div>
        <div className="bos-card">
          <h3>Paid (cents)</h3>
          <div className="value">${(paid / 100).toFixed(2)}</div>
        </div>
      </div>

      <h2>New invoice</h2>
      <form action={createInvoiceAction} className="bos-card" style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <label>
          Customer
          <select name="customerId" required defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {(customers || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.phone}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount (USD)
          <input name="amount" type="number" step="0.01" min="0" required />
        </label>
        <label>
          Description
          <input name="description" type="text" placeholder="Service invoice" />
        </label>
        <button type="submit">Create draft</button>
      </form>

      <h2>Invoices</h2>
      <table className="bos-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Update</th>
          </tr>
        </thead>
        <tbody>
          {(invoices || []).map((inv) => (
            <tr key={inv.id}>
              <td>{inv.description || "Invoice"}</td>
              <td>${((inv.amount_cents || 0) / 100).toFixed(2)}</td>
              <td>{inv.status}</td>
              <td>
                <form action={updateInvoiceStatusAction}>
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <select name="status" defaultValue={inv.status}>
                    {["draft", "sent", "paid", "void", "overdue"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
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
