import Link from "next/link";
import { BosShell } from "@/components/bos/BosShell";
import { CrmBoard, type CrmLeadCard } from "@/components/bos/CrmBoard";
import { requireRouteAccess } from "@/lib/auth/require";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { updateInboxStatusAction } from "@/app/actions/crm";
import { sheetStatusFromLead } from "@/lib/leads/stage-sync";
import { canonicalLeadSource, sheetLeadCostFor } from "@/lib/leads/source";
import { sheetIssueFromLead, sheetServiceFromLead } from "@/lib/sheet/issue-service";
import { loadStockState } from "@/lib/stock/store";
import { SEED_STOCK_ITEMS } from "@/lib/stock/seed-catalog";
import { loadServices } from "@/lib/field/service-store";
import { FIELD_SERVICES } from "@/lib/field/services-catalog";
import type { FieldJob } from "@/lib/field/days";

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

export default async function CrmPage() {
  const user = await requireRouteAccess("/crm");

  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const [{ data: leads }, { data: inbox }, { data: techs }, { data: jobsRaw }, stockState, catalog] =
    await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("inbox_items").select("*").order("created_at", { ascending: false }).limit(50),
      admin
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "technician")
        .order("created_at", { ascending: true }),
      admin
        .from("jobs")
        .select(
          "id, title, status, zip, address, notes, scheduled_start, scheduled_end, technician_id, updated_at, created_at",
        )
        .neq("status", "cancelled")
        .order("scheduled_start", { ascending: true })
        .limit(500),
      loadStockState().catch(() => null),
      loadServices().catch(() => FIELD_SERVICES.filter((s) => s.id !== "svc-custom")),
    ]);

  const technicians = (techs || [])
    .map((t) => ({
      id: t.id,
      name: t.full_name || t.email || "Technician",
    }))
    .filter((t) => t.id);

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
    const workSource = pick(meta, "workSource", "work_source", "owner") || "Garage Guys";
    const source =
      workSource === "Partner"
        ? pick(meta, "leadSource", "lead_source")
        : canonicalLeadSource(lead.source || pick(meta, "leadSource", "lead_source"), {
            campaignName: pick(meta, "metaCampaignName", "googleCampaignName"),
            adName: pick(meta, "metaAdName"),
          });
    return {
      id: lead.id,
      name: lead.name || pick(meta, "clientName", "client_name") || "Unknown",
      phone: lead.phone || pick(meta, "phone") || "",
      zip: lead.zip || pick(meta, "zip") || "",
      address,
      workSource,
      partnerName: pick(meta, "partnerName", "partner_name", "partner"),
      source,
      leadCost: sheetLeadCostFor(source, pick(meta, "leadCost", "lead_cost")),
      date: pick(meta, "sheetDate", "date") || new Date(lead.created_at).toISOString().slice(0, 10),
      jobType: sheetIssueFromLead({
        metadata: meta,
        dealTitle: lead.deal_title,
        leadType: lead.lead_type,
        message: lead.message,
      }),
      service: sheetServiceFromLead(meta),
      technician: pick(meta, "technician", "tech_name") || "",
      jobStatus: sheetStatusFromLead({ stage: lead.stage, metadata: lead.metadata }),
      jobCost: pick(meta, "jobCost", "job_cost") || lead.deal_price || "",
      parts: pick(meta, "parts"),
      paymentType: pick(meta, "paymentType", "payment_type"),
      checkNumber: pick(meta, "checkNumber", "check_number"),
      bankFee: pick(meta, "bankFee", "bank_fee"),
      partsCost: pick(meta, "partsCost", "parts_cost"),
      techSalary: pick(meta, "techSalary", "tech_salary"),
      description: pick(meta, "description", "notes", "note"),
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
      <CrmBoard
        leads={cards}
        technicians={technicians}
        scheduleJobs={(jobsRaw || []) as FieldJob[]}
        stockParts={stockParts}
        catalogServices={catalog.map((s) => ({
          name: s.name,
          unitPrice: s.unitPriceCents > 0 ? (s.unitPriceCents / 100).toFixed(2) : "",
        }))}
      />

      <h2>Clients</h2>
      <p>
        Full history — jobs, dates, and payments — is on{" "}
        <Link href="/clients">Clients</Link>.
      </p>

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
