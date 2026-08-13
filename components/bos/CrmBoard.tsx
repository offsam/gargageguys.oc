"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCrmClientAction, deleteCrmLeadAction, updateLeadJobStatusAction } from "@/app/actions/crm";
import { SHEET_STATUSES, type SheetStatus } from "@/lib/leads/stage-sync";

export type CrmLeadCard = {
  id: string;
  name: string;
  phone: string;
  address: string;
  source: string;
  jobType: string;
  technician: string;
  jobStatus: SheetStatus;
  createdAt: string;
};

const LEAD_SOURCES = [
  "Facebook",
  "Google",
  "Website",
  "Referral",
  "Thumbtack",
  "Yelp",
] as const;

const PAYMENT_TYPES = ["", "Credit Card", "Venmo", "Zelle", "Cash", "Check"] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  clientName: "",
  phone: "",
  zip: "",
  clientAddress: "",
  leadSource: "Website",
  leadCost: "",
  date: todayISO(),
  jobStatus: "Waiting" as SheetStatus,
  jobType: "",
  parts: "",
  paymentType: "",
  checkNumber: "",
  jobCost: "",
  bankFee: "",
  partsCost: "",
  technician: "",
  techSalary: "",
};

export function CrmBoard({
  leads: initialLeads,
  technicians = [],
  stockParts = [],
}: {
  leads: CrmLeadCard[];
  technicians?: string[];
  stockParts?: string[];
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const columns = useMemo(() => {
    return SHEET_STATUSES.map((status) => ({
      status,
      items: leads.filter((l) => l.jobStatus === status),
    }));
  }, [leads]);

  function moveLead(leadId: string, jobStatus: SheetStatus) {
    const prev = leads;
    setLeads((list) =>
      list.map((l) => (l.id === leadId ? { ...l, jobStatus } : l)),
    );
    setError("");

    startTransition(async () => {
      const fd = new FormData();
      fd.set("leadId", leadId);
      fd.set("jobStatus", jobStatus);
      const result = await updateLeadJobStatusAction(fd);
      if (!result.ok) {
        setLeads(prev);
        setError(result.error || "Move failed");
        return;
      }
      router.refresh();
    });
  }

  function deleteLead(lead: CrmLeadCard) {
    const label = lead.name.trim() || lead.phone.trim() || "this lead";
    if (
      !window.confirm(
        `Delete ${label} from CRM and the whole system?\n\nRemoves Sheet row, jobs, invoices, inbox, and chat. Cannot be undone.`,
      )
    ) {
      return;
    }

    const prev = leads;
    setLeads((list) => list.filter((l) => l.id !== lead.id));
    setError("");

    startTransition(async () => {
      const result = await deleteCrmLeadAction(lead.id);
      if (!result.ok) {
        setLeads(prev);
        setError(result.error || "Delete failed");
        return;
      }
      router.refresh();
    });
  }

  function openAddModal(status: SheetStatus = "Waiting") {
    setForm({ ...EMPTY_FORM, date: todayISO(), jobStatus: status });
    setFormError("");
    setOpenAdd(true);
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const fd = new FormData();
    for (const [key, value] of Object.entries(form)) {
      fd.set(key, value);
    }

    startTransition(async () => {
      const result = await createCrmClientAction(fd);
      if (!result.ok) {
        setFormError(result.error || "Could not create client");
        return;
      }
      setOpenAdd(false);
      setForm(EMPTY_FORM);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="crm-sync-bar">
        <p>
          Same clients as <strong>Sheet</strong>. Website callback / book forms land here too.
          {pending ? " Saving…" : null}
        </p>
        {error ? <span className="crm-sync-error">{error}</span> : null}
      </div>
      <div className="kanban kanban--sheet-sync">
        {columns.map((col) => (
          <div key={col.status} className="kanban-col">
            <div className="kanban-col-head">
              <h3>
                {col.status} ({col.items.length})
              </h3>
              {col.status === "Waiting" ? (
                <button
                  type="button"
                  className="crm-add-btn"
                  onClick={() => openAddModal("Waiting")}
                  aria-label="Add client"
                  title="Add client"
                >
                  +
                </button>
              ) : null}
            </div>
            {col.items.length === 0 ? (
              <p className="kanban-empty">No clients</p>
            ) : null}
            {col.items.map((lead) => (
              <div key={lead.id} className="kanban-card">
                <div className="kanban-card-top">
                  <strong>{lead.name || "Unknown"}</strong>
                  <button
                    type="button"
                    className="crm-card-delete"
                    onClick={() => deleteLead(lead)}
                    disabled={pending}
                    title="Delete lead"
                  >
                    Delete
                  </button>
                </div>
                {lead.address ? <span>{lead.address}</span> : null}
                {lead.phone ? <span>{lead.phone}</span> : null}
                <div className="kanban-card-meta">
                  {[lead.source, lead.jobType, lead.technician].filter(Boolean).join(" · ") ||
                    "—"}
                </div>
                <label className="kanban-move">
                  <span className="sr-only">Move status</span>
                  <select
                    value={lead.jobStatus}
                    disabled={pending}
                    onChange={(e) => moveLead(lead.id, e.target.value as SheetStatus)}
                  >
                    {SHEET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        ))}
      </div>

      {openAdd ? (
        <div className="crm-modal" role="dialog" aria-modal="true" aria-labelledby="crm-add-title">
          <button
            type="button"
            className="crm-modal__backdrop"
            aria-label="Close"
            onClick={() => setOpenAdd(false)}
          />
          <div className="crm-modal__panel">
            <div className="crm-modal__head">
              <h3 id="crm-add-title">Add client</h3>
              <button type="button" className="crm-modal__close" onClick={() => setOpenAdd(false)}>
                ×
              </button>
            </div>
            <p className="crm-modal__hint">
              Fills the same columns as Sheet. Client appears in CRM and Sheet immediately.
            </p>
            <form className="crm-add-form" onSubmit={submitAdd}>
              <label>
                Client name
                <input
                  value={form.clientName}
                  onChange={(e) => setField("clientName", e.target.value)}
                  autoFocus
                />
              </label>
              <label>
                Phone
                <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
              </label>
              <label>
                ZIP
                <input value={form.zip} onChange={(e) => setField("zip", e.target.value)} />
              </label>
              <label className="crm-span-2">
                Address
                <input
                  value={form.clientAddress}
                  onChange={(e) => setField("clientAddress", e.target.value)}
                />
              </label>
              <label>
                Lead source
                <input
                  list="crm-lead-sources"
                  value={form.leadSource}
                  onChange={(e) => setField("leadSource", e.target.value)}
                  placeholder="Pick or type…"
                />
                <datalist id="crm-lead-sources">
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label>
                Lead cost
                <input
                  value={form.leadCost}
                  onChange={(e) => setField("leadCost", e.target.value)}
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setField("date", e.target.value)}
                />
              </label>
              <label>
                Status
                <select
                  value={form.jobStatus}
                  onChange={(e) => setField("jobStatus", e.target.value)}
                >
                  {SHEET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-span-2">
                Job type
                <input value={form.jobType} onChange={(e) => setField("jobType", e.target.value)} />
              </label>
              <label>
                Parts
                <input
                  list="crm-parts"
                  value={form.parts}
                  onChange={(e) => setField("parts", e.target.value)}
                  placeholder="From stock or type…"
                />
                <datalist id="crm-parts">
                  {stockParts.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              <label>
                Parts cost
                <input
                  value={form.partsCost}
                  onChange={(e) => setField("partsCost", e.target.value)}
                />
              </label>
              <label>
                Payment type
                <select
                  value={form.paymentType}
                  onChange={(e) => setField("paymentType", e.target.value)}
                >
                  {PAYMENT_TYPES.map((p) => (
                    <option key={p || "empty"} value={p}>
                      {p || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Check #
                <input
                  value={form.checkNumber}
                  onChange={(e) => setField("checkNumber", e.target.value)}
                />
              </label>
              <label>
                Job cost
                <input value={form.jobCost} onChange={(e) => setField("jobCost", e.target.value)} />
              </label>
              <label>
                Bank fee
                <input value={form.bankFee} onChange={(e) => setField("bankFee", e.target.value)} />
              </label>
              <label>
                Technician
                <select
                  value={form.technician}
                  onChange={(e) => setField("technician", e.target.value)}
                >
                  <option value="">—</option>
                  {technicians.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tech salary
                <input
                  value={form.techSalary}
                  onChange={(e) => setField("techSalary", e.target.value)}
                />
              </label>
              {formError ? <p className="crm-form-error crm-span-2">{formError}</p> : null}
              <div className="crm-form-actions crm-span-2">
                <button type="button" className="crm-btn-secondary" onClick={() => setOpenAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="crm-btn-primary" disabled={pending}>
                  {pending ? "Saving…" : "Add client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
