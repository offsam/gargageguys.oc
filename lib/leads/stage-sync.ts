import type { LeadStage } from "@/lib/supabase/types";

/**
 * Sheet / CRM funnel statuses.
 * Tech field stages: Tech confirmed → En route → On site → Completed.
 */
export const SHEET_STATUSES = [
  "Waiting",
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
};

export const STATUS_TO_STAGE: Record<SheetStatus, LeadStage> = {
  Waiting: "qualified",
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
