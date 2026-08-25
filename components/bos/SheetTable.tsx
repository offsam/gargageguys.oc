"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "@/components/bos/AddressAutocomplete";
import { ClientAutocomplete } from "@/components/bos/ClientAutocomplete";
import { SheetPartsPicker } from "@/components/bos/SheetPartsPicker";
import { SheetServicesPicker } from "@/components/bos/SheetServicesPicker";
import { ScheduleLeadModal, type CrmTechnician } from "@/components/bos/ScheduleLeadModal";
import { scheduleCrmLeadAction } from "@/app/actions/crm";
import type { FieldJob } from "@/lib/field/days";
import { useBosLiveRefresh } from "@/lib/realtime/useBosLiveRefresh";
import { SHEET_STATUSES, completeBlockedReason } from "@/lib/leads/stage-sync";
import { FIELD_SERVICES, findFieldServiceByName, isCustomServiceChoice } from "@/lib/field/services-catalog";
import { CustomServiceModal } from "@/components/bos/CustomServiceModal";
import {
  formatPartsLines,
  parsePartsLines,
  partsCostForLines,
  type SheetPartLine,
} from "@/lib/sheet/parts-lines";
import {
  WORK_SOURCES,
  isColumnEditable,
  isOwnWork,
  isPartnerWork,
  normalizeWorkSource,
  partnerHasOwnStock,
  usesOurParts,
  type SheetColumnKey,
  type SheetPartner,
} from "@/lib/sheet/work-source";
import { normalizeSheetTime } from "@/lib/sheet/sync-job-from-sheet";
import {
  findWindowForSheetTime,
  sheetTimeForWindow,
  sheetTimeSelectOptions,
} from "@/lib/schedule/windows";
import {
  busyJobsFromSheetRows,
  mergeScheduleBusyJobs,
} from "@/lib/schedule/sheet-busy";
import {
  formatServiceLines,
  mergeServiceLines,
  parseServiceLines,
  type SheetServiceLine,
} from "@/lib/sheet/service-lines";
import {
  applyServicesPriceToJobCost,
  bankFeeFor,
  clearProfitFor,
  effectiveTechPay,
  formatMoneyUsd as formatMoney,
  parseMoney as money,
  partnerTechSalary,
} from "@/lib/sheet/money";

export type SheetRow = {
  id: string;
  clientKey?: string;
  jobNumber: string;
  workSource: string;
  partnerName: string;
  leadSource: string;
  leadCost: string;
  date: string;
  time: string;
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
  category?: string;
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
const WIDTHS_STORAGE_KEY = "bos-sheet-col-widths-v4";
const SORT_STORAGE_KEY = "bos-sheet-date-sort";
const PERIOD_STORAGE_KEY = "bos-sheet-period-v1";
const LEAD_SOURCE_LIST_ID = "sheet-lead-source-list";
const PARTNER_LIST_ID = "sheet-partner-list";

type SheetPeriod =
  | "week"
  | "month"
  | "last_month"
  | "d60"
  | "d90"
  | "all"
  | "custom";

const PERIOD_OPTIONS: Array<{ id: SheetPeriod; label: string }> = [
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "last_month", label: "Прошлый месяц" },
  { id: "d60", label: "60 дней" },
  { id: "d90", label: "90 дней" },
  { id: "all", label: "Всё" },
  { id: "custom", label: "Период" },
];

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
  kind?: "text" | "select" | "date" | "time" | "combo";
  options?: "payment" | "status" | "technician" | "parts" | "leadSource" | "workSource" | "partner" | "service";
  money?: boolean;
}> = [
  { key: "jobNumber", label: "Job #", width: 110 },
  { key: "workSource", label: "Work source", width: 130, kind: "select", options: "workSource" },
  { key: "partnerName", label: "Partner", width: 160, kind: "select", options: "partner" },
  { key: "leadSource", label: "Lead source", width: 140, kind: "combo", options: "leadSource" },
  { key: "leadCost", label: "Lead cost", width: 100, money: true },
  { key: "clientName", label: "Client name", width: 150 },
  { key: "clientAddress", label: "Address", width: 200 },
  { key: "jobStatus", label: "Status", width: 140, kind: "select", options: "status" },
  { key: "date", label: "Date", width: 130, kind: "date" },
  { key: "time", label: "Time", width: 100, kind: "time" },
  { key: "jobType", label: "Issue", width: 180 },
  { key: "service", label: "Service", width: 200 },
  { key: "parts", label: "Parts", width: 220 },
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

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Week starts Monday. */
function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

function periodRange(
  period: SheetPeriod,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } {
  const today = startOfToday();
  if (period === "all") return { from: null, to: null };
  if (period === "week") {
    const from = startOfWeekMonday(today);
    return { from: ymdLocal(from), to: ymdLocal(today) };
  }
  if (period === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: ymdLocal(from), to: ymdLocal(today) };
  }
  if (period === "last_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: ymdLocal(from), to: ymdLocal(to) };
  }
  if (period === "d60") {
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 59);
    return { from: ymdLocal(from), to: ymdLocal(today) };
  }
  if (period === "d90") {
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89);
    return { from: ymdLocal(from), to: ymdLocal(today) };
  }
  const from = customFrom.trim() || null;
  const to = customTo.trim() || null;
  return { from, to };
}

function rowInPeriod(row: SheetRow, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const date = toDateInputValue(row.date);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function isCardPayment(paymentType: string) {
  return paymentType === "Credit Card";
}

function isCheckPayment(paymentType: string) {
  return paymentType === "Check";
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
    time: "",
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

/** Sort key: date + time (empty time sorts as start of day). */
function dateTimeSortValue(row: SheetRow): string {
  const date = toDateInputValue(row.date) || "";
  if (!date) return "";
  const time = normalizeSheetTime(row.time) || "00:00";
  return `${date}T${time}`;
}

/** Arrival windows — same slots as Schedule (9–11, etc.). */
const SHEET_TIME_OPTIONS = sheetTimeSelectOptions();

function timeOptionsForValue(current: string): Array<{ value: string; label: string }> {
  const normalized = normalizeSheetTime(current);
  const window = findWindowForSheetTime(normalized || current);
  const value = window ? sheetTimeForWindow(window) : normalized;
  if (value && !SHEET_TIME_OPTIONS.some((o) => o.value === value)) {
    return [{ value: "", label: "—" }, { value, label: value }, ...SHEET_TIME_OPTIONS];
  }
  return [{ value: "", label: "—" }, ...SHEET_TIME_OPTIONS];
}

/** Pull HH:mm from Schedule startAt (datetime-local Pacific, not UTC ISO). */
function sheetTimeFromScheduleStart(startAt: string, endAt?: string): string {
  const start = String(startAt || "").trim();
  const end = String(endAt || "").trim();
  const startHm = normalizeSheetTime(start.includes("T") ? start.slice(11, 16) : start);
  const endHm = normalizeSheetTime(end.includes("T") ? end.slice(11, 16) : end);
  if (startHm && endHm) {
    const sh = Number(startHm.slice(0, 2));
    const eh = Number(endHm.slice(0, 2));
    const hit = SHEET_TIME_OPTIONS.find((o) => {
      const w = findWindowForSheetTime(o.value);
      return w && w.startHour === sh && w.endHour === eh;
    });
    if (hit) return hit.value;
  }
  const w = findWindowForSheetTime(startHm);
  return w ? sheetTimeForWindow(w) : startHm;
}

function rowKey(row: Pick<SheetRow, "id" | "clientKey">): string {
  return row.clientKey || row.id;
}

type SheetSaveResult =
  | { ok: true; id?: string; jobNumber?: string; error?: string }
  | { ok: false; error: string; id?: string; jobNumber?: string; jobStatus?: string };

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
    jobStatus?: string;
  } | null;
  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      error: data?.error || `Save failed (${res.status})`,
      id: data?.id,
      jobNumber: data?.jobNumber || "",
      jobStatus: data?.jobStatus,
    };
  }
  return {
    ok: true,
    id: data.id,
    jobNumber: data.jobNumber || "",
    error: data.error,
  };
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
    time: normalizeSheetTime(r.time),
  }));
}

function mergeLiveRows(live: SheetRow[], server: SheetRow[]): SheetRow[] {
  const serverById = new Map(
    server.filter((row) => !row.id.startsWith("new-")).map((row) => [row.id, row]),
  );
  const out: SheetRow[] = [];
  for (const row of live) {
    if (row.id.startsWith("new-")) {
      // Always keep in-progress drafts across live refresh — dropping them mid-edit
      // is what made rows "vanish" after autosave/realtime updates.
      out.push(row);
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

export type SheetServiceOption = {
  name: string;
  unitPrice: string;
};

export function SheetTable({
  rows: initialRows,
  technicians,
  scheduleTechnicians = [],
  scheduleJobs = [],
  stockParts = [],
  partnerStockParts = {},
  partners = [],
  catalogServices = [],
}: {
  rows: SheetRow[];
  technicians: string[];
  /** Profiles with ids — required to schedule onto a tech calendar. */
  scheduleTechnicians?: CrmTechnician[];
  scheduleJobs?: FieldJob[];
  stockParts?: StockPartOption[];
  /** Parts + on-hand qty keyed by partner display name (own-stock partners). */
  partnerStockParts?: Record<string, StockPartOption[]>;
  partners?: SheetPartner[];
  catalogServices?: SheetServiceOption[];
}) {
  useBosLiveRefresh(["leads", "jobs"]);
  const router = useRouter();
  const [schedulePending, startScheduleTransition] = useTransition();
  const [rows, setRows] = useState<SheetRow[]>(() => seedRows(initialRows));
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [period, setPeriod] = useState<SheetPeriod>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [partsPickerRowId, setPartsPickerRowId] = useState<string | null>(null);
  const [servicesPickerRowId, setServicesPickerRowId] = useState<string | null>(null);
  const [armedDeleteKey, setArmedDeleteKey] = useState<string | null>(null);
  const pendingServiceLinesRef = useRef<SheetServiceLine[]>([]);
  const [extraServices, setExtraServices] = useState<SheetServiceOption[]>([]);
  const [customRowId, setCustomRowId] = useState<string | null>(null);
  const [customError, setCustomError] = useState("");
  const [customPending, startCustomTransition] = useTransition();
  const [scheduleRow, setScheduleRow] = useState<SheetRow | null>(null);
  const [scheduleError, setScheduleError] = useState("");
  const scheduleBusyJobs = useMemo(() => {
    const fromSheet = busyJobsFromSheetRows(
      rows,
      scheduleTechnicians,
      scheduleRow?.id,
    );
    return mergeScheduleBusyJobs(scheduleJobs, fromSheet);
  }, [rows, scheduleJobs, scheduleTechnicians, scheduleRow?.id]);
  const scheduleInitialTechId = useMemo(() => {
    if (!scheduleRow?.technician.trim()) return undefined;
    const name = scheduleRow.technician.trim().toLowerCase();
    return scheduleTechnicians.find((t) => t.name.trim().toLowerCase() === name)?.id;
  }, [scheduleRow, scheduleTechnicians]);
  const [headerAside, setHeaderAside] = useState<HTMLElement | null>(null);
  const [freezeOrder, setFreezeOrder] = useState(false);
  const frozenIdsRef = useRef<string[] | null>(null);
  const focusGenRef = useRef(0);
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths);
  const dragRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const rowsRef = useRef(rows);
  const inFlightRef = useRef(0);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const savingIdsRef = useRef<Set<string>>(new Set());
  /** Keep freshly created rows visible even if the active period filter would hide them. */
  const pinnedKeysRef = useRef<Set<string>>(new Set());
  const [pinVersion, setPinVersion] = useState(0);

  const persistTimersRef = useRef<Map<string, number>>(new Map());
  const pendingDrainRef = useRef<Set<string>>(new Set());
  const releaseQueuedRef = useRef(false);
  const initialRowsRef = useRef(initialRows);

  function pinRowKey(key: string) {
    if (!key || pinnedKeysRef.current.has(key)) return;
    pinnedKeysRef.current.add(key);
    setPinVersion((n) => n + 1);
  }

  function isPinnedRow(row: SheetRow) {
    const key = rowKey(row);
    return (
      pinnedKeysRef.current.has(key) ||
      pinnedKeysRef.current.has(row.id) ||
      dirtyIdsRef.current.has(key) ||
      dirtyIdsRef.current.has(row.id)
    );
  }

  useEffect(() => {
    rowsRef.current = rows;
    rememberRows(rows);
  }, [rows]);

  useEffect(() => {
    if (!armedDeleteKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setArmedDeleteKey(null);
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (target?.closest(".sheet-row-num")) return;
      setArmedDeleteKey(null);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [armedDeleteKey]);


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
    setHeaderAside(document.getElementById("bos-header-aside"));
  }, []);

  useEffect(() => {
    setWidths(loadWidths());
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved === "oldest" || saved === "newest") setDateSort(saved);
      const savedPeriod = localStorage.getItem(PERIOD_STORAGE_KEY);
      if (savedPeriod) {
        const parsed = JSON.parse(savedPeriod) as {
          period?: SheetPeriod;
          from?: string;
          to?: string;
        };
        if (PERIOD_OPTIONS.some((p) => p.id === parsed.period)) {
          setPeriod(parsed.period as SheetPeriod);
        }
        if (typeof parsed.from === "string") setCustomFrom(parsed.from);
        if (typeof parsed.to === "string") setCustomTo(parsed.to);
      }
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

  const profitColIndex = COLUMNS.length;
  const tableWidth =
    ROW_NUM_WIDTH +
    COLUMNS.reduce((sum, col) => sum + (widths[col.key] || col.width), 0) +
    (widths.__profit || PROFIT_DEFAULT_WIDTH);

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
      setArmedDeleteKey(null);
      setRows((prev) => prev.filter((r) => rowKey(r) !== key));
      return;
    }

    const label = row.clientName.trim() || row.clientAddress.trim() || "this row";
    const msg = isTemp
      ? `Remove this unsaved row?`
      : `Delete ${label} from Sheet and the whole system?\n\nThis removes the lead, related jobs, invoices, inbox items, and chat. Cannot be undone.`;
    if (!window.confirm(msg)) {
      setArmedDeleteKey(null);
      return;
    }

    dirtyIdsRef.current.delete(key);
    setArmedDeleteKey(null);
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

  function requestSchedule(row: SheetRow) {
    if (!scheduleTechnicians.length) {
      setStatus("Add a technician in Employees before scheduling");
      return;
    }
    setScheduleError("");
    setScheduleRow(row);
  }

  function submitSchedule(input: { technicianId: string; startAt: string; endAt: string }) {
    if (!scheduleRow) return;
    const rowSnapshot = scheduleRow;
    const techName =
      scheduleTechnicians.find((t) => t.id === input.technicianId)?.name || "";
    setScheduleError("");
    startScheduleTransition(async () => {
      let leadId = rowSnapshot.id;
      if (leadId.startsWith("new-")) {
        const saved = await writeRow({ ...rowSnapshot, jobStatus: "Waiting" });
        if (!saved.ok || !saved.id || saved.id.startsWith("new-")) {
          setScheduleError(saved.ok === false ? saved.error : "Save the row before scheduling");
          return;
        }
        leadId = saved.id;
      }

      const fd = new FormData();
      fd.set("leadId", leadId);
      fd.set("technicianId", input.technicianId);
      fd.set("startAt", input.startAt);
      fd.set("endAt", input.endAt);
      const result = await scheduleCrmLeadAction(fd);
      if (!result.ok) {
        setScheduleError(result.error || "Could not schedule");
        return;
      }

      const sheetDate = input.startAt.slice(0, 10);
      const sheetTime = sheetTimeFromScheduleStart(input.startAt, input.endAt);
      const scheduledRow: SheetRow = {
        ...rowSnapshot,
        id: leadId,
        jobStatus: "Scheduled",
        technician: techName || rowSnapshot.technician,
        date: sheetDate || rowSnapshot.date,
        time: sheetTime || rowSnapshot.time,
      };
      pinRowKey(rowKey(scheduledRow));
      if (!leadId.startsWith("new-")) pinRowKey(leadId);
      setRows((prev) => {
        const next = prev.map((r) => {
          if (rowKey(r) !== rowKey(rowSnapshot) && r.id !== rowSnapshot.id && r.id !== leadId) {
            return r;
          }
          return scheduledRow;
        });
        rowsRef.current = next;
        rememberRows(next);
        return next;
      });
      // Persist through Sheet save so Time/Date/Tech survive refresh (not only CRM metadata).
      await writeRow(scheduledRow);
      setScheduleRow(null);
      setStatus(
        sheetTime
          ? `Scheduled · ${findWindowForSheetTime(sheetTime)?.label || sheetTime}`
          : "Scheduled",
      );
      window.setTimeout(() => setStatus(""), 1600);
      router.refresh();
    });
  }

  async function writeRow(row: SheetRow) {
    if (!rowWorthSaving(row)) return { ok: true as const, id: row.id, jobNumber: row.jobNumber };
    inFlightRef.current += 1;
    setPending(true);
    try {
      const result = await postSheetRow(row);
      if (!result.ok) {
        setStatus(result.error || "Save failed");
        if (result.jobStatus != null) {
          setRows((prev) => {
            const next = prev.map((r) =>
              rowKey(r) === rowKey(row) || r.id === row.id
                ? { ...r, jobStatus: result.jobStatus || r.jobStatus }
                : r,
            );
            rowsRef.current = next;
            rememberRows(next);
            return next;
          });
        }
        return result;
      }
      const nextId = result.id || row.id;
      const nextJob = result.jobNumber || "";
      if (nextId !== row.id || (nextJob && nextJob !== row.jobNumber)) {
        pinRowKey(rowKey(row));
        if (!String(nextId).startsWith("new-")) pinRowKey(nextId);
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
      const completed = row.jobStatus.trim() === "Completed" && Boolean(row.parts.trim());
      if (result.error) {
        setStatus(`Saved with warning: ${result.error}`);
      } else {
        setStatus(completed ? "Saved · stock updated" : "Saved");
      }
      window.setTimeout(() => setStatus(""), result.error ? 2800 : 1200);
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

  function applyServiceLines(
    rowId: string,
    lines: SheetServiceLine[],
    row: SheetRow,
    priceOverrides?: Map<string, number>,
  ) {
    const value = formatServiceLines(lines);
    const prevLines = parseServiceLines(undefined, row.service);
    const prices = new Map(servicePriceByName);
    if (priceOverrides) {
      for (const [key, amount] of priceOverrides) prices.set(key, amount);
    }
    const jobCost = applyServicesPriceToJobCost(row.jobCost, prevLines, lines, prices);
    patchRow(rowId, { service: value, jobCost }, true);
    for (const line of lines) rememberService(line.name);
  }

  function appendCustomService(
    rowId: string,
    name: string,
    unitPrice?: string,
    pendingLines: SheetServiceLine[] = [],
  ) {
    const row = rowsRef.current.find((r) => rowKey(r) === rowId || r.id === rowId);
    if (!row) return;
    const prev = parseServiceLines(undefined, row.service);
    const lines = mergeServiceLines([...prev, ...pendingLines, { name, qty: 1 }]);
    const overrides = new Map<string, number>();
    const price = Number(unitPrice);
    if (price > 0) overrides.set(name.trim().toLowerCase(), price);
    applyServiceLines(rowId, lines, row, overrides);
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
          if (!Object.prototype.hasOwnProperty.call(patch, "partsCost")) {
            const cost = partsCostForLines(parsePartsLines(undefined, next.parts), partCostByName);
            if (cost !== "") next.partsCost = cost;
          }
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

  function applyPartsLines(rowId: string, lines: SheetPartLine[], row: SheetRow) {
    const value = formatPartsLines(lines);
    const patch: Partial<SheetRow> = { parts: value };
    if (usesOurParts(row.workSource, row.partnerName, partners)) {
      const cost = partsCostForLines(lines, partCostByName);
      if (cost !== "") patch.partsCost = cost;
    } else if (isPartnerWork(row.workSource)) {
      patch.partsCost = "";
    }
    patchRow(rowId, patch, true);
  }

  function catalogForRow(row: SheetRow): StockPartOption[] {
    const ownStock =
      isPartnerWork(row.workSource) && partnerHasOwnStock(row.partnerName, partners);
    if (ownStock) {
      return partnerPartsByName.get(row.partnerName.trim().toLowerCase()) || [];
    }
    return stockParts;
  }

  const partsPickerRow = partsPickerRowId
    ? rows.find((r) => r.id === partsPickerRowId || rowKey(r) === partsPickerRowId) || null
    : null;

  const servicesPickerRow = servicesPickerRowId
    ? rows.find((r) => r.id === servicesPickerRowId || rowKey(r) === servicesPickerRowId) || null
    : null;

  async function addNewRow() {
    if (pending) return;
    const draft: SheetRow = {
      ...emptyRow(Date.now()),
      workSource: "Garage Guys",
      jobStatus: "Waiting",
      date: todayISO(),
    };
    // New rows use today's date — if the period filter excludes today, the row
    // would vanish the moment it gets a real id. Jump to "all" so it stays visible.
    if (!rowInPeriod(draft, activeRange.from, activeRange.to) && period !== "all") {
      changePeriod("all");
    }
    pinRowKey(rowKey(draft));
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
      const nextId = result.id || draft.id;
      const savedToDb = Boolean(nextId) && !String(nextId).startsWith("new-");

      if (!result.ok && !savedToDb) {
        setStatus(result.error || "Could not create row");
        setRows((prev) => {
          const next = prev.filter((r) => rowKey(r) !== rowKey(draft));
          rowsRef.current = next;
          rememberRows(next);
          return next;
        });
        dirtyIdsRef.current.delete(rowKey(draft));
        pinnedKeysRef.current.delete(rowKey(draft));
        return;
      }

      const nextJob = result.jobNumber || "";
      pinRowKey(rowKey(draft));
      if (savedToDb) pinRowKey(nextId);
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
      if (result.error) {
        setStatus(`Saved with warning: ${result.error}`);
      } else {
        setStatus(nextJob ? `Saved · ${nextJob}` : "Saved");
      }
      window.setTimeout(() => setStatus(""), 2200);
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
      pinnedKeysRef.current.delete(rowKey(draft));
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

  const allCatalogServices = useMemo(() => {
    const map = new Map<string, SheetServiceOption>();
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
    for (const row of rows) {
      for (const line of parseServiceLines(undefined, row.service)) {
        const name = line.name.trim();
        if (!name) continue;
        if (!map.has(name.toLowerCase())) map.set(name.toLowerCase(), { name, unitPrice: "" });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogServices, extraServices, rows]);

  const serviceCatalog = useMemo(
    () =>
      allCatalogServices.map((svc) => {
        const field = findFieldServiceByName(svc.name);
        return {
          name: svc.name,
          unitPrice: svc.unitPrice,
          category: field?.category || "Custom",
        };
      }),
    [allCatalogServices],
  );

  const servicePriceByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const svc of allCatalogServices) {
      const n = money(svc.unitPrice);
      if (n > 0) map.set(svc.name.toLowerCase(), n);
    }
    return map;
  }, [allCatalogServices]);

  const activeRange = useMemo(
    () => periodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const periodRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          // Keep unsaved drafts visible; everything else must match the period filter
          // so totals below match what is on screen.
          row.id.startsWith("new-") || rowInPeriod(row, activeRange.from, activeRange.to),
      ),
    [rows, activeRange],
  );

  /** Totals only for rows in the selected period (same set as the table). */
  const sheetTotals = useMemo(() => {
    let gross = 0;
    let parts = 0;
    let clear = 0;
    const techPay = new Map<string, number>();
    const grossBySource = new Map<string, number>();

    for (const row of periodRows) {
      const jobGross = money(row.jobCost);
      gross += jobGross;
      parts += money(row.partsCost);
      clear += money(clearProfitFor(row, partners));

      if (jobGross) {
        let sourceLabel = "Garage Guys";
        if (isPartnerWork(row.workSource)) {
          sourceLabel = row.partnerName.trim() || "Partner";
        } else if (!isOwnWork(row.workSource)) {
          sourceLabel = "Other";
        }
        grossBySource.set(sourceLabel, (grossBySource.get(sourceLabel) || 0) + jobGross);
      }

      const techName = row.technician.trim();
      const pay = effectiveTechPay(row);
      if (!pay) continue;
      const key = techName || "Unassigned";
      techPay.set(key, (techPay.get(key) || 0) + pay);
    }

    const techEntries = [...techPay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const techTotal = techEntries.reduce((sum, [, v]) => sum + v, 0);
    const grossEntries = [...grossBySource.entries()].sort((a, b) => {
      if (a[0] === "Garage Guys") return -1;
      if (b[0] === "Garage Guys") return 1;
      return a[0].localeCompare(b[0]);
    });

    return { gross, parts, clear, techEntries, techTotal, grossEntries };
  }, [periodRows, partners]);

  const periodTotalsLabel = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((p) => p.id === period);
    if (period === "custom" && (customFrom || customTo)) {
      return [customFrom || "…", customTo || "…"].join(" – ");
    }
    return opt?.label || "Всё";
  }, [period, customFrom, customTo]);

  const sortedRows = useMemo(() => {
    const next = [...periodRows];
    next.sort((a, b) => {
      const da = dateTimeSortValue(a);
      const db = dateTimeSortValue(b);
      if (da === db) return 0;
      return dateSort === "newest" ? (da < db ? 1 : -1) : da < db ? -1 : 1;
    });
    return next;
  }, [periodRows, dateSort]);

  function changePeriod(next: SheetPeriod) {
    // Drop freeze so a period switch can't keep out-of-range rows on screen.
    releaseQueuedRef.current = false;
    frozenIdsRef.current = null;
    setFreezeOrder(false);
    setPeriod(next);
    try {
      localStorage.setItem(
        PERIOD_STORAGE_KEY,
        JSON.stringify({
          period: next,
          from: customFrom,
          to: customTo,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  function changeCustomRange(from: string, to: string) {
    releaseQueuedRef.current = false;
    frozenIdsRef.current = null;
    setFreezeOrder(false);
    setCustomFrom(from);
    setCustomTo(to);
    setPeriod("custom");
    try {
      localStorage.setItem(
        PERIOD_STORAGE_KEY,
        JSON.stringify({ period: "custom", from, to }),
      );
    } catch {
      /* ignore */
    }
  }

  const displayRows = useMemo(() => {
    const ids = freezeOrder ? frozenIdsRef.current : null;
    if (!ids?.length) return sortedRows;
    const allowed = new Set(sortedRows.map((row) => rowKey(row)));
    const byKey = new Map<string, SheetRow>();
    for (const row of sortedRows) {
      byKey.set(rowKey(row), row);
      byKey.set(row.id, row);
    }
    const locked = ids
      .map((id) => byKey.get(id))
      .filter((row): row is SheetRow => Boolean(row))
      .filter((row) => allowed.has(rowKey(row)));
    const lockedSet = new Set(locked.map((row) => rowKey(row)));
    const extras = sortedRows.filter((row) => !lockedSet.has(rowKey(row)));
    return [...locked, ...extras];
  }, [sortedRows, freezeOrder]);

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

  const periodBlock = (
    <div className="sheet-period-bar sheet-period-bar--header">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`sheet-period-btn${period === opt.id ? " is-active" : ""}`}
          onClick={() => changePeriod(opt.id)}
        >
          {opt.label}
        </button>
      ))}
      {period === "custom" ? (
        <div className="sheet-period-custom">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => changeCustomRange(e.target.value, customTo)}
            aria-label="From date"
          />
          <span>—</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => changeCustomRange(customFrom, e.target.value)}
            aria-label="To date"
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div>
      {headerAside ? createPortal(periodBlock, headerAside) : null}
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
      <div className="sheet-top-row">
        <div className="sheet-top-actions">
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
        <div className="sheet-totals">
          <div className="sheet-total-card sheet-total-period">
            <span className="sheet-total-label">Period</span>
            <strong className="sheet-total-value sheet-total-period-value">{periodTotalsLabel}</strong>
          </div>
          {sheetTotals.grossEntries.length === 0 ? (
            <div className="sheet-total-card">
              <span className="sheet-total-label">Gross</span>
              <strong className="sheet-total-value">{formatMoney(0)}</strong>
            </div>
          ) : (
            sheetTotals.grossEntries.map(([label, amount]) => (
              <div className="sheet-total-card" key={`gross-${label}`}>
                <span className="sheet-total-label">Gross · {label}</span>
                <strong className="sheet-total-value">{formatMoney(amount)}</strong>
              </div>
            ))
          )}
          <div className="sheet-total-card">
            <span className="sheet-total-label">
              {sheetTotals.techEntries.length === 1
                ? `Tech · ${sheetTotals.techEntries[0][0]}`
                : "Tech salary"}
            </span>
            <strong className="sheet-total-value">
              {sheetTotals.techEntries.length === 1
                ? formatMoney(sheetTotals.techEntries[0][1])
                : sheetTotals.techEntries.length === 0
                  ? formatMoney(0)
                  : formatMoney(sheetTotals.techTotal)}
            </strong>
            {sheetTotals.techEntries.length > 1 ? (
              <span className="sheet-total-sub">
                {sheetTotals.techEntries
                  .map(([name, amount]) => `${name} ${formatMoney(amount)}`)
                  .join(" · ")}
              </span>
            ) : null}
          </div>
          <div className="sheet-total-card">
            <span className="sheet-total-label">Clear</span>
            <strong className="sheet-total-value">{formatMoney(sheetTotals.clear)}</strong>
          </div>
          <div className="sheet-total-card">
            <span className="sheet-total-label">Parts</span>
            <strong className="sheet-total-value">{formatMoney(sheetTotals.parts)}</strong>
          </div>
        </div>
        <label className="sheet-sort">
          Date / time
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
          </colgroup>
          <thead>
            <tr>
              <th className="sheet-corner" title="Click a row number to delete" />
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
                        Date / time {dateSort === "newest" ? "↓" : "↑"}
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
                  <th className="sheet-row-num">
                    {armedDeleteKey === rowKey(row) ? (
                      <button
                        type="button"
                        className="sheet-row-del is-armed"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRow(row);
                        }}
                        aria-label={`Delete ${row.clientName || `row ${rowIndex + 1}`}`}
                        title="Delete row"
                      >
                        ×
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="sheet-row-sel"
                        onClick={() => setArmedDeleteKey(rowKey(row))}
                        aria-label={`Select row ${rowIndex + 1} to delete`}
                        title="Click to show delete"
                      >
                        {rowIndex + 1}
                      </button>
                    )}
                  </th>
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

                    if (col.key === "service") {
                      return (
                        <td key={col.key} className={cellClass}>
                          <button
                            type="button"
                            className="sheet-cell sheet-parts-trigger"
                            disabled={!editable}
                            tabIndex={editable ? 0 : -1}
                            title={row.service || "Pick services"}
                            onClick={() => {
                              if (!editable) return;
                              setServicesPickerRowId(rowKey(row));
                            }}
                          >
                            {row.service.trim() || "Pick services…"}
                          </button>
                        </td>
                      );
                    }

                    if (col.key === "parts") {
                      return (
                        <td key={col.key} className={cellClass}>
                          <button
                            type="button"
                            className="sheet-cell sheet-parts-trigger"
                            disabled={!editable}
                            tabIndex={editable ? 0 : -1}
                            title={row.parts || "Pick parts"}
                            onClick={() => {
                              if (!editable) return;
                              setPartsPickerRowId(rowKey(row));
                            }}
                          >
                            {row.parts.trim() || "Pick parts…"}
                          </button>
                        </td>
                      );
                    }

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
                              if (col.key === "jobStatus") {
                                const nextStatus = e.target.value;
                                if (nextStatus === "Scheduled") {
                                  e.target.value = row.jobStatus;
                                  requestSchedule(row);
                                  return;
                                }
                                const blocked = completeBlockedReason(nextStatus, row.jobCost);
                                if (blocked) {
                                  setStatus(blocked);
                                  e.target.value = row.jobStatus;
                                  return;
                                }
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

                    if (col.kind === "time") {
                      const window = findWindowForSheetTime(row.time);
                      const timeValue = window
                        ? sheetTimeForWindow(window)
                        : normalizeSheetTime(row.time);
                      return (
                        <td key={col.key} className={cellClass}>
                          <select
                            className="sheet-cell sheet-select sheet-time"
                            value={timeValue}
                            disabled={!editable}
                            tabIndex={editable ? 0 : -1}
                            onChange={(e) => {
                              if (!editable) return;
                              patchRow(
                                row.id,
                                { time: normalizeSheetTime(e.target.value) },
                                true,
                              );
                            }}
                          >
                            {timeOptionsForValue(timeValue).map((opt) => (
                              <option key={opt.value || "empty"} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {partsPickerRow ? (
        <SheetPartsPicker
          open
          title="Parts"
          catalog={catalogForRow(partsPickerRow)}
          initialLines={parsePartsLines(undefined, partsPickerRow.parts)}
          onClose={() => setPartsPickerRowId(null)}
          onApply={(lines) => {
            applyPartsLines(partsPickerRow.id, lines, partsPickerRow);
            setPartsPickerRowId(null);
          }}
        />
      ) : null}
      {servicesPickerRow ? (
        <SheetServicesPicker
          open
          title="Services"
          catalog={serviceCatalog}
          initialLines={parseServiceLines(undefined, servicesPickerRow.service)}
          onClose={() => setServicesPickerRowId(null)}
          onApply={(lines) => {
            applyServiceLines(servicesPickerRow.id, lines, servicesPickerRow);
            setServicesPickerRowId(null);
          }}
          onAddCustom={(pending) => {
            pendingServiceLinesRef.current = pending;
            setCustomError("");
            setCustomRowId(rowKey(servicesPickerRow));
            setServicesPickerRowId(null);
          }}
        />
      ) : null}
      {scheduleRow ? (
        <ScheduleLeadModal
          leadName={scheduleRow.clientName || scheduleRow.clientAddress || "this job"}
          technicians={scheduleTechnicians}
          jobs={scheduleBusyJobs}
          dayKey={scheduleRow.date || undefined}
          initialTechnicianId={scheduleInitialTechId}
          pending={schedulePending}
          error={scheduleError}
          onClose={() => {
            if (schedulePending) return;
            setScheduleRow(null);
            setScheduleError("");
          }}
          onSubmit={submitSchedule}
        />
      ) : null}
      {customRowId ? (
        <CustomServiceModal
          pending={customPending}
          error={customError}
          showPrice
          onClose={() => {
            if (customPending) return;
            setCustomRowId(null);
            setCustomError("");
          }}
          onSave={({ name, price }) => {
            const rowId = customRowId;
            setCustomError("");
            startCustomTransition(async () => {
              try {
                const res = await fetch("/api/sheet/services", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, price: price || undefined }),
                });
                const data = (await res.json()) as {
                  ok?: boolean;
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
                const pending = pendingServiceLinesRef.current;
                pendingServiceLinesRef.current = [];
                appendCustomService(rowId, data.service.name, unitPrice, pending);
                setCustomRowId(null);
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
