import type { LeadStage } from "@/lib/supabase/types";

/**
 * Shared CRM funnel + Sheet Status list.
 * CRM columns and the Sheet Status dropdown are the same array — add a status here
 * and it appears in both. Nothing is maintained separately.
 */
export const SHEET_STATUSES = [
  "Waiting",
  "No answer",
  "Scheduled",
  "Tech confirmed",
  "En route",
  "On site",
  "Completed",
  "Cancelled",
  "No-show",
] as const;

export type SheetStatus = (typeof SHEET_STATUSES)[number];

/** Legacy label still accepted when reading old rows. */
const LEGACY_STATUS_MAP: Record<string, SheetStatus> = {
  "In progress": "Tech confirmed",
  "Tech Confirmed": "Tech confirmed",
  "En Route": "En route",
  "On Site": "On site",
  "Didn't answer": "No answer",
  "Did not answer": "No answer",
  "No Answer": "No answer",
  "No-answer": "No answer",
};

export const STATUS_TO_STAGE: Record<SheetStatus, LeadStage> = {
  Waiting: "qualified",
  "No answer": "qualified",
  Scheduled: "scheduled",
  "Tech confirmed": "in_progress",
  "En route": "in_progress",
  "On site": "in_progress",
  Completed: "completed",
  Cancelled: "cancelled",
  "No-show": "lost",
};

export const STAGE_TO_STATUS: Record<string, SheetStatus> = {
  new: "Waiting",
  qualified: "Waiting",
  scheduled: "Scheduled",
  in_progress: "Tech confirmed",
  completed: "Completed",
  won: "Completed",
  cancelled: "Cancelled",
  lost: "No-show",
};

/** Optional link to jobs.status when a field job exists for the lead. */
export const STATUS_TO_JOB_STATUS: Partial<
  Record<SheetStatus, "queued" | "assigned" | "en_route" | "on_site" | "done" | "cancelled">
> = {
  Scheduled: "queued",
  "Tech confirmed": "assigned",
  "En route": "en_route",
  "On site": "on_site",
  Completed: "done",
  Cancelled: "cancelled",
};

/** Inverse of STATUS_TO_JOB_STATUS — Field/Dispatch writes back into the same funnel. */
export const JOB_STATUS_TO_SHEET: Partial<Record<string, SheetStatus>> = {
  queued: "Scheduled",
  assigned: "Tech confirmed",
  en_route: "En route",
  on_site: "On site",
  done: "Completed",
  cancelled: "Cancelled",
};

export function isSheetStatus(value: string): value is SheetStatus {
  return (SHEET_STATUSES as readonly string[]).includes(value);
}

export function normalizeSheetStatus(value: string): SheetStatus | null {
  const trimmed = value.trim();
  if (isSheetStatus(trimmed)) return trimmed;
  return LEGACY_STATUS_MAP[trimmed] || null;
}

export function sheetStatusFromLead(input: {
  stage?: string | null;
  metadata?: unknown;
}): SheetStatus {
  const meta =
    input.metadata && typeof input.metadata === "object"
      ? (input.metadata as Record<string, unknown>)
      : {};
  const fromMeta = typeof meta.jobStatus === "string" ? meta.jobStatus.trim() : "";
  const normalized = fromMeta ? normalizeSheetStatus(fromMeta) : null;
  if (normalized) return normalized;

  const fromStage = STAGE_TO_STATUS[String(input.stage || "")];
  return fromStage || "Waiting";
}

export function stageFromSheetStatus(status: string): LeadStage | undefined {
  if (!status.trim()) return undefined;
  const normalized = normalizeSheetStatus(status);
  if (!normalized) return undefined;
  return STATUS_TO_STAGE[normalized];
}

export const COMPLETE_NEEDS_PRICE = "Enter the job cost before moving to Completed";

export function jobPriceAmount(...values: unknown[]): number {
  for (const raw of values) {
    if (raw == null || raw === "") continue;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
    const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export function hasJobPrice(...values: unknown[]): boolean {
  return jobPriceAmount(...values) > 0;
}

/** Null if Completed is allowed (or status is not Completed). */
export function completeBlockedReason(status: string, ...priceValues: unknown[]): string | null {
  const normalized = normalizeSheetStatus(status);
  if (normalized !== "Completed") return null;
  if (hasJobPrice(...priceValues)) return null;
  return COMPLETE_NEEDS_PRICE;
}
