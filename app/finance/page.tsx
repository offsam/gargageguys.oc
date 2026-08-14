import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { FinanceBoard } from "@/components/bos/FinanceBoard";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInvoiceAction } from "@/app/actions/finance";
import { loadFinanceRows } from "@/lib/finance/load";

export default async function FinancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [{ data: customers }, rows] = await Promise.all([
    supabase.from("customers").select("id, name, phone").order("name").limit(200),
    loadFinanceRows(),
  ]);

  return (
    <BosShell
      user={user}
      active="/finance"
      title="Finance"
      subtitle="Invoices, work date, and where the client came from"
    >
      <FinanceBoard rows={rows} />

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
    </BosShell>
  );
}
