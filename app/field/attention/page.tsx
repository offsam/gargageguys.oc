import Link from "next/link";
import { redirect } from "next/navigation";
import { FieldShell } from "@/components/bos/FieldShell";
import { FieldAlertJump, FieldAlertSection } from "@/components/bos/FieldAlertBoard";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureStockSeeded } from "@/lib/stock/store";
import { buildAttentionItems } from "@/lib/field/attention";
import type { FieldJob } from "@/lib/field/days";

function chipLabel(item: { kind: string; title: string; detail: string }) {
  if (item.kind === "low_stock") {
    // "Name · 2 left"
    return item.detail;
  }
  // "Title · ZIP · status" → prefer the job title chunk
  const first = item.detail.split(" · ")[0]?.trim();
  return first || item.title;
}

export default async function FieldAttentionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "technician" && user.role !== "owner") redirect("/field");

  const techId = user.id;
  const supabase = await createSupabaseServerClient();

  const [{ data: jobsRaw }, stock] = await Promise.all([
    supabase.from("jobs").select("*").eq("technician_id", techId).limit(300),
    ensureStockSeeded(techId),
  ]);

  const jobs = (jobsRaw || []) as FieldJob[];
  const items = buildAttentionItems({ jobs, stock, technicianId: techId });

  const groups = {
    jobs: items.filter((i) => i.kind === "open_job" || i.kind === "overdue_job"),
    stock: items.filter((i) => i.kind === "low_stock"),
    recalls: items.filter((i) => i.kind === "recall"),
  };

  return (
    <FieldShell
      user={user}
      title="Alerts"
      subtitle="Tap a category to jump"
      active="attention"
      attentionCount={items.length}
    >
      <div className="field-attention">
        <FieldAlertJump
          jobs={groups.jobs.length}
          stock={groups.stock.length}
          recalls={groups.recalls.length}
        />

        <FieldAlertSection id="alert-jobs" title="Jobs" empty="No open jobs">
          {groups.jobs.length
            ? groups.jobs.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`field-chip field-chip--${item.severity}`}
                  title={item.detail}
                >
                  {chipLabel(item)}
                </Link>
              ))
            : null}
        </FieldAlertSection>

        <FieldAlertSection id="alert-stock" title="Stock" empty="Van stock looks fine">
          {groups.stock.length
            ? groups.stock.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`field-chip field-chip--${item.severity}`}
                  title={item.detail}
                >
                  {chipLabel(item)}
                </Link>
              ))
            : null}
        </FieldAlertSection>

        <FieldAlertSection
          id="alert-recalls"
          title="Recalls"
          empty="Recalls from clients will show up here later"
        >
          {groups.recalls.length
            ? groups.recalls.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`field-chip field-chip--${item.severity}`}
                  title={item.detail}
                >
                  {chipLabel(item)}
                </Link>
              ))
            : null}
        </FieldAlertSection>
      </div>
    </FieldShell>
  );
}
