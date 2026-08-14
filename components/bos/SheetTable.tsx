"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddressAutocomplete } from "@/components/bos/AddressAutocomplete";
import { ClientAutocomplete } from "@/components/bos/ClientAutocomplete";
import { useBosLiveRefresh } from "@/lib/realtime/useBosLiveRefresh";
import { SHEET_STATUSES, completeBlockedReason } from "@/lib/leads/stage-sync";
import { FIELD_SERVICE_NAMES } from "@/lib/field/services-catalog";
import {
  WORK_SOURCES,
  PARTNER_TECH_RATE,
  isColumnEditable,
  isOwnWork,
  isPartnerWork,
  normalizeWorkSource,
  partnerHasOwnStock,
  usesOurParts,
  type SheetColumnKey,
  type SheetPartner,
} from "@/lib/sheet/work-source";

export type SheetRow = {
  id: string;
  clientKey?: string;
  jobNumber: string;
  workSource: string;
  partnerName: string;
  leadSource: string;
  leadCost: string;
  date: string;
  clientName: string;
  clientAddress: string;
  jobStatus: string;
  jobType: string;
  service: string;
  parts: string;
  paymentType: string;
  checkNumber: string;
  jobCost: string;
  bankFee: string;
  partsCost: string;
  technician: string;
  techSalary: string;
  description: string;
};

export type StockPartOption = {
  name: string;
  unitCost: string;
  /** On-hand qty for this catalog (GG or a partner warehouse). */
  qty?: number;
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
  options?: "payment" | "status" | "technician" | "parts" | "leadSource" | "workSource" | "partner" | "service";
  money?: boolean;
}> = [
  { key: "date", label: "Date", width: 130, kind: "date" },
  { key: "jobNumber", label: "Job #", width: 110 },
  { key: "workSource", label: "Work source", width: 130, kind: "select", options: "workSource" },
  { key: "partnerName", label: "Partner", width: 160, kind: "select", options: "partner" },
  { key: "leadSource", label: "Lead source", width: 140, kind: "combo", options: "leadSource" },
  { key: "leadCost", label: "Lead cost", width: 100, money: true },
  { key: "clientName", label: "Client name", width: 150 },
  { key: "clientAddress", label: "Address", width: 200 },
  { key: "jobStatus", label: "Status", width: 140, kind: "select", options: "status" },
  { key: "jobType", label: "Issue", width: 180 },
  { key: "service", label: "Service", width: 200, kind: "select", options: "service" },
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
  { key: "description", label: "Description", width: 220 },
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
  const id = `new-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    clientKey: id,
    jobNumber: "",
    workSource: "",
    partnerName: "",
    leadSource: "",
    leadCost: "",
    date: todayISO(),
    clientName: "",
    clientAddress: "",
    jobStatus: "",
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
}

function clearProfitFor(row: SheetRow, partners: SheetPartner[]): string {
  if (isPartnerWork(row.workSource)) {
    const has = money(row.jobCost) || money(row.techSalary) || money(row.partsCost);
    if (!has) return "";
    if (partnerHasOwnStock(row.partnerName, partners)) {
      return formatMoney(0);
    }
    return formatMoney(money(row.jobCost) - money(row.techSalary) - money(row.partsCost));
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

function applyRowRules(row: SheetRow, patch: Partial<SheetRow>, partners: SheetPartner[]): SheetRow {
  const next = { ...row, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "workSource")) {
    next.workSource = normalizeWorkSource(next.workSource);
  }

  const paymentChanged = Object.prototype.hasOwnProperty.call(patch, "paymentType");
  const jobCostChanged = Object.prototype.hasOwnProperty.call(patch, "jobCost");
  const sourceChanged = Object.prototype.hasOwnProperty.call(patch, "workSource");
  const partnerChanged = Object.prototype.hasOwnProperty.call(patch, "partnerName");
  const partsChanged = Object.prototype.hasOwnProperty.call(patch, "parts");
  const ownStock =
    isPartnerWork(next.workSource) && partnerHasOwnStock(next.partnerName, partners);

  if (isOwnWork(next.workSource)) {
    if (isCardPayment(next.paymentType) && (paymentChanged || jobCostChanged || sourceChanged)) {
      next.bankFee = bankFeeFor(next.jobCost);
    }
  }

  if (isPartnerWork(next.workSource)) {
    if (jobCostChanged || sourceChanged) {
      next.techSalary = partnerTechSalary(next.jobCost);
    }
    if (ownStock && (sourceChanged || partnerChanged || partsChanged)) {
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
    row.service,
    row.parts,
    row.paymentType,
    row.checkNumber,
    row.jobCost,
    row.bankFee,
    row.partsCost,
    row.technician,
    row.techSalary,
    row.description,
  ].some((v) => String(v || "").trim());
}

function dateSortValue(row: SheetRow): string {
  return toDateInputValue(row.date) || "";
}

function rowKey(row: Pick<SheetRow, "id" | "clientKey">): string {
  return row.clientKey || row.id;
}

type SheetSaveResult = { ok: true; id?: string; jobNumber?: string } | { ok: false; error: string };

async function postSheetRow(row: SheetRow): Promise<SheetSaveResult> {
  const res = await fetch("/api/sheet/row", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    id?: string;
    error?: string;
    jobNumber?: string;
  } | null;
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || `Save failed (${res.status})` };
  }
  return { ok: true, id: data.id, jobNumber: data.jobNumber || "" };
}

async function deleteSheetRow(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/sheet/row?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || `Delete failed (${res.status})` };
  }
  return { ok: true };
}

/** Survives Next.js remounts on the same tab so in-progress rows aren't wiped. */
let liveRowsCache: SheetRow[] | null = null;

function withClientKeys(rows: SheetRow[]): SheetRow[] {
  return rows.map((r) => ({
    ...r,
    clientKey: r.clientKey || r.id,
    workSource: normalizeWorkSource(r.workSource) || r.workSource || "",
    date: toDateInputValue(r.date),
  }));
}

function mergeLiveRows(live: SheetRow[], server: SheetRow[]): SheetRow[] {
  const serverById = new Map(
    server.filter((row) => !row.id.startsWith("new-")).map((row) => [row.id, row]),
  );
  const out: SheetRow[] = [];
  for (const row of live) {
    if (row.id.startsWith("new-")) {
      if (rowHasWork(row)) out.push(row);
      continue;
    }
    const fromServer = serverById.get(row.id);
    serverById.delete(row.id);
    if (!fromServer) {
      out.push(row);
      continue;
    }
    out.push({
      ...row,
      jobNumber: row.jobNumber || fromServer.jobNumber,
    });
  }
  for (const leftover of serverById.values()) {
    out.push(leftover);
  }
  return out;
}

function seedRows(initialRows: SheetRow[]): SheetRow[] {
  const seeded = withClientKeys(initialRows);
  if (!liveRowsCache?.length) return seeded;
  return mergeLiveRows(liveRowsCache, seeded);
}

function rememberRows(rows: SheetRow[]) {
  liveRowsCache = rows;
}

function cellMutedClass(
  workSource: string,
  key: SheetColumnKey,
  extra?: string,
  opts?: { usesOurParts?: boolean },
) {
  const editable = isColumnEditable(workSource, key, opts);
  const parts = [extra];
  if (!editable) parts.push("sheet-cell-muted");
  return parts.filter(Boolean).join(" ") || undefined;
}

export function SheetTable({
  rows: initialRows,
  technicians,
  stockParts = [],
  partnerStockParts = {},
  partners = [],
}: {
  rows: SheetRow[];
  technicians: string[];
  stockParts?: StockPartOption[];
  /** Parts + on-hand qty keyed by partner display name (own-stock partners). */
  partnerStockParts?: Record<string, StockPartOption[]>;
  partners?: SheetPartner[];
}) {
  useBosLiveRefresh(["leads", "jobs"]);
  const [rows, setRows] = useState<SheetRow[]>(() => seedRows(initialRows));
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [freezeOrder, setFreezeOrder] = useState(false);
  const frozenIdsRef = useRef<string[] | null>(null);
  const focusGenRef = useRef(0);
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths);
  const dragRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const rowsRef = useRef(rows);
  const inFlightRef = useRef(0);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const savingIdsRef = useRef<Set<string>>(new Set());

  const persistTimersRef = useRef<Map<string, number>>(new Map());
  const pendingDrainRef = useRef<Set<string>>(new Set());
  const releaseQueuedRef = useRef(false);
  const initialRowsRef = useRef(initialRows);

  useEffect(() => {
    rowsRef.current = rows;
    rememberRows(rows);
  }, [rows]);

  useEffect(() => {
    // Soft-merge server snapshot (Meta/website inserts, other tabs) without wiping edits.
    if (initialRowsRef.current === initialRows) return;
    initialRowsRef.current = initialRows;
    setRows((prev) => {
      const next = mergeLiveRows(prev, withClientKeys(initialRows));
      rowsRef.current = next;
      rememberRows(next);
      return next;
    });
  }, [initialRows]);

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
    frozenIdsRef.current = null;
    setFreezeOrder(false);
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

  const partnerPartsByName = useMemo(() => {
    const map = new Map<string, StockPartOption[]>();
    for (const [name, parts] of Object.entries(partnerStockParts)) {
      const key = name.trim().toLowerCase();
      if (!key) continue;
      map.set(key, parts);
    }
    return map;
  }, [partnerStockParts]);

  function partLabel(name: string, qty: number | undefined): string {
    if (!name) return "—";
    if (qty == null || !Number.isFinite(qty)) return name;
    return `${name} (${qty})`;
  }

  function partsOptionsForRow(row: SheetRow): Array<{ value: string; label: string }> {
    const ownStock =
      isPartnerWork(row.workSource) && partnerHasOwnStock(row.partnerName, partners);
    const catalog = ownStock
      ? partnerPartsByName.get(row.partnerName.trim().toLowerCase()) || []
      : stockParts;
    const byName = new Map<string, StockPartOption>();
    for (const part of catalog) {
      if (part.name) byName.set(part.name, part);
    }
    if (row.parts.trim() && !byName.has(row.parts.trim())) {
      byName.set(row.parts.trim(), { name: row.parts.trim(), unitCost: "" });
    }
    const names = [...byName.keys()].sort((a, b) => a.localeCompare(b));
    return [
      { value: "", label: "—" },
      ...names.map((name) => ({
        value: name,
        label: partLabel(name, byName.get(name)?.qty),
      })),
    ];
  }

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
    const key = rowKey(row);
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
      row.service,
      row.parts,
      row.paymentType,
      row.checkNumber,
      row.jobCost,
      row.bankFee,
      row.partsCost,
      row.technician,
      row.techSalary,
      row.description,
    ].some((v) => String(v || "").trim());

    if (isTemp && !hasContent) {
      dirtyIdsRef.current.delete(key);
      setRows((prev) => prev.filter((r) => rowKey(r) !== key));
      return;
    }

    const label = row.clientName.trim() || row.clientAddress.trim() || "this row";
    const msg = isTemp
      ? `Remove this unsaved row?`
      : `Delete ${label} from Sheet and the whole system?\n\nThis removes the lead, related jobs, invoices, inbox items, and chat. Cannot be undone.`;
    if (!window.confirm(msg)) return;

    dirtyIdsRef.current.delete(key);
    setRows((prev) => prev.filter((r) => rowKey(r) !== key));
    if (isTemp) return;

    void (async () => {
      setPending(true);
      const result = await deleteSheetRow(row.id);
      setPending(false);
      if (!result.ok) {
        setStatus(result.error || "Delete failed");
        setRows((prev) => {
          if (prev.some((r) => rowKey(r) === key || r.id === row.id)) return prev;
          return [...prev, row];
        });
        return;
      }
      setStatus("Deleted");
      window.setTimeout(() => setStatus(""), 1200);
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
      row.service,
      row.parts,
      row.paymentType,
      row.checkNumber,
      row.jobCost,
      row.bankFee,
      row.partsCost,
      row.technician,
      row.techSalary,
      row.description,
    ].some((v) => String(v || "").trim());
  }

  async function writeRow(row: SheetRow) {
    if (!rowWorthSaving(row)) return { ok: true as const, id: row.id, jobNumber: row.jobNumber };
    inFlightRef.current += 1;
    setPending(true);
    try {
      const result = await postSheetRow(row);
      if (!result.ok) {
        setStatus(result.error || "Save failed");
        return result;
      }
      const nextId = result.id || row.id;
      const nextJob = result.jobNumber || "";
      if (nextId !== row.id || (nextJob && nextJob !== row.jobNumber)) {
        setRows((prev) => {
          const next = prev.map((r) => {
            if (rowKey(r) !== rowKey(row) && r.id !== row.id) return r;
            return { ...r, id: nextId, jobNumber: nextJob || r.jobNumber };
          });
          rowsRef.current = next;
          rememberRows(next);
          return next;
        });
        if (frozenIdsRef.current) {
          frozenIdsRef.current = frozenIdsRef.current.map((id) =>
            id === row.id || id === rowKey(row) ? rowKey(row) : id,
          );
        }
      }
      setStatus("Saved");
      window.setTimeout(() => setStatus(""), 1200);
      return { ok: true as const, id: nextId, jobNumber: nextJob };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setStatus(message);
      return { ok: false as const, error: message };
    } finally {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) setPending(false);
    }
  }

  async function drainPersist(key: string) {
    if (savingIdsRef.current.has(key)) {
      pendingDrainRef.current.add(key);
      return;
    }
    savingIdsRef.current.add(key);
    try {
      do {
        dirtyIdsRef.current.delete(key);
        pendingDrainRef.current.delete(key);
        const current = rowsRef.current.find((r) => rowKey(r) === key || r.id === key);
        if (!current) break;
        const result = await writeRow(current);
        if (!result.ok) {
          dirtyIdsRef.current.add(key);
          break;
        }
      } while (dirtyIdsRef.current.has(key) || pendingDrainRef.current.has(key));
    } finally {
      savingIdsRef.current.delete(key);
      if (dirtyIdsRef.current.has(key) || pendingDrainRef.current.has(key)) {
        void drainPersist(key);
      } else if (releaseQueuedRef.current) {
        releaseRowOrder();
      }
    }
  }

  async function flushDirtyRows() {
    for (const timer of persistTimersRef.current.values()) window.clearTimeout(timer);
    persistTimersRef.current.clear();
    const ids = new Set([...dirtyIdsRef.current, ...pendingDrainRef.current]);
    await Promise.all([...ids].map((id) => drainPersist(id)));
  }

  function queuePersist(key: string) {
    dirtyIdsRef.current.add(key);
    const prev = persistTimersRef.current.get(key);
    if (prev) window.clearTimeout(prev);
    const t = window.setTimeout(() => {
      persistTimersRef.current.delete(key);
      void drainPersist(key);
    }, 400);
    persistTimersRef.current.set(key, t);
  }

  function queuePersistNow(key: string) {
    dirtyIdsRef.current.add(key);
    const prev = persistTimersRef.current.get(key);
    if (prev) window.clearTimeout(prev);
    persistTimersRef.current.delete(key);
    void drainPersist(key);
  }

  function patchRow(rowId: string, patch: Partial<SheetRow>, save: boolean) {
    let key = rowId;
    setRows((prev) => {
      const nextRows = prev.map((row) => {
        if (rowKey(row) !== rowId && row.id !== rowId) return row;
        key = rowKey(row);
        const next = applyRowRules(row, patch, partners);
        if (
          usesOurParts(next.workSource, next.partnerName, partners) &&
          (Object.prototype.hasOwnProperty.call(patch, "parts") ||
            Object.prototype.hasOwnProperty.call(patch, "workSource") ||
            Object.prototype.hasOwnProperty.call(patch, "partnerName"))
        ) {
          const cost = partCostByName.get(next.parts);
          if (cost != null && cost !== "") next.partsCost = cost;
        }
        return next;
      });
      rowsRef.current = nextRows;
      rememberRows(nextRows);
      return nextRows;
    });

    dirtyIdsRef.current.add(key);
    if (save) queuePersist(key);
  }

  function onPartsChange(rowId: string, value: string, row: SheetRow) {
    const patch: Partial<SheetRow> = { parts: value };
    if (usesOurParts(row.workSource, row.partnerName, partners)) {
      const cost = partCostByName.get(value);
      if (cost != null && cost !== "") {
        patch.partsCost = cost;
      }
    } else if (isPartnerWork(row.workSource)) {
      patch.partsCost = "";
    }
    patchRow(rowId, patch, true);
  }

  async function addNewRow() {
    if (pending) return;
    const draft: SheetRow = {
      ...emptyRow(Date.now()),
      workSource: "Garage Guys",
      jobStatus: "Waiting",
      date: todayISO(),
    };
    releaseQueuedRef.current = false;
    frozenIdsRef.current = null;
    setFreezeOrder(false);
    setRows((prev) => {
      const next = [draft, ...prev];
      rowsRef.current = next;
      rememberRows(next);
      return next;
    });
    dirtyIdsRef.current.add(rowKey(draft));
    setPending(true);
    setStatus("Creating…");
    try {
      const result = await postSheetRow(draft);
      if (!result.ok) {
        setStatus(result.error || "Could not create row");
        setRows((prev) => {
          const next = prev.filter((r) => rowKey(r) !== rowKey(draft));
          rowsRef.current = next;
          rememberRows(next);
          return next;
        });
        dirtyIdsRef.current.delete(rowKey(draft));
        return;
      }
      const nextId = result.id || draft.id;
      const nextJob = result.jobNumber || "";
      setRows((prev) => {
        const next = prev.map((r) =>
          rowKey(r) === rowKey(draft)
            ? { ...r, id: nextId, jobNumber: nextJob || r.jobNumber }
            : r,
        );
        rowsRef.current = next;
        rememberRows(next);
        return next;
      });
      dirtyIdsRef.current.delete(rowKey(draft));
      setStatus(nextJob ? `Saved · ${nextJob}` : "Saved");
      window.setTimeout(() => setStatus(""), 1600);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create row";
      setStatus(message);
      setRows((prev) => {
        const next = prev.filter((r) => rowKey(r) !== rowKey(draft));
        rowsRef.current = next;
        rememberRows(next);
        return next;
      });
      dirtyIdsRef.current.delete(rowKey(draft));
    } finally {
      setPending(false);
    }
  }

  function selectOptions(
    kind: "payment" | "status" | "technician" | "parts" | "leadSource" | "workSource" | "partner" | "service" | undefined,
  ) {
    if (kind === "workSource") return ["", ...WORK_SOURCES];
    if (kind === "payment") return [...PAYMENT_TYPES];
    if (kind === "status") return [...JOB_STATUSES];
    if (kind === "technician") return techOptions;
    if (kind === "parts") return [];
    if (kind === "service") {
      const set = new Set<string>(FIELD_SERVICE_NAMES);
      for (const row of rows) {
        if (row.service.trim()) set.add(row.service.trim());
      }
      return ["", ...[...set].sort((a, b) => a.localeCompare(b))];
    }
    if (kind === "leadSource") return ["", ...LEAD_SOURCES];
    if (kind === "partner") {
      const set = new Set<string>(partners.map((p) => p.name).filter(Boolean));
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
    const set = new Set<string>(partners.map((p) => p.name).filter(Boolean));
    for (const row of rows) {
      if (row.partnerName.trim()) set.add(row.partnerName.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [partners, rows]);

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      const da = dateSortValue(a);
      const db = dateSortValue(b);
      if (da === db) return 0;
      return dateSort === "newest" ? (da < db ? 1 : -1) : da < db ? -1 : 1;
    });
    return next;
  }, [rows, dateSort]);

  const displayRows = useMemo(() => {
    const ids = freezeOrder ? frozenIdsRef.current : null;
    if (!ids?.length) return sortedRows;
    const byKey = new Map<string, SheetRow>();
    for (const row of rows) {
      byKey.set(rowKey(row), row);
      byKey.set(row.id, row);
    }
    const locked = ids.map((id) => byKey.get(id)).filter((row): row is SheetRow => Boolean(row));
    const lockedSet = new Set(locked.map((row) => rowKey(row)));
    const extras = sortedRows.filter((row) => !lockedSet.has(rowKey(row)));
    return [...locked, ...extras];
  }, [sortedRows, rows, freezeOrder]);

  function freezeRowOrder() {
    focusGenRef.current += 1;
    if (freezeOrder) return;
    frozenIdsRef.current = displayRows.map((row) => rowKey(row));
    setFreezeOrder(true);
  }

  function releaseRowOrder() {
    if (dirtyIdsRef.current.size > 0 || inFlightRef.current > 0) {
      releaseQueuedRef.current = true;
      return;
    }
    releaseQueuedRef.current = false;
    frozenIdsRef.current = null;
    setFreezeOrder(false);
  }

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
        <div className="sheet-table-bar-left">
          <button
            type="button"
            className="emp-add-btn"
            onClick={() => void addNewRow()}
            disabled={pending}
          >
            + Add row
          </button>
          <div className="sheet-status">{pending ? "Saving…" : status}</div>
        </div>
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
              const colOpts = {
                usesOurParts: usesOurParts(row.workSource, row.partnerName, partners),
              };
              const needCheck =
                isColumnEditable(row.workSource, "checkNumber", colOpts) &&
                isCheckPayment(row.paymentType) &&
                !String(row.checkNumber).trim();
              const cardPay =
                isOwnWork(row.workSource) && isCardPayment(row.paymentType);
              const sourcePicked = Boolean(normalizeWorkSource(row.workSource));

              return (
                <tr
                  key={rowKey(row)}
                  className={
                    !sourcePicked
                      ? "sheet-row-need-source"
                      : isPartnerWork(row.workSource)
                        ? "sheet-row-partner"
                        : "sheet-row-own"
                  }
                  onFocusCapture={freezeRowOrder}
                  onBlurCapture={(e) => {
                    const next = e.relatedTarget as Node | null;
                    if (next && e.currentTarget.contains(next)) return;
                    const gen = focusGenRef.current;
                    window.setTimeout(() => {
                      if (focusGenRef.current !== gen) return;
                      releaseRowOrder();
                    }, 200);
                  }}
                >
                  <th className="sheet-row-num">{rowIndex + 1}</th>
                  {COLUMNS.map((col) => {
                    const editable = isColumnEditable(row.workSource, col.key, colOpts);
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
                      colOpts,
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
                                onPartsChange(row.id, e.target.value, row);
                                return;
                              }
                              if (col.key === "jobStatus") {
                                const blocked = completeBlockedReason(e.target.value, row.jobCost);
                                if (blocked) {
                                  setStatus(blocked);
                                  e.target.value = row.jobStatus;
                                  return;
                                }
                              }
                              patchRow(row.id, { [col.key]: e.target.value }, true);
                            }}
                          >
                            {col.key === "parts"
                              ? partsOptionsForRow(row).map((opt) => (
                                  <option key={opt.value || `${col.key}-empty`} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))
                              : selectOptions(col.options).map((opt) => (
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
                              queuePersistNow(rowKey(row));
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

                    if (col.key === "clientName") {
                      return (
                        <td key={col.key} className={`${cellClass || ""} sheet-name-cell`.trim()}>
                          <ClientAutocomplete
                            className="sheet-cell"
                            value={row.clientName}
                            disabled={!editable}
                            readOnly={!editable}
                            placeholder={editable ? "Type name…" : ""}
                            onChange={(value) => {
                              if (!editable) return;
                              patchRow(row.id, { clientName: value }, false);
                            }}
                            onSelect={(client) => {
                              if (!editable) return;
                              patchRow(
                                row.id,
                                {
                                  clientName: client.name,
                                  ...(client.address ? { clientAddress: client.address } : {}),
                                },
                                true,
                              );
                            }}
                            onBlur={() => {
                              if (!editable) return;
                              queuePersistNow(rowKey(row));
                            }}
                          />
                        </td>
                      );
                    }

                    if (col.key === "clientAddress") {
                      return (
                        <td key={col.key} className={`${cellClass || ""} sheet-addr-cell`.trim()}>
                          <AddressAutocomplete
                            className="sheet-cell"
                            value={row.clientAddress}
                            disabled={!editable}
                            readOnly={!editable}
                            placeholder={editable ? "Start typing address…" : ""}
                            onChange={(value) => {
                              if (!editable) return;
                              patchRow(row.id, { clientAddress: value }, false);
                            }}
                            onSelect={(item) => {
                              if (!editable) return;
                              patchRow(row.id, { clientAddress: item.label }, true);
                            }}
                            onBlur={() => {
                              if (!editable) return;
                              queuePersistNow(rowKey(row));
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
                              queuePersistNow(rowKey(row));
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
                        value={clearProfitFor(row, partners)}
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
    </div>
  );
}
