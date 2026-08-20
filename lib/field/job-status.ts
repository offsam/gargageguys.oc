/** Forward-only Field visit steps (jobs.status). */
export const FIELD_STATUS_FLOW = ["assigned", "en_route", "on_site"] as const;

export type FieldFlowStatus = (typeof FIELD_STATUS_FLOW)[number];

export type FieldStatusStep = {
  status: FieldFlowStatus;
  step: number;
  label: string;
  /** Button label when this is the next action. */
  actionLabel: string;
};

export const FIELD_STATUS_STEPS: FieldStatusStep[] = [
  {
    status: "assigned",
    step: 1,
    label: "Confirmed",
    actionLabel: "1 · Confirm job",
  },
  {
    status: "en_route",
    step: 2,
    label: "En route",
    actionLabel: "2 · En route",
  },
  {
    status: "on_site",
    step: 3,
    label: "On site",
    actionLabel: "3 · On site",
  },
];

export function fieldFlowIndex(status: string): number {
  if (status === "queued") return -1;
  const idx = FIELD_STATUS_FLOW.indexOf(status as FieldFlowStatus);
  return idx;
}

/** Next status the tech may advance to, or null if flow is finished / terminal. */
export function nextFieldStatus(current: string): FieldFlowStatus | null {
  if (current === "cancelled" || current === "done") return null;
  if (current === "queued" || !current) return "assigned";
  const idx = FIELD_STATUS_FLOW.indexOf(current as FieldFlowStatus);
  if (idx < 0) return null;
  if (idx >= FIELD_STATUS_FLOW.length - 1) return null;
  return FIELD_STATUS_FLOW[idx + 1];
}

export function canAddJobItems(status: string): boolean {
  return status === "on_site" || status === "done";
}

export function fieldStatusLabel(status: string): string {
  if (status === "queued") return "Scheduled";
  if (status === "assigned") return "Confirmed";
  if (status === "en_route") return "En route";
  if (status === "on_site") return "On site";
  if (status === "done") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return status.replace(/_/g, " ");
}

export function isValidFieldAdvance(from: string, to: string): boolean {
  return nextFieldStatus(from) === to;
}
