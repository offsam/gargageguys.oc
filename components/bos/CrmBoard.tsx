"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCrmClientAction,
  deleteCrmLeadAction,
  scheduleCrmLeadAction,
  updateCrmClientAction,
  updateLeadJobStatusAction,
} from "@/app/actions/crm";
import { SHEET_STATUSES, completeBlockedReason, type SheetStatus } from "@/lib/leads/stage-sync";
import { AddressAutocomplete } from "@/components/bos/AddressAutocomplete";
import { ClientAutocomplete } from "@/components/bos/ClientAutocomplete";
import { useBosLiveRefresh } from "@/lib/realtime/useBosLiveRefresh";
import { CUSTOM_SERVICE_LABEL, FIELD_SERVICES, isCustomServiceChoice } from "@/lib/field/services-catalog";
import { applyServicePriceToJobCost, leadCostForSource, parseMoney } from "@/lib/sheet/money";
import { CustomServiceModal } from "@/components/bos/CustomServiceModal";
import { ScheduleLeadModal, type CrmTechnician } from "@/components/bos/ScheduleLeadModal";
import type { FieldJob } from "@/lib/field/days";

export type CrmLeadCard = {
  id: string;
  name: string;
  phone: string;
  zip: string;
  address: string;
  workSource: string;
  partnerName: string;
  source: string;
  leadCost: string;
  date: string;
  jobType: string;
  service: string;
  technician: string;
  jobStatus: SheetStatus;
  jobCost: string;
  parts: string;
  paymentType: string;
  checkNumber: string;
  bankFee: string;
  partsCost: string;
  techSalary: string;
  description: string;
  createdAt: string;
};

export type { CrmTechnician };

const LEAD_SOURCES = [
  "Facebook",
  "Instagram",
  "Google",
  "Website",
  "Referral",
  "Thumbtack",
  "Yelp",
] as const;

const CRM_SERVICE_LIST_ID = "crm-service-list";

export type CrmServiceOption = {
  name: string;
  unitPrice: string;
};

const PAYMENT_TYPES = ["", "Credit Card", "Venmo", "Zelle", "Cash", "Check"] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  workSource: "Garage Guys",
  partnerName: "",
  clientName: "",
  phone: "",
  zip: "",
  clientAddress: "",
  leadSource: "Website",
  leadCost: "",
  date: todayISO(),
  jobStatus: "Waiting" as SheetStatus,
  jobType: "",
  service: "",
  parts: "",
  paymentType: "",
  checkNumber: "",
  jobCost: "",
  bankFee: "",
  partsCost: "",
  technician: "",
  techSalary: "",
  description: "",
};

function formFromLead(lead: CrmLeadCard): typeof EMPTY_FORM {
  return {
    workSource: lead.workSource || "Garage Guys",
    partnerName: lead.partnerName,
    clientName: lead.name,
    phone: lead.phone,
    zip: lead.zip,
    clientAddress: lead.address,
    leadSource: lead.source,
    leadCost: lead.leadCost,
    date: lead.date || todayISO(),
    jobStatus: lead.jobStatus,
    jobType: lead.jobType,
    service: lead.service,
    parts: lead.parts,
    paymentType: lead.paymentType,
    checkNumber: lead.checkNumber,
    jobCost: lead.jobCost,
    bankFee: lead.bankFee,
    partsCost: lead.partsCost,
    technician: lead.technician,
    techSalary: lead.techSalary,
    description: lead.description,
  };
}

export function CrmBoard({
  leads: initialLeads,
  technicians = [],
  scheduleJobs = [],
  stockParts = [],
  catalogServices = [],
}: {
  leads: CrmLeadCard[];
  technicians?: CrmTechnician[];
  scheduleJobs?: FieldJob[];
  stockParts?: string[];
  catalogServices?: CrmServiceOption[];
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [editLead, setEditLead] = useState<CrmLeadCard | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [scheduleLead, setScheduleLead] = useState<CrmLeadCard | null>(null);
  const [scheduleError, setScheduleError] = useState("");
  const [liveNotice, setLiveNotice] = useState("");
  const [extraServices, setExtraServices] = useState<CrmServiceOption[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customError, setCustomError] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(initialLeads.filter((l) => l.jobStatus === "Completed").map((l) => l.id)),
  );
  const seenIds = useRef(new Set(initialLeads.map((l) => l.id)));
  const firstSync = useRef(true);

  useBosLiveRefresh(["leads"]);

  useEffect(() => {
    setLeads(initialLeads);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      for (const lead of initialLeads) {
        if (lead.jobStatus === "Completed" && !prev.has(lead.id) && !seenIds.current.has(lead.id)) {
          next.add(lead.id);
        }
      }
      return next;
    });
    if (firstSync.current) {
      firstSync.current = false;
      for (const lead of initialLeads) seenIds.current.add(lead.id);
      return;
    }
    const fresh = initialLeads.filter((l) => !seenIds.current.has(l.id));
    for (const lead of initialLeads) seenIds.current.add(lead.id);
    if (fresh.length) {
      const names = fresh
        .map((l) => l.name || "New lead")
        .slice(0, 3)
        .join(", ");
      setLiveNotice(`New lead in Waiting: ${names}`);
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        for (const lead of fresh) {
          if (lead.jobStatus === "Completed") next.add(lead.id);
        }
        return next;
      });
    }
  }, [initialLeads]);

  const columns = useMemo(() => {
    return SHEET_STATUSES.map((status) => ({
      status,
      items: leads.filter((l) => l.jobStatus === status),
    }));
  }, [leads]);

  function isCollapsed(lead: CrmLeadCard) {
    return collapsedIds.has(lead.id);
  }

  function toggleCardCollapsed(leadId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function requestStatus(lead: CrmLeadCard, jobStatus: SheetStatus) {
    if (jobStatus === "Scheduled") {
      setScheduleError("");
      setScheduleLead(lead);
      return;
    }
    const blocked = completeBlockedReason(jobStatus, lead.jobCost);
    if (blocked) {
      setError(blocked);
      return;
    }
    if (jobStatus === "Completed") {
      setCollapsedIds((prev) => new Set(prev).add(lead.id));
    } else {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
    moveLead(lead.id, jobStatus);
  }

  function submitSchedule(input: {
    technicianId: string;
    startAt: string;
    endAt: string;
    clientName: string;
    clientAddress: string;
    zip?: string;
  }) {
    if (!scheduleLead) return;
    setScheduleError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("leadId", scheduleLead.id);
      fd.set("technicianId", input.technicianId);
      fd.set("startAt", input.startAt);
      fd.set("endAt", input.endAt);
      fd.set("clientName", input.clientName);
      fd.set("clientAddress", input.clientAddress);
      if (input.zip) fd.set("zip", input.zip);
      const result = await scheduleCrmLeadAction(fd);
      if (!result.ok) {
        setScheduleError(result.error || "Could not schedule");
        return;
      }
      setScheduleLead(null);
      router.refresh();
    });
  }

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
    setEditLead(null);
    setForm({ ...EMPTY_FORM, date: todayISO(), jobStatus: status });
    setFormError("");
    setOpenAdd(true);
  }

  function openDetail(lead: CrmLeadCard) {
    setForm(formFromLead(lead));
    setFormError("");
    setEditLead(lead);
    setOpenAdd(true);
  }

  function closeEditor() {
    setOpenAdd(false);
    setEditLead(null);
    setFormError("");
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "leadSource") {
        const auto = leadCostForSource(value);
        if (auto !== null) next.leadCost = auto;
      }
      return next;
    });
  }

  const allCatalogServices = useMemo(() => {
    const map = new Map<string, CrmServiceOption>();
    const seed =
      catalogServices.length > 0
        ? catalogServices
        : FIELD_SERVICES.filter((s) => s.id !== "svc-custom").map((s) => ({
            name: s.name,
            unitPrice: s.unitPriceCents > 0 ? (s.unitPriceCents / 100).toFixed(2) : "",
          }));
    for (const svc of [...seed, ...extraServices]) {
      const name = svc.name.trim();
      if (!name) continue;
      map.set(name.toLowerCase(), { name, unitPrice: svc.unitPrice || "" });
    }
    if (form.service.trim() && !map.has(form.service.trim().toLowerCase())) {
      map.set(form.service.trim().toLowerCase(), { name: form.service.trim(), unitPrice: "" });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogServices, extraServices, form.service]);

  const servicePriceByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const svc of allCatalogServices) {
      const n = parseMoney(svc.unitPrice);
      if (n > 0) map.set(svc.name.toLowerCase(), n);
    }
    return map;
  }, [allCatalogServices]);

  function rememberService(name: string, unitPrice = "") {
    const trimmed = name.trim();
    if (!trimmed || isCustomServiceChoice(trimmed)) return;
    const known =
      catalogServices.some((s) => s.name.toLowerCase() === trimmed.toLowerCase()) ||
      extraServices.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (known) return;
    setExtraServices((prev) =>
      prev.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
        ? prev
        : [...prev, { name: trimmed, unitPrice }],
    );
    void fetch("/api/sheet/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, price: unitPrice || undefined }),
    }).catch(() => {});
  }

  function setService(raw: string, persistName: boolean) {
    if (isCustomServiceChoice(raw)) {
      setCustomError("");
      setCustomOpen(true);
      setForm((prev) => ({ ...prev, service: isCustomServiceChoice(prev.service) ? "" : prev.service }));
      return;
    }
    setForm((prev) => {
      const jobCost = applyServicePriceToJobCost(
        prev.jobCost,
        prev.service,
        raw.trim(),
        servicePriceByName,
      );
      return { ...prev, service: persistName ? raw.trim() : raw, jobCost };
    });
    if (persistName && raw.trim()) rememberService(raw);
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const blocked = completeBlockedReason(form.jobStatus, form.jobCost);
    if (blocked) {
      setFormError(blocked);
      return;
    }
    rememberService(form.service);
    const fd = new FormData();
    for (const [key, value] of Object.entries(form)) {
      fd.set(key, value);
    }
    if (editLead) fd.set("leadId", editLead.id);

    startTransition(async () => {
      const result = editLead
        ? await updateCrmClientAction(fd)
        : await createCrmClientAction(fd);
      if (!result.ok) {
        setFormError(result.error || "Could not save client");
        return;
      }
      closeEditor();
      setForm(EMPTY_FORM);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="crm-sync-bar">
        <p>
          Same clients as <strong>Sheet</strong>. Double-click a card to open every Sheet field.
          {pending ? " Saving…" : null}
        </p>
        {error ? <span className="crm-sync-error">{error}</span> : null}
        {liveNotice ? <span className="crm-live-notice">{liveNotice}</span> : null}
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
            {col.items.map((lead) => {
              const collapsed = isCollapsed(lead);
              return (
              <div
                key={lead.id}
                className={["kanban-card", collapsed ? "kanban-card--collapsed" : ""]
                  .filter(Boolean)
                  .join(" ")}
                title="Double-click to open full details"
                onDoubleClick={() => openDetail(lead)}
              >
                <div className="kanban-card-top">
                  <strong>{lead.name || "Unknown"}</strong>
                  <div className="crm-card-actions">
                    <button
                      type="button"
                      className="crm-card-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardCollapsed(lead.id);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      title={collapsed ? "Expand card" : "Collapse card"}
                      aria-label={collapsed ? "Expand card" : "Collapse card"}
                      aria-expanded={!collapsed}
                    >
                      {collapsed ? "+" : "−"}
                    </button>
                    <button
                      type="button"
                      className="crm-card-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLead(lead);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      disabled={pending}
                      title="Delete lead"
                      aria-label="Delete lead"
                    >
                      ×
                    </button>
                  </div>
                </div>
                {!collapsed ? (
                  <>
                    {lead.address ? <span>{lead.address}</span> : null}
                    {lead.phone ? <span>{lead.phone}</span> : null}
                    {lead.description ? (
                      <span className="kanban-card-note">{lead.description}</span>
                    ) : null}
                    <div className="kanban-card-meta">
                      {[lead.source, lead.jobType, lead.service, lead.technician]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                    <label className="kanban-move" onDoubleClick={(e) => e.stopPropagation()}>
                      <span className="sr-only">Move status</span>
                      <select
                        value={lead.jobStatus}
                        disabled={pending}
                        onChange={(e) => requestStatus(lead, e.target.value as SheetStatus)}
                      >
                        {SHEET_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
              </div>
              );
            })}
          </div>
        ))}
      </div>

      {openAdd ? (
        <div className="crm-modal" role="dialog" aria-modal="true" aria-labelledby="crm-add-title">
          <button
            type="button"
            className="crm-modal__backdrop"
            aria-label="Close"
            onClick={closeEditor}
          />
          <div className="crm-modal__panel">
            <div className="crm-modal__head">
              <h3 id="crm-add-title">{editLead ? editLead.name || "Client" : "Add client"}</h3>
              <button type="button" className="crm-modal__close" onClick={closeEditor}>
                ×
              </button>
            </div>
            <p className="crm-modal__hint">
              {editLead
                ? "All Sheet columns for this client. Save writes back to Sheet."
                : "Fills the same columns as Sheet. Client appears in CRM and Sheet immediately."}
            </p>
            <form className="crm-add-form" onSubmit={submitAdd}>
              <label>
                Work source
                <select
                  value={form.workSource}
                  onChange={(e) => setField("workSource", e.target.value)}
                >
                  <option value="Garage Guys">Garage Guys</option>
                  <option value="Partner">Partner</option>
                </select>
              </label>
              {form.workSource === "Partner" ? (
                <label>
                  Partner
                  <input
                    value={form.partnerName}
                    onChange={(e) => setField("partnerName", e.target.value)}
                    placeholder="Company name"
                  />
                </label>
              ) : null}
              <label>
                Client name
                <ClientAutocomplete
                  value={form.clientName}
                  onChange={(value) => setField("clientName", value)}
                  onSelect={(client) => {
                    setField("clientName", client.name);
                    if (client.address) setField("clientAddress", client.address);
                    if (client.phone) setField("phone", client.phone);
                    if (client.zip) setField("zip", client.zip);
                  }}
                  placeholder="Type name…"
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
                <AddressAutocomplete
                  value={form.clientAddress}
                  onChange={(value) => setField("clientAddress", value)}
                  onSelect={(item) => {
                    setField("clientAddress", item.label);
                    if (item.zip && !form.zip) setField("zip", item.zip);
                  }}
                  placeholder="Start typing address…"
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
                  {SHEET_STATUSES.filter((s) => (editLead ? true : s !== "Scheduled")).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-span-2">
                Issue
                <input
                  value={form.jobType}
                  onChange={(e) => setField("jobType", e.target.value)}
                  placeholder="What the client said"
                />
              </label>
              <label>
                Service
                <input
                  list={CRM_SERVICE_LIST_ID}
                  value={form.service}
                  onChange={(e) => setService(e.target.value, false)}
                  onBlur={(e) => setService(e.currentTarget.value, true)}
                  placeholder="Pick or type a service…"
                />
                <datalist id={CRM_SERVICE_LIST_ID}>
                  <option value={CUSTOM_SERVICE_LABEL} />
                  {allCatalogServices.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
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
                    <option key={t.id} value={t.name}>
                      {t.name}
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
              <label className="crm-span-2">
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Client refused, no-show reason, extra notes about this job…"
                />
              </label>
              {formError ? <p className="crm-form-error crm-span-2">{formError}</p> : null}
              <div className="crm-form-actions crm-span-2">
                <button type="button" className="crm-btn-secondary" onClick={closeEditor}>
                  Cancel
                </button>
                <button type="submit" className="crm-btn-primary" disabled={pending}>
                  {pending ? "Saving…" : editLead ? "Save" : "Add client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {scheduleLead ? (
        <ScheduleLeadModal
          leadName={scheduleLead.name}
          initialClientName={scheduleLead.name}
          initialAddress={scheduleLead.address}
          technicians={technicians}
          jobs={scheduleJobs}
          pending={pending}
          error={scheduleError}
          onClose={() => setScheduleLead(null)}
          onSubmit={submitSchedule}
        />
      ) : null}
      {customOpen ? (
        <CustomServiceModal
          pending={pending}
          error={customError}
          showPrice
          onClose={() => {
            if (pending) return;
            setCustomOpen(false);
            setCustomError("");
          }}
          onSave={({ name, price }) => {
            setCustomError("");
            startTransition(async () => {
              try {
                const res = await fetch("/api/sheet/services", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, price: price || undefined }),
                });
                const data = (await res.json()) as {
                  error?: string;
                  service?: { name: string; unitPrice: string };
                };
                if (!res.ok || !data.service) {
                  setCustomError(data.error || "Could not save service");
                  return;
                }
                const unitPrice = data.service.unitPrice || price || "";
                setExtraServices((prev) => {
                  if (prev.some((s) => s.name.toLowerCase() === data.service!.name.toLowerCase())) {
                    return prev.map((s) =>
                      s.name.toLowerCase() === data.service!.name.toLowerCase()
                        ? { name: data.service!.name, unitPrice }
                        : s,
                    );
                  }
                  return [...prev, { name: data.service!.name, unitPrice }];
                });
                const prices = new Map(servicePriceByName);
                const n = parseMoney(unitPrice);
                if (n > 0) prices.set(data.service.name.toLowerCase(), n);
                setForm((prev) => ({
                  ...prev,
                  service: data.service!.name,
                  jobCost: applyServicePriceToJobCost(prev.jobCost, prev.service, data.service!.name, prices),
                }));
                setCustomOpen(false);
              } catch {
                setCustomError("Could not save service");
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}
