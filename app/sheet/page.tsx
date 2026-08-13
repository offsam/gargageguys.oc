import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { SheetTable, type SheetRow } from "@/components/bos/SheetTable";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pick(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

export default async function SheetPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, name, phone, zip, stage, source, message, created_at, deal_title, deal_price, lead_type, metadata",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const rows: SheetRow[] = (leads || []).map((lead) => {
    const meta = asMeta(lead.metadata);
    const jobType =
      pick(meta, "jobType", "job_type") ||
      lead.deal_title ||
      lead.lead_type ||
      lead.message ||
      "";

    return {
      id: lead.id,
      leadSource: lead.source || pick(meta, "leadSource", "lead_source") || "",
      leadCost: pick(meta, "leadCost", "lead_cost"),
      date: pick(meta, "sheetDate", "date") || new Date(lead.created_at).toLocaleDateString(),
      clientName: lead.name || pick(meta, "clientName", "client_name") || "",
      jobType,
      parts: pick(meta, "parts"),
      paymentType: pick(meta, "paymentType", "payment_type"),
      checkNumber: pick(meta, "checkNumber", "check_number"),
      jobCost: pick(meta, "jobCost", "job_cost") || lead.deal_price || "",
      bankFee: pick(meta, "bankFee", "bank_fee"),
      partsCost: pick(meta, "partsCost", "parts_cost"),
      techSalary: pick(meta, "techSalary", "tech_salary"),
    };
  });

  return (
    <BosShell
      user={user}
      active="/sheet"
      title="Sheet"
      subtitle="Click any cell to edit. Payment type is a dropdown. Check # is separate."
    >
      <div className="sheet-toolbar bos-card">
        <div>
          <strong>Garage Guys Sheet</strong>
          <p>
            Lead source, Lead cost, Date, Client name, Job type, Parts, Payment type, Check #, Job
            cost, Bank fee, Parts cost, Tech salary, Clear profit.
          </p>
        </div>
        <span className="bos-badge scheduled">Editable</span>
      </div>
      <SheetTable rows={rows} />
    </BosShell>
  );
}
