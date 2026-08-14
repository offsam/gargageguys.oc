"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSheetRowAction, deleteSheetRowAction } from "@/app/actions/sheet";
import { SHEET_STATUSES } from "@/lib/leads/stage-sync";
import {
  WORK_SOURCES,
  PARTNER_TECH_RATE,
  isColumnEditable,
  isOwnWork,
  isPartnerWork,
  normalizeWorkSource,
  type SheetColumnKey,
} from "@/lib/sheet/work-source";

export type SheetRow = {
  id: string;
  workSource: string;
  partnerName: string;
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
const WIDTHS_STORAGE_KEY = "bos-sheet-col-widths-v2";
const SORT_STORAGE_KEY = "bos-sheet-date-sort";
const LEAD_SOURCE_LIST_ID = "sheet-lead-source-list";
const PARTNER_LIST_ID = "sheet-partner-list";

const MONEY_KEYS = new Set<SheetColumnKey>([
  "leadCost",
  "jobCost",
  "bankFee",
  "partsCost",
  "techSalary",
]);

const COLUMNS: Array<{
  key: SheetColumnKey;
  label: string;
  width: number;
  kind?: "text" | "select" | "date" | "combo";
  options?: "payment" | "status" | "technician" | "parts" | "leadSource" | "workSource" | "partner";
  money?: boolean;
}> = [
  { key: "date", label: "Date", width: 130, kind: "date" },
  { key: "workSource", label: "Work source", width: 130, kind: "select", options: "workSource" },
  { key: "partnerName", label: "Partner", width: 160, kind: "select", options: "partner" },
  { key: "leadSource", label: "Lead source", width: 140, kind: "combo", options: "leadSource" },
  { key: "leadCost", label: "Lead cost", width: 100, money: true },
  { key: "clientName", label: "Client name", width: 150 },
  { key: "clientAddress", label: "Address", width: 200 },
  { key: "jobStatus", label: "Status", width: 140, kind: "select", options: "status" },
  { key: "jobType", label: "Job type", width: 140 },
  { key: "parts", label: "Parts", width: 180, kind: "select", options: "parts" },
  { key: "jobCost", label: "Job cost", width: 100, money: true },
  { key: "paymentType", label: "Payment type", width: 140, kind: "select", options: "payment" },
  { key: "checkNumber", label: "Check #", width: 110 },
  { key: "bankFee", label: "Bank fee", width: 90, money: true },
  { key: "partsCost", label: "Parts cost", width: 100, money: true },
  {
    key: "technician",
    label: "Technician",
    width: 140,
    kind: "select",
    options: "technician",
  },
  { key: "techSalary", label: "Tech salary", width: 110, money: true },
];

const PROFIT_DEFAULT_WIDTH = 110;
const ROW_NUM_WIDTH = 42;
const MIN_COL_WIDTH = 64;

function money(value: string): number {
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
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

function partnerTechSalary(gross: string): string {
  const n = money(gross) * PARTNER_TECH_RATE;
  if (!n) return "";
  return formatFee(n);
}

function emptyRow(index: number): SheetRow {
  return {
    id: `new-${index}-${Date.now()}`,
    workSource: "",
    partnerName: "",
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
  if (isPartnerWork(row.workSource)) {
    const has = money(row.jobCost) || money(row.techSalary);
    if (!has) return "";
    // Partner: tech gets 30% of Gross — company clear profit on the job is $0
    return formatMoney(0);
  }

  if (!isOwnWork(row.workSource)) return "";

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

function applyRowRules(row: SheetRow, patch: Partial<SheetRow>): SheetRow {
  const next = { ...row, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "workSource")) {
    next.workSource = normalizeWorkSource(next.workSource);
  }

  const paymentChanged = Object.prototype.hasOwnProperty.call(patch, "paymentType");
  const jobCostChanged = Object.prototype.hasOwnProperty.call(patch, "jobCost");
  const sourceChanged = Object.prototype.hasOwnProperty.call(patch, "workSource");

  if (isOwnWork(next.workSource)) {
    if (isCardPayment(next.paymentType) && (paymentChanged || jobCostChanged || sourceChanged)) {
      next.bankFee = bankFeeFor(next.jobCost);
    }
  }

  if (isPartnerWork(next.workSource)) {
    if (jobCostChanged || sourceChanged) {
      next.techSalary = partnerTechSalary(next.jobCost);
    }
    // Parts come from partner stock — do not carry GG parts cost into calc
    if (sourceChanged || Object.prototype.hasOwnProperty.call(patch, "parts")) {
      if (!Object.prototype.hasOwnProperty.call(patch, "partsCost")) {
        next.partsCost = "";
      }
    }
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
    case "No answer":
      return "sheet-status-noanswer";
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

function rowHasWork(row: SheetRow): boolean {
  if (!row.id.startsWith("new-")) return true;
  return [
    row.workSource,
    row.partnerName,
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
}

function dateSortValue(row: SheetRow): string {
  return toDateInputValue(row.date) || "";
}

function cellMutedClass(workSource: string, key: SheetColumnKey, extra?: string) {
  const editable = isColumnEditable(workSource, key);
  const parts = [extra];
  if (!editable) parts.push("sheet-cell-muted");
  return parts.filter(Boolean).join(" ") || undefined;
}

export function SheetTable({
  rows: initialRows,
  technicians,
  stockParts = [],
  partners = [],
}: {
  rows: SheetRow[];
  technicians: string[];
  stockParts?: StockPartOption[];
  partners?: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SheetRow[]>(() => {
    const extras = Math.max(8, 14 - initialRows.length);
    return [
      ...initialRows.map((r) => ({
        ...r,
        workSource: normalizeWorkSource(r.workSource) || r.workSource || "",
        date: toDateInputValue(r.date),
      })),
      ...Array.from({ length: extras }, (_, i) => emptyRow(i)),
    ];
  });
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths);
  const dragRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const rowsRef = useRef(rows);
  const inFlightRef = useRef(0);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const savingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    setWidths(loadWidths());
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved === "oldest" || saved === "newest") setDateSort(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function changeDateSort(next: "newest" | "oldest") {
    setDateSort(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyIdsRef.current.size > 0 || inFlightRef.current > 0) {
        void flushDirtyRows();
        e.preventDefault();
        e.returnValue = "";
      }
    }
    function onHide() {
      if (document.visibilityState === "hidden") {
        void flushDirtyRows();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
      void flushDirtyRows();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush uses refs
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
      row.workSource,
      row.partnerName,
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
      dirtyIdsRef.current.delete(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }

    const label = row.clientName.trim() || row.clientAddress.trim() || "this row";
    const msg = isTemp
      ? `Remove this unsaved row?`
      : `Delete ${label} from Sheet and the whole system?\n\nThis removes the lead, related jobs, invoices, inbox items, and chat. Cannot be undone.`;
    if (!window.confirm(msg)) return;

    dirtyIdsRef.current.delete(row.id);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    if (isTemp) return;

    void (async () => {
      setPending(true);
      const result = await deleteSheetRowAction(row.id);
      setPending(false);
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
    })();
  }

  function rowWorthSaving(row: SheetRow) {
    // Don't insert empty leads when only Work source / date were set on a blank row.
    if (!row.id.startsWith("new-")) return true;
    return [
      row.partnerName,
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
  }

  async function writeRow(row: SheetRow) {
    if (!rowWorthSaving(row)) return { ok: true as const, id: row.id };
    inFlightRef.current += 1;
    setPending(true);
    try {
      const result = await saveSheetRowAction(row);
      if (!result.ok) {
        setStatus(result.error || "Save failed");
        return result;
      }
      if (result.id && result.id !== row.id) {
        setRows((prev) => {
          const next = prev.map((r) => (r.id === row.id ? { ...r, id: result.id! } : r));
          rowsRef.current = next;
          return next;
        });
      }
      setStatus("Saved");
      window.setTimeout(() => setStatus(""), 1200);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setStatus(message);
      return { ok: false as const, error: message };
    } finally {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) setPending(false);
    }
  }

  async function drainPersist(rowId: string) {
    if (savingIdsRef.current.has(rowId)) return;
    savingIdsRef.current.add(rowId);
    try {
      let activeId = rowId;
      while (dirtyIdsRef.current.has(activeId) || dirtyIdsRef.current.has(rowId)) {
        dirtyIdsRef.current.delete(activeId);
        dirtyIdsRef.current.delete(rowId);
        const current =
          rowsRef.current.find((r) => r.id === activeId) ||
          rowsRef.current.find((r) => r.id === rowId);
        if (!current) break;
        const result = await writeRow(current);
        if (!result.ok) {
          dirtyIdsRef.current.add(current.id);
          break;
        }
        if (result.id) activeId = result.id;
      }
    } finally {
      savingIdsRef.current.delete(rowId);
      savingIdsRef.current.delete(
        rowsRef.current.find((r) => r.id === rowId)?.id || rowId,
      );
    }
  }

  async function flushDirtyRows() {
    const ids = [...dirtyIdsRef.current];
    await Promise.all(ids.map((id) => drainPersist(id)));
  }

  function queuePersist(rowId: string) {
    dirtyIdsRef.current.add(rowId);
    void drainPersist(rowId);
  }

  function patchRow(rowId: string, patch: Partial<SheetRow>, save: boolean) {
    setRows((prev) => {
      const nextRows = prev.map((row) => {
        if (row.id !== rowId) return row;
        return applyRowRules(row, patch);
      });
      rowsRef.current = nextRows;
      return nextRows;
    });

    // Always track dirty so refresh can't silently drop typed-but-not-blurred cells.
    dirtyIdsRef.current.add(rowId);
    if (save) queuePersist(rowId);
  }

  function onPartsChange(rowId: string, value: string, workSource: string) {
    const patch: Partial<SheetRow> = { parts: value };
    if (isOwnWork(workSource)) {
      const cost = partCostByName.get(value);
      if (cost != null && cost !== "") {
        patch.partsCost = cost;
      }
    } else {
      patch.partsCost = "";
    }
    patchRow(rowId, patch, true);
  }

  function selectOptions(
    kind: "payment" | "status" | "technician" | "parts" | "leadSource" | "workSource" | "partner" | undefined,
  ) {
    if (kind === "workSource") return ["", ...WORK_SOURCES];
    if (kind === "payment") return [...PAYMENT_TYPES];
    if (kind === "status") return [...JOB_STATUSES];
    if (kind === "technician") return techOptions;
    if (kind === "parts") return partNames;
    if (kind === "leadSource") return ["", ...LEAD_SOURCES];
    if (kind === "partner") {
      const set = new Set<string>(partners.filter(Boolean));
      for (const row of rows) {
        if (row.partnerName.trim()) set.add(row.partnerName.trim());
      }
      return ["", ...[...set].sort((a, b) => a.localeCompare(b))];
    }
    return [""];
  }

  const leadSourceSuggestions = useMemo(() => {
    const set = new Set<string>(LEAD_SOURCES);
    for (const row of rows) {
      if (row.leadSource.trim()) set.add(row.leadSource.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const partnerSuggestions = useMemo(() => {
    const set = new Set<string>(partners.filter(Boolean));
    for (const row of rows) {
      if (row.partnerName.trim()) set.add(row.partnerName.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [partners, rows]);

  const displayRows = useMemo(() => {
    const filled = rows.filter(rowHasWork);
    const blanks = rows.filter((row) => !rowHasWork(row));
    filled.sort((a, b) => {
      const da = dateSortValue(a);
      const db = dateSortValue(b);
      if (da === db) return 0;
      return dateSort === "newest" ? (da < db ? 1 : -1) : da < db ? -1 : 1;
    });
    return [...filled, ...blanks];
  }, [rows, dateSort]);

  return (
    <div>
      <datalist id={LEAD_SOURCE_LIST_ID}>
        {leadSourceSuggestions.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <datalist id={PARTNER_LIST_ID}>
        {partnerSuggestions.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <div className="sheet-table-bar">
        <div className="sheet-status">{pending ? "Saving…" : status}</div>
        <label className="sheet-sort">
          Date
          <select
            value={dateSort}
            onChange={(e) =>
              changeDateSort(e.target.value === "oldest" ? "oldest" : "newest")
            }
          >
            <option value="newest">Newest on top</option>
            <option value="oldest">Oldest on top</option>
          </select>
        </label>
      </div>
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
                  {col.key === "date" ? (
                    <button
                      type="button"
                      className="sheet-sort-head"
                      onClick={() =>
                        changeDateSort(dateSort === "newest" ? "oldest" : "newest")
                      }
                      title={
                        dateSort === "newest"
                          ? "Newest on top — click for oldest"
                          : "Oldest on top — click for newest"
                      }
                    >
                      <span className="sheet-col-letter">{String.fromCharCode(65 + idx)}</span>
                      <span className="sheet-col-label">
                        Date {dateSort === "newest" ? "↓" : "↑"}
                      </span>
                    </button>
                  ) : (
                    <>
                      <span className="sheet-col-letter">{String.fromCharCode(65 + idx)}</span>
                      <span className="sheet-col-label">
                        {col.money ? `$ ${col.label}` : col.label}
                      </span>
                    </>
                  )}
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
                <span className="sheet-col-label">$ Clear profit</span>
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
                isColumnEditable(row.workSource, "checkNumber") &&
                isCheckPayment(row.paymentType) &&
                !String(row.checkNumber).trim();
              const cardPay =
                isOwnWork(row.workSource) && isCardPayment(row.paymentType);
              const sourcePicked = Boolean(normalizeWorkSource(row.workSource));

              return (
                <tr
                  key={row.id}
                  className={
                    !sourcePicked
                      ? "sheet-row-need-source"
                      : isPartnerWork(row.workSource)
                        ? "sheet-row-partner"
                        : "sheet-row-own"
                  }
                >
                  <th className="sheet-row-num">{rowIndex + 1}</th>
                  {COLUMNS.map((col) => {
                    const editable = isColumnEditable(row.workSource, col.key);
                    const needBankEmpty =
                      col.key === "bankFee" && cardPay && !String(row.bankFee).trim();
                    const bankActive = col.key === "bankFee" && cardPay;
                    const cellClass = cellMutedClass(
                      row.workSource,
                      col.key,
                      needCheck && col.key === "checkNumber"
                        ? "sheet-cell-need"
                        : needBankEmpty
                          ? "sheet-cell-need"
                          : bankActive
                            ? "sheet-cell-bank"
                            : col.key === "jobStatus" && editable
                              ? statusClass(row.jobStatus)
                              : undefined,
                    );

                    if (col.kind === "select") {
                      const isWorkSource = col.key === "workSource";
                      return (
                        <td
                          key={col.key}
                          className={[cellClass, isWorkSource ? "sheet-cell-work-source" : ""]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <select
                            className="sheet-cell sheet-select"
                            value={row[col.key]}
                            disabled={!editable && !isWorkSource}
                            tabIndex={editable || isWorkSource ? 0 : -1}
                            onMouseDown={(e) => {
                              if (isWorkSource) e.stopPropagation();
                            }}
                            onChange={(e) => {
                              if (!editable && !isWorkSource) return;
                              if (col.key === "parts") {
                                onPartsChange(row.id, e.target.value, row.workSource);
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
                        <td key={col.key} className={cellClass}>
                          <input
                            className="sheet-cell sheet-combo"
                            list={
                              col.key === "partnerName"
                                ? PARTNER_LIST_ID
                                : col.options === "leadSource"
                                  ? LEAD_SOURCE_LIST_ID
                                  : undefined
                            }
                            value={row[col.key]}
                            placeholder={editable ? "Pick or type…" : ""}
                            disabled={!editable}
                            readOnly={!editable}
                            tabIndex={editable ? 0 : -1}
                            onChange={(e) => {
                              if (!editable) return;
                              patchRow(row.id, { [col.key]: e.target.value }, false);
                            }}
                            onBlur={() => {
                              if (!editable) return;
                              queuePersist(row.id);
                            }}
                          />
                        </td>
                      );
                    }

                    if (col.kind === "date") {
                      return (
                        <td key={col.key} className={cellClass}>
                          <input
                            className="sheet-cell sheet-date"
                            type="date"
                            value={toDateInputValue(row.date)}
                            disabled={!editable}
                            tabIndex={editable ? 0 : -1}
                            onChange={(e) => {
                              if (!editable) return;
                              patchRow(row.id, { date: e.target.value || todayISO() }, true);
                            }}
                          />
                        </td>
                      );
                    }

                    const isComputedPartnerSalary =
                      col.key === "techSalary" && isPartnerWork(row.workSource);
                    const isMoney = col.money || MONEY_KEYS.has(col.key);

                    return (
                      <td key={col.key} className={cellClass}>
                        <div className={isMoney ? "sheet-money" : undefined}>
                          {isMoney ? <span className="sheet-money-prefix">$</span> : null}
                          <input
                            className="sheet-cell"
                            value={
                              isComputedPartnerSalary
                                ? row.techSalary || partnerTechSalary(row.jobCost)
                                : row[col.key]
                            }
                            disabled={!editable}
                            readOnly={!editable || isComputedPartnerSalary}
                            tabIndex={editable ? 0 : -1}
                            inputMode={isMoney ? "decimal" : undefined}
                            onChange={(e) => {
                              if (!editable || isComputedPartnerSalary) return;
                              const raw = e.target.value;
                              const next = isMoney ? raw.replace(/[^0-9.-]/g, "") : raw;
                              patchRow(row.id, { [col.key]: next }, false);
                            }}
                            onBlur={() => {
                              if (!editable || isComputedPartnerSalary) return;
                              queuePersist(row.id);
                            }}
                            placeholder={
                              col.key === "checkNumber" && needCheck
                                ? "Required"
                                : col.key === "bankFee" && cardPay
                                  ? "3.5%"
                                  : col.key === "techSalary" && isPartnerWork(row.workSource)
                                    ? "30% Gross"
                                    : isMoney
                                      ? "0.00"
                                      : ""
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td
                    className={
                      sourcePicked ? "sheet-profit" : "sheet-profit sheet-cell-muted"
                    }
                  >
                    <div className="sheet-money">
                      <input
                        className="sheet-cell"
                        value={clearProfitFor(row)}
                        readOnly
                        tabIndex={-1}
                      />
                    </div>
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
