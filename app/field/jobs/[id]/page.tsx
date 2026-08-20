import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { FieldShell } from "@/components/bos/FieldShell";
import { BosShell } from "@/components/bos/BosShell";
import { FieldInvoiceWizard } from "@/components/bos/FieldInvoiceWizard";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateJobStatusAction } from "@/app/actions/dispatch";
import { ensureStockSeeded, techQty, loadStockState } from "@/lib/stock/store";
import { getFieldAttentionCount } from "@/lib/field/load-attention";
import { ensureJobInvoice, formatJobNumber } from "@/lib/field/job-invoice";
import { listPartnersAction } from "@/app/actions/partners";
import {
  jobCompanyLabel,
  pickLeadWorkMeta,
  resolveJobStockSource,
} from "@/lib/stock/job-source";
import { loadPartnerWarehouseOntoTech } from "@/lib/stock/ops";
import { loadServices } from "@/lib/field/service-store";
import { FIELD_SERVICES } from "@/lib/field/services-catalog";
import { sheetServiceFromLead } from "@/lib/sheet/issue-service";

export default async function FieldJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  if (user.role === "technician" && job.technician_id && job.technician_id !== user.id) {
    redirect("/field");
  }

  const techId = user.role === "technician" ? user.id : job.technician_id || user.id;
  const [seeded, partners, leadRow, catalog] = await Promise.all([
    ensureStockSeeded(techId),
    listPartnersAction(),
    job.lead_id
      ? supabase.from("leads").select("metadata").eq("id", job.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadServices().catch(() => FIELD_SERVICES.filter((s) => s.id !== "svc-custom")),
  ]);
  let state = seeded;
  const leadMeta =
    leadRow.data?.metadata && typeof leadRow.data.metadata === "object"
      ? (leadRow.data.metadata as Record<string, unknown>)
      : {};
  const { workSource, partnerName } = pickLeadWorkMeta(leadMeta);
  const companyLabel = jobCompanyLabel(workSource, partnerName);
  const isPartnerJob = companyLabel !== "Garage Guys";
  const stockSource = resolveJobStockSource(workSource, partnerName, partners);
  if (stockSource.from === "partner" && typeof stockSource.owner === "string") {
    const loaded = await loadPartnerWarehouseOntoTech({
      partnerId: stockSource.owner,
      technicianId: techId,
      createdBy: user.id,
    });
    if (loaded.ok && loaded.movedQty > 0) {
      state = await loadStockState();
    }
  }
  const availableParts = state.items
    .map((item) => ({
      id: item.id,
      name: item.name,
      qty: techQty(
        state,
        item.id,
        techId,
        stockSource.from === "partner" ? stockSource.owner : undefined,
      ),
      unitCostCents: item.unitCostCents || 0,
    }))
    .filter((row) => row.qty > 0);

  let invoice = null as Awaited<ReturnType<typeof ensureJobInvoice>> | null;
  try {
    invoice = await ensureJobInvoice({ jobId: job.id, createdBy: user.id });
  } catch (err) {
    console.error("[field job invoice]", err);
  }

  const when = job.scheduled_start
    ? new Date(job.scheduled_start).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unscheduled";

  const body = (
    <div className="field-detail">
      <p className="field-back">
        <Link href="/field">← Today</Link>
      </p>

      <div
        className={`field-job-owner${isPartnerJob ? " field-job-owner--partner" : " field-job-owner--gg"}`}
        role="status"
      >
        <span className="field-job-owner__label">Job for</span>
        <strong className="field-job-owner__name">{companyLabel}</strong>
      </div>

      <section className="field-detail-card">
        <p className="field-detail-when">{when}</p>
        {(invoice?.job_number ??
          (typeof (job as { job_number?: number | null }).job_number === "number"
            ? (job as { job_number: number }).job_number
            : null)) != null ? (
          <p>
            <strong>Job #</strong>{" "}
            {formatJobNumber(
              invoice?.job_number ??
                (job as { job_number?: number }).job_number,
            )}
          </p>
        ) : null}
        <p>
          <strong>Address</strong>
          <br />
          {[job.address, job.zip].filter(Boolean).join(", ") || "—"}
        </p>
        <p>
          <strong>Stock</strong>
          <br />
          {stockSource.from === "partner"
            ? `Take ${stockSource.label} parts from your van`
            : "Take Garage Guys parts from your van"}
        </p>
        <p>
          <strong>Notes</strong>
          <br />
          {job.notes || "—"}
        </p>

        <form action={updateJobStatusAction} className="field-job-actions field-job-actions--block">
          <input type="hidden" name="jobId" value={job.id} />
          <select name="status" defaultValue={job.status}>
            {["assigned", "en_route", "on_site", "done", "cancelled"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button type="submit">Update status</button>
        </form>
      </section>

      {invoice ? (
        <FieldInvoiceWizard
          jobId={job.id}
          technicianId={techId}
          vanParts={availableParts}
          stockSourceLabel={stockSource.label}
          stockFrom={stockSource.from}
          invoice={invoice}
          defaultServiceName={sheetServiceFromLead(leadMeta)}
          services={catalog}
        />
      ) : (
        <section className="field-section">
          <div className="field-detail-card">
            <p className="field-muted">
              Invoice table not ready yet. Apply migration{" "}
              <code>202608140002_job_invoices.sql</code> in Supabase, then refresh.
            </p>
          </div>
        </section>
      )}
    </div>
  );

  if (user.role === "technician") {
    const attentionCount = await getFieldAttentionCount(user.id);
    return (
      <FieldShell
        user={user}
        title={job.title}
        subtitle={companyLabel}
        active="schedule"
        attentionCount={attentionCount}
      >
        {body}
      </FieldShell>
    );
  }

  return (
    <BosShell
      user={user}
      active="/field"
      title={job.title}
      subtitle={`${companyLabel} · Job detail + invoice`}
    >
      {body}
    </BosShell>
  );
}
