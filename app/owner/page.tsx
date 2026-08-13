import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function OwnerPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [
    { count: leadsNew },
    { count: jobsOpen },
    { count: invoicesOpen },
    { count: staffCount },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "assigned", "en_route", "on_site"]),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "sent", "overdue"]),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  return (
    <BosShell user={user} active="/owner" title="Overview" subtitle="Business overview">
      <div className="bos-grid">
        <Link className="bos-card" href="/sheet">
          <h3>Sheet</h3>
          <div className="value" style={{ fontSize: "1.05rem" }}>
            Leads table →
          </div>
          <p style={{ margin: "0.35rem 0 0", color: "var(--bos-muted)", fontSize: "0.85rem" }}>
            {leadsNew ?? 0} new leads
          </p>
        </Link>
        <Link className="bos-card" href="/stock">
          <h3>Stock</h3>
          <div className="value" style={{ fontSize: "1.05rem" }}>
            Inventory →
          </div>
        </Link>
        <Link className="bos-card" href="/dispatch">
          <h3>Open jobs</h3>
          <div className="value">{jobsOpen ?? 0}</div>
        </Link>
        <Link className="bos-card" href="/finance">
          <h3>Open invoices</h3>
          <div className="value">{invoicesOpen ?? 0}</div>
        </Link>
        <Link className="bos-card" href="/employees">
          <h3>Employees</h3>
          <div className="value">{staffCount ?? 0}</div>
        </Link>
      </div>
    </BosShell>
  );
}
