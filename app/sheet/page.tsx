import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { SheetTable, type SheetRow } from "@/components/bos/SheetTable";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadStockState, masterQty, partnerMasterQty } from "@/lib/stock/store";
import { SEED_STOCK_ITEMS } from "@/lib/stock/seed-catalog";
import { listPartnersAction } from "@/app/actions/partners";
import { sheetStatusFromLead } from "@/lib/leads/stage-sync";
import { sheetIssueFromLead, sheetServiceFromLead } from "@/lib/sheet/issue-service";
import { formatJobNumber } from "@/lib/field/job-invoice-types";
import type { StockPartOption } from "@/components/bos/SheetTable";

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
  const admin = getSupabaseAdmin();

  const [{ data: leads }, { data: techProfiles }, { data: jobsForNumbers }, stockState, partners] =
    await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, name, phone, zip, address, stage, source, message, created_at, deal_title, deal_price, lead_type, metadata, assigned_to",
      )
      .order("created_at", { ascending: false })
      .limit(300),
    admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "technician")
      .order("created_at", { ascending: true }),
    admin
      .from("jobs")
      .select("id, lead_id, job_number")
      .not("lead_id", "is", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(500),
    loadStockState().catch(() => null),
    listPartnersAction(),
  ]);

  const jobNumberByLead = new Map<string, string>();
  for (const job of jobsForNumbers || []) {
    const leadId = String(job.lead_id || "");
    if (!leadId || jobNumberByLead.has(leadId)) continue;
    const label = formatJobNumber(
      job.job_number == null || job.job_number === "" ? null : Number(job.job_number),
    );
    if (label !== "—") jobNumberByLead.set(leadId, label);
  }

  const stockParts: StockPartOption[] = (() => {
    const items = stockState?.items || [];
    const fromStock = items
      .filter((item) => item.active !== false && item.name)
      .map((item) => ({
        name: item.name,
        unitCost: (item.unitCostCents / 100).toFixed(2),
        qty: stockState ? masterQty(stockState, item.id) : undefined,
      }));
    if (fromStock.length) {
      return fromStock.sort((a, b) => a.name.localeCompare(b.name));
    }
    return SEED_STOCK_ITEMS.map((item) => ({
      name: item.name,
      unitCost: "",
    })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const partnerStockParts: Record<string, StockPartOption[]> = (() => {
    if (!stockState) return {};
    const out: Record<string, StockPartOption[]> = {};
    for (const partner of partners) {
      if (!partner.active || !partner.name || partner.id.startsWith("seed-")) continue;
      if (!partner.has_own_stock) continue;
      out[partner.name] = stockState.items
        .filter((item) => item.active !== false && item.name)
        .map((item) => ({
          name: item.name,
          unitCost: (item.unitCostCents / 100).toFixed(2),
          qty: partnerMasterQty(stockState, item.id, partner.id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  })();

  const techById = new Map(
    (techProfiles || []).map((t) => [t.id, t.full_name || t.email || t.id]),
  );
  const technicianNames = (techProfiles || []).map((t) => t.full_name || t.email).filter(Boolean);

  const rows: SheetRow[] = (leads || []).map((lead) => {
    const meta = asMeta(lead.metadata);
    const jobType = sheetIssueFromLead({
      metadata: meta,
      dealTitle: lead.deal_title,
      leadType: lead.lead_type,
      message: lead.message,
    });
    const service = sheetServiceFromLead(meta);
    const fromAssignee =
      lead.assigned_to && techById.get(lead.assigned_to)
        ? techById.get(lead.assigned_to)!
        : "";

    const workSource =
      pick(meta, "workSource", "work_source", "owner") || "Garage Guys";

    return {
      id: lead.id,
      jobNumber:
        jobNumberByLead.get(lead.id) ||
        (() => {
          const raw = pick(meta, "jobNumber", "job_number");
          if (!raw) return "";
          const n = Number(raw);
          return Number.isFinite(n)
            ? formatJobNumber(n)
            : /^GG\d{2}-\d{5}$/i.test(raw) || /^GG-\d+$/i.test(raw)
              ? raw
              : "";
        })(),
      workSource,
      partnerName: pick(meta, "partnerName", "partner_name", "partner"),
      leadSource:
        workSource === "Partner"
          ? pick(meta, "leadSource", "lead_source")
          : lead.source || pick(meta, "leadSource", "lead_source") || "",
      leadCost: pick(meta, "leadCost", "lead_cost"),
      date: pick(meta, "sheetDate", "date") || new Date(lead.created_at).toISOString().slice(0, 10),
      clientName: lead.name || pick(meta, "clientName", "client_name") || "",
      clientAddress:
        lead.address ||
        pick(meta, "clientAddress", "client_address", "address") ||
        "",
      jobStatus: sheetStatusFromLead(lead),
      jobType,
      service,
      parts: pick(meta, "parts"),
      paymentType: pick(meta, "paymentType", "payment_type"),
      checkNumber: pick(meta, "checkNumber", "check_number"),
      jobCost: pick(meta, "jobCost", "job_cost") || lead.deal_price || "",
      bankFee: pick(meta, "bankFee", "bank_fee"),
      partsCost: pick(meta, "partsCost", "parts_cost"),
      technician: pick(meta, "technician", "tech_name") || fromAssignee,
      techSalary: pick(meta, "techSalary", "tech_salary"),
      description: pick(meta, "description", "notes", "note"),
    };
  });

  const partnerOpts = partners
    .filter((p) => p.active && p.name)
    .map((p) => ({ name: p.name, hasOwnStock: p.has_own_stock }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <BosShell
      user={user}
      active="/sheet"
      title="Sheet"
      subtitle="Primary work ledger. Synced with CRM funnel — same clients and statuses."
    >
      <div className="sheet-toolbar bos-card">
        <div>
          <strong>Garage Guys Sheet</strong>
          <p>
            Pick Work source first (Garage Guys or Partner) — only the needed columns unlock.
            Partner with own stock: parts come from their warehouse, profit $0. Partner using
            ours: parts cost fills from Garage Guys stock. Tech gets 30% of Gross.
          </p>
        </div>
        <span className="bos-badge scheduled">Synced with CRM</span>
      </div>
      <SheetTable
        rows={rows}
        technicians={technicianNames}
        stockParts={stockParts}
        partnerStockParts={partnerStockParts}
        partners={partnerOpts}
      />
    </BosShell>
  );
}
