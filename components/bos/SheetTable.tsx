"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSheetRowAction, deleteSheetRowAction } from "@/app/actions/sheet";
import { SHEET_STATUSES } from "@/lib/leads/stage-sync";

export type SheetRow = {
  id: string;
  leadSource: string;
  leadCost: string;
  date: string;
  clientName: string;
  clientAddress: string;
  jobStatus: string;
  jobType: string;
  parts: string;
  paymentType: string;
  checkNumber: string;
  jobCost: string;
  bankFee: string;
  partsCost: string;
  technician: string;
  techSalary: string;
};

export type StockPartOption = {
  name: string;
  unitCost: string;
};

const PAYMENT_TYPES = ["", "Credit Card", "Venmo", "Zelle", "Cash", "Check"] as const;
const JOB_STATUSES = ["", ...SHEET_STATUSES] as const;
const LEAD_SOURCES = [
  "Facebook",
  "Google",
  "Website",
  "Referral",
  "Thumbtack",
  "Yelp",
] as const;
const BANK_FEE_RATE = 0.035;
const WIDTHS_STORAGE_KEY = "bos-sheet-col-widths";
const LEAD_SOURCE_LIST_ID = "sheet-lead-source-list";

const COLUMNS: Array<{
  key: keyof SheetRow;
  label: string;
  width: number;
  kind?: "text" | "select" | "date" | "combo";
  options?: "payment" | "status" | "technician" | "parts" | "leadSource";
}> = [
  { key: "leadSource", label: "Lead source", width: 140, kind: "combo", options: "leadSource" },
  { key: "leadCost", label: "Lead cost", width: 100 },
  { key: "date", label: "Date", width: 130, kind: "date" },
  { key: "clientName", label: "Client name", width: 150 },
  { key: "clientAddress", label: "Address", width: 200 },
  { key: "jobStatus", label: "Status", width: 130, kind: "select", options: "status" },
  { key: "jobType", label: "Job type", width: 140 },
  { key: "parts", label: "Parts", width: 180, kind: "select", options: "parts" },
  { key: "paymentType", label: "Payment type", width: 140, kind: "select", options: "payment" },
  { key: "checkNumber", label: "Check #", width: 110 },
  { key: "jobCost", label: "Job cost", width: 100 },
  { key: "bankFee", label: "Bank fee", width: 90 },
  { key: "partsCost", label: "Parts cost", width: 100 },
  {
    key: "technician",
    label: "Technician",
    width: 140,
    kind: "select",
    options: "technician",
  },
  { key: "techSalary", label: "Tech salary", width: 110 },
];

const PROFIT_DEFAULT_WIDTH = 110;
const ROW_NUM_WIDTH = 42;
const MIN_COL_WIDTH = 64;

function money(value: string): number {
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatFee(n: number): string {
  if (!n) return "0.00";
  return n.toFixed(2);
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateInputValue(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return todayISO();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const mdy = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    let year = Number(mdy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return todayISO();
}

function isCardPayment(paymentType: string) {
  return paymentType === "Credit Card";
}

function isCheckPayment(paymentType: string) {
  return paymentType === "Check";
}

function bankFeeFor(jobCost: string): string {
  return formatFee(money(jobCost) * BANK_FEE_RATE);
}

function emptyRow(index: number): SheetRow {
  return {
    id: `new-${index}-${Date.now()}`,
    leadSource: "",
    leadCost: "",
    date: todayISO(),
    clientName: "",
    clientAddress: "",
    jobStatus: "",
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
}

function clearProfitFor(row: SheetRow): string {
  const hasMoney =
    money(row.jobCost) ||
    money(row.leadCost) ||
    money(row.bankFee) ||
    money(row.partsCost) ||
    money(row.techSalary);
  if (!hasMoney) return "";
  return formatMoney(
    money(row.jobCost) -
      money(row.leadCost) -
      money(row.bankFee) -
      money(row.partsCost) -
      money(row.techSalary),
  );
}

function applyPaymentRules(row: SheetRow, patch: Partial<SheetRow>): SheetRow {
  const next = { ...row, ...patch };
  const paymentChanged = Object.prototype.hasOwnProperty.call(patch, "paymentType");
  const jobCostChanged = Object.prototype.hasOwnProperty.call(patch, "jobCost");

  if (isCardPayment(next.paymentType) && (paymentChanged || jobCostChanged)) {
    next.bankFee = bankFeeFor(next.jobCost);
  }

  return next;
}

function statusClass(status: string): string {
  switch (status) {
    case "Completed":
      return "sheet-status-done";
    case "Cancelled":
    case "No-show":
      return "sheet-status-bad";
    case "Tech confirmed":
    case "En route":
    case "On site":
    case "In progress":
      return "sheet-status-active";
    case "Scheduled":
      return "sheet-status-sched";
    case "Waiting":
      return "sheet-status-wait";
    default:
      return "";
  }
}

function defaultWidths(): Record<string, number> {
  const widths: Record<string, number> = { __profit: PROFIT_DEFAULT_WIDTH };
  for (const col of COLUMNS) widths[col.key] = col.width;
  return widths;
}

function loadWidths(): Record<string, number> {
  const base = defaultWidths();
  try {
    const raw = localStorage.getItem(WIDTHS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= MIN_COL_WIDTH) {
        base[key] = value;
      }
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function SheetTable({
  rows: initialRows,
  technicians,
  stockParts = [],
}: {
  rows: SheetRow[];
  technicians: string[];
  stockParts?: StockPartOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SheetRow[]>(() => {
    const extras = Math.max(8, 14 - initialRows.length);
    return [
      ...initialRows.map((r) => ({ ...r, date: toDateInputValue(r.date) })),
      ...Array.from({ length: extras }, (_, i) => emptyRow(i)),
    ];
  });
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths);
  const dragRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    setWidths(loadWidths());
  }, []);

  const techOptions = useMemo(() => {
    const set = new Set<string>(technicians.filter(Boolean));
    for (const row of rows) {
      if (row.technician) set.add(row.technician);
    }
    return ["", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [technicians, rows]);

  const partCostByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const part of stockParts) {
      if (part.name) map.set(part.name, part.unitCost);
    }
    return map;
  }, [stockParts]);

  const partNames = useMemo(() => {
    const set = new Set<string>(stockParts.map((p) => p.name).filter(Boolean));
    for (const row of rows) {
      if (row.parts) set.add(row.parts);
    }
    return ["", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [stockParts, rows]);

  const profitColIndex = COLUMNS.length;
  const deleteColWidth = 44;
  const tableWidth =
    ROW_NUM_WIDTH +
    COLUMNS.reduce((sum, col) => sum + (widths[col.key] || col.width), 0) +
    (widths.__profit || PROFIT_DEFAULT_WIDTH) +
    deleteColWidth;

  function persistWidths(next: Record<string, number>) {
    try {
      localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const onResizeMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nextW = Math.max(MIN_COL_WIDTH, drag.startW + (e.clientX - drag.startX));
    setWidths((prev) => ({ ...prev, [drag.key]: nextW }));
  }, []);

  const onResizeEnd = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    document.body.classList.remove("sheet-col-resizing");
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeEnd);
    if (drag) {
      setWidths((prev) => {
        persistWidths(prev);
        return prev;
      });
    }
  }, [onResizeMove]);

  function startResize(key: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      key,
      startX: e.clientX,
      startW: widths[key] || MIN_COL_WIDTH,
    };
    document.body.classList.add("sheet-col-resizing");
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeEnd);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", onResizeEnd);
      document.body.classList.remove("sheet-col-resizing");
    };
  }, [onResizeMove, onResizeEnd]);

  function removeRow(row: SheetRow) {
    const isTemp = row.id.startsWith("new-");
    const hasContent = [
      row.leadSource,
      row.leadCost,
      row.clientName,
      row.clientAddress,
      row.jobStatus,
      row.jobType,
      row.parts,
      row.paymentType,
      row.checkNumber,
      row.jobCost,
      row.bankFee,
      row.partsCost,
      row.technician,
      row.techSalary,
    ].some((v) => String(v || "").trim());

    if (isTemp && !hasContent) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }

    const label = row.clientName.trim() || row.clientAddress.trim() || "this row";
    const msg = isTemp
      ? `Remove this unsaved row?`
      : `Delete ${label} from Sheet and the whole system?\n\nThis removes the lead, related jobs, invoices, inbox items, and chat. Cannot be undone.`;
    if (!window.confirm(msg)) return;

    setRows((prev) => prev.filter((r) => r.id !== row.id));
    if (isTemp) return;

    startTransition(async () => {
      const result = await deleteSheetRowAction(row.id);
      if (!result.ok) {
        setStatus(result.error || "Delete failed");
        setRows((prev) => {
          if (prev.some((r) => r.id === row.id)) return prev;
          return [...prev, row];
        });
        return;
      }
      setStatus("Deleted");
      window.setTimeout(() => setStatus(""), 1200);
      router.refresh();
    });
  }

  function persistRow(row: SheetRow) {
    startTransition(async () => {
      const result = await saveSheetRowAction(row);
      if (!result.ok) {
        setStatus(result.error || "Save failed");
        return;
      }
      if (result.id && result.id !== row.id) {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, id: result.id! } : r)),
        );
      }
      setStatus("Saved");
      window.setTimeout(() => setStatus(""), 1200);
      router.refresh();
    });
  }

  function patchRow(rowId: string, patch: Partial<SheetRow>, save: boolean) {
    setRows((prev) => {
      let saved: SheetRow | null = null;
      const nextRows = prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = applyPaymentRules(row, patch);
        saved = next;
        return next;
      });
      if (save && saved) persistRow(saved);
      return nextRows;
    });
  }

  function onPartsChange(rowId: string, value: string) {
    const patch: Partial<SheetRow> = { parts: value };
    const cost = partCostByName.get(value);
    if (cost != null && cost !== "") {
      patch.partsCost = cost;
    }
    patchRow(rowId, patch, true);
  }

  function selectOptions(
    kind: "payment" | "status" | "technician" | "parts" | "leadSource" | undefined,
  ) {
    if (kind === "payment") return [...PAYMENT_TYPES];
    if (kind === "status") return [...JOB_STATUSES];
    if (kind === "technician") return techOptions;
    if (kind === "parts") return partNames;
    if (kind === "leadSource") return ["", ...LEAD_SOURCES];
    return [""];
  }

  const leadSourceSuggestions = useMemo(() => {
    const set = new Set<string>(LEAD_SOURCES);
    for (const row of rows) {
      if (row.leadSource.trim()) set.add(row.leadSource.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const displayRows = useMemo(() => rows, [rows]);

  return (
    <div>
      <datalist id={LEAD_SOURCE_LIST_ID}>
        {leadSourceSuggestions.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <div className="sheet-status">{pending ? "Saving…" : status}</div>
      <div className="sheet-wrap">
        <table className="sheet-grid" style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: ROW_NUM_WIDTH }} />
            {COLUMNS.map((col) => (
              <col key={col.key} style={{ width: widths[col.key] || col.width }} />
            ))}
            <col style={{ width: widths.__profit || PROFIT_DEFAULT_WIDTH }} />
            <col style={{ width: deleteColWidth }} />
          </colgroup>
          <thead>
            <tr>
              <th className="sheet-corner" />
              {COLUMNS.map((col, idx) => (
                <th key={col.key} style={{ width: widths[col.key] || col.width }}>
                  <span className="sheet-col-letter">{String.fromCharCode(65 + idx)}</span>
                  <span className="sheet-col-label">{col.label}</span>
                  <span
                    className="sheet-col-resize"
                    onMouseDown={(e) => startResize(col.key, e)}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${col.label}`}
                  />
                </th>
              ))}
              <th style={{ width: widths.__profit || PROFIT_DEFAULT_WIDTH }}>
                <span className="sheet-col-letter">
                  {String.fromCharCode(65 + profitColIndex)}
                </span>
                <span className="sheet-col-label">Clear profit</span>
                <span
                  className="sheet-col-resize"
                  onMouseDown={(e) => startResize("__profit", e)}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize Clear profit"
                />
              </th>
              <th className="sheet-del-head" style={{ width: deleteColWidth }} aria-label="Delete" />
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => {
              const needCheck =
                isCheckPayment(row.paymentType) && !String(row.checkNumber).trim();
              const cardPay = isCardPayment(row.paymentType);

              return (
                <tr key={row.id}>
                  <th className="sheet-row-num">{rowIndex + 1}</th>
                  {COLUMNS.map((col) => {
                    const needBankEmpty =
                      col.key === "bankFee" && cardPay && !String(row.bankFee).trim();
                    const bankActive = col.key === "bankFee" && cardPay;
                    const cellClass =
                      needCheck && col.key === "checkNumber"
                        ? "sheet-cell-need"
                        : needBankEmpty
                          ? "sheet-cell-need"
                          : bankActive
                            ? "sheet-cell-bank"
                            : col.key === "jobStatus"
                              ? statusClass(row.jobStatus)
                              : undefined;

                    if (col.kind === "select") {
                      return (
                        <td key={col.key} className={cellClass}>
                          <select
                            className="sheet-cell sheet-select"
                            value={row[col.key]}
                            onChange={(e) => {
                              if (col.key === "parts") {
                                onPartsChange(row.id, e.target.value);
                                return;
                              }
                              patchRow(row.id, { [col.key]: e.target.value }, true);
                            }}
                          >
                            {selectOptions(col.options).map((opt) => (
                              <option key={opt || `${col.key}-empty`} value={opt}>
                                {opt || "—"}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    }

                    if (col.kind === "combo") {
                      return (
                        <td key={col.key}>
                          <input
                            className="sheet-cell sheet-combo"
                            list={col.options === "leadSource" ? LEAD_SOURCE_LIST_ID : undefined}
                            value={row[col.key]}
                            placeholder="Pick or type…"
                            onChange={(e) =>
                              patchRow(row.id, { [col.key]: e.target.value }, false)
                            }
                            onBlur={() => {
                              setRows((prev) => {
                                const current = prev.find((r) => r.id === row.id);
                                if (current) persistRow(current);
                                return prev;
                              });
                            }}
                          />
                        </td>
                      );
                    }

                    if (col.kind === "date") {
                      return (
                        <td key={col.key}>
                          <input
                            className="sheet-cell sheet-date"
                            type="date"
                            value={toDateInputValue(row.date)}
                            onChange={(e) =>
                              patchRow(row.id, { date: e.target.value || todayISO() }, true)
                            }
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} className={cellClass}>
                        <input
                          className="sheet-cell"
                          value={row[col.key]}
                          onChange={(e) =>
                            patchRow(row.id, { [col.key]: e.target.value }, false)
                          }
                          onBlur={() => {
                            setRows((prev) => {
                              const current = prev.find((r) => r.id === row.id);
                              if (current) persistRow(current);
                              return prev;
                            });
                          }}
                          placeholder={
                            col.key === "checkNumber" && needCheck
                              ? "Required"
                              : col.key === "bankFee" && cardPay
                                ? "3.5%"
                                : ""
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="sheet-profit">
                    <input
                      className="sheet-cell"
                      value={clearProfitFor(row)}
                      readOnly
                      tabIndex={-1}
                    />
                  </td>
                  <td className="sheet-del-cell">
                    <button
                      type="button"
                      className="sheet-del-btn"
                      onClick={() => removeRow(row)}
                      aria-label={`Delete ${row.clientName || "row"}`}
                      title="Delete client from Sheet and system"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="emp-add-btn"
        style={{ marginTop: "0.75rem" }}
        onClick={() => setRows((prev) => [...prev, emptyRow(prev.length)])}
      >
        + Add row
      </button>
    </div>
  );
}
