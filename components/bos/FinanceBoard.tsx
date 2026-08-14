"use client";

import { useMemo, useState } from "react";
import { updateInvoiceStatusAction } from "@/app/actions/finance";
import { InvoiceSendButton } from "@/components/bos/InvoiceSendButton";
import { earnedBySource } from "@/lib/finance/summary";
import type { FinanceRow } from "@/lib/finance/types";

const PERIODS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom range" },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];
type SupplierFilter = "all" | "garage_guys" | "partner";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function sourceKindLabel(kind: FinanceRow["sourceKind"]) {
  if (kind === "partner") return "Partner";
  if (kind === "garage_guys") return "Garage Guys";
  return "Unknown";
}

function inPeriod(workDate: string, period: PeriodId, from: string, to: string) {
  if (!workDate) return period === "all";
  const today = todayKey();
  if (period === "all") return true;
  if (period === "today") return workDate === today;
  if (period === "yesterday") return workDate === shiftKey(today, -1);
  if (period === "7d") return workDate >= shiftKey(today, -6) && workDate <= today;
  if (period === "30d") return workDate >= shiftKey(today, -29) && workDate <= today;
  if (period === "month") return workDate.slice(0, 7) === today.slice(0, 7);
  if (period === "custom") {
    if (from && workDate < from) return false;
    if (to && workDate > to) return false;
    return true;
  }
  return true;
}

export function FinanceBoard({ rows }: { rows: FinanceRow[] }) {
  const [period, setPeriod] = useState<PeriodId>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [supplier, setSupplier] = useState<SupplierFilter>("all");
  const [source, setSource] = useState("all");
  const [open, setOpen] = useState<FinanceRow | null>(null);

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (supplier !== "all" && row.sourceKind !== supplier) continue;
      if (row.sourceLabel) set.add(row.sourceLabel);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows, supplier]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (!inPeriod(row.workDate, period, from, to)) return false;
      if (supplier !== "all" && row.sourceKind !== supplier) return false;
      if (source !== "all" && row.sourceLabel !== source) return false;
      return true;
    });
  }, [rows, period, from, to, supplier, source]);

  const paid = filtered
    .filter((r) => r.status === "paid" || r.status === "complete" || r.status === "signed")
    .reduce((s, r) => s + r.amountCents, 0);
  const openAmt = filtered
    .filter((r) => r.status === "sent" || r.status === "overdue" || r.status === "draft")
    .reduce((s, r) => s + r.amountCents, 0);
  const bySource = earnedBySource(filtered);

  function openInvoice(row: FinanceRow) {
    setOpen(row);
  }

  return (
    <>
      <div className="bos-grid">
        <div className="bos-card">
          <h3>Open</h3>
          <div className="value">{money(openAmt)}</div>
        </div>
        <div className="bos-card">
          <h3>Paid / completed</h3>
          <div className="value">{money(paid)}</div>
        </div>
        <div className="bos-card">
          <h3>Jobs in view</h3>
          <div className="value">{filtered.length}</div>
        </div>
        <div className="bos-card">
          <h3>Garage Guys</h3>
          <div className="value">{money(bySource.garageGuysCents)}</div>
        </div>
        {bySource.partners.map((p) => (
          <div className="bos-card" key={p.name}>
            <h3>{p.name}</h3>
            <div className="value">{money(p.cents)}</div>
          </div>
        ))}
        {bySource.otherCents ? (
          <div className="bos-card">
            <h3>Other</h3>
            <div className="value">{money(bySource.otherCents)}</div>
          </div>
        ) : null}
      </div>

      <div className="finance-filters">
        <label>
          Period
          <select
            value={period}
            onChange={(e) => {
              const next = e.target.value as PeriodId;
              setPeriod(next);
              if (next !== "custom") {
                setFrom("");
                setTo("");
              }
            }}
          >
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPeriod("custom");
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPeriod("custom");
            }}
          />
        </label>
        <label>
          Lead supplier
          <select
            value={supplier}
            onChange={(e) => {
              setSupplier(e.target.value as SupplierFilter);
              setSource("all");
            }}
          >
            <option value="all">All</option>
            <option value="garage_guys">Garage Guys (our leads)</option>
            <option value="partner">Partner</option>
          </select>
        </label>
        <label>
          Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            {sourceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="finance-hint">
        Double-click a client, or press Invoice, to open the job invoice. Partner jobs have no
        Garage Guys invoice.
      </p>

      <table className="bos-table finance-table">
        <thead>
          <tr>
            <th>Work date</th>
            <th>Client</th>
            <th>Job #</th>
            <th>From</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Invoice</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="finance-empty">
                No jobs in this filter.
              </td>
            </tr>
          ) : (
            filtered.map((row) => (
              <tr
                key={row.id}
                className="finance-row"
                onDoubleClick={() => openInvoice(row)}
              >
                <td>{row.workDateLabel}</td>
                <td>
                  <strong>{row.clientName}</strong>
                </td>
                <td>{row.jobNumber || "—"}</td>
                <td>
                  <span className="finance-source">
                    <em>{sourceKindLabel(row.sourceKind)}</em>
                    <span>{row.sourceLabel}</span>
                  </span>
                </td>
                <td>{money(row.amountCents)}</td>
                <td>
                  {row.invoiceId ? (
                    <form
                      action={updateInvoiceStatusAction}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="invoiceId" value={row.invoiceId} />
                      <select name="status" defaultValue={row.status}>
                        {["draft", "sent", "paid", "void", "overdue"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button type="submit">Save</button>
                    </form>
                  ) : (
                    row.status
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                  <div className="finance-inv-actions">
                    <button type="button" onClick={() => openInvoice(row)}>
                      Invoice
                    </button>
                    {row.publicToken ? (
                      <InvoiceSendButton
                        compact
                        token={row.publicToken}
                        defaultEmail={row.clientEmail}
                        jobNumber={row.jobNumber || "Invoice"}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {open ? (
        <div className="crm-modal finance-invoice-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="crm-modal__backdrop"
            aria-label="Close"
            onClick={() => setOpen(null)}
          />
          <div className="crm-modal__panel finance-invoice-panel">
            <div className="crm-modal__head">
              <h3>
                {open.clientName}
                {open.jobNumber ? ` · ${open.jobNumber}` : ""}
              </h3>
              <div className="finance-invoice-head-actions">
                {open.publicToken ? (
                  <InvoiceSendButton
                    token={open.publicToken}
                    defaultEmail={open.clientEmail}
                    jobNumber={open.jobNumber || "Invoice"}
                  />
                ) : null}
                <button type="button" className="crm-modal__close" onClick={() => setOpen(null)}>
                  ×
                </button>
              </div>
            </div>
            <p className="finance-invoice-meta">
              Work date {open.workDateLabel} · {sourceKindLabel(open.sourceKind)} · {open.sourceLabel}
              {open.paymentType ? ` · ${open.paymentType}` : ""}
            </p>
            {open.invoiceUrl ? (
              <>
                <p className="crm-modal__hint">
                  <a href={open.invoiceUrl} target="_blank" rel="noreferrer">
                    Open invoice in a new tab
                  </a>
                </p>
                <iframe title="Invoice" src={open.invoiceUrl} className="finance-invoice-frame" />
              </>
            ) : (
              <p className="crm-modal__hint">
                {open.sourceKind === "partner"
                  ? "This is a partner job. There is no Garage Guys invoice."
                  : "No field invoice is attached to this record yet."}
                {open.description ? ` ${open.description}` : ""}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
