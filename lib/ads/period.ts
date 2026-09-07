export type AdsRangePreset =
  | "today"
  | "yesterday"
  | "week"
  | "7d"
  | "28d"
  | "sync"
  | "custom";

export type AdsReportPeriod = {
  preset: AdsRangePreset;
  periodStart: string;
  periodEnd: string;
};

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Monday as start of week (local). */
function startOfWeek(d = new Date()): Date {
  const day = startOfLocalDay(d);
  const wd = day.getDay(); // 0 Sun
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDays(day, offset);
}

export function resolveAdsReportPeriod(input: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  syncStart?: string | null;
  syncEnd?: string | null;
}): AdsReportPeriod {
  const range = String(input.range || "").trim().toLowerCase() || "sync";
  const today = startOfLocalDay();

  if (range === "today") {
    return { preset: "today", periodStart: fmt(today), periodEnd: fmt(today) };
  }
  if (range === "yesterday") {
    const y = addDays(today, -1);
    return { preset: "yesterday", periodStart: fmt(y), periodEnd: fmt(y) };
  }
  if (range === "week") {
    const start = startOfWeek(today);
    return { preset: "week", periodStart: fmt(start), periodEnd: fmt(today) };
  }
  if (range === "7d") {
    return {
      preset: "7d",
      periodStart: fmt(addDays(today, -6)),
      periodEnd: fmt(today),
    };
  }
  if (range === "28d") {
    return {
      preset: "28d",
      periodStart: fmt(addDays(today, -27)),
      periodEnd: fmt(today),
    };
  }
  if (range === "custom") {
    const from = String(input.from || "").trim();
    const to = String(input.to || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return {
        preset: "custom",
        periodStart: from <= to ? from : to,
        periodEnd: from <= to ? to : from,
      };
    }
  }

  if (input.syncStart && input.syncEnd) {
    return {
      preset: "sync",
      periodStart: input.syncStart,
      periodEnd: input.syncEnd,
    };
  }

  return {
    preset: "7d",
    periodStart: fmt(addDays(today, -6)),
    periodEnd: fmt(today),
  };
}

export const ADS_RANGE_OPTIONS: Array<{ id: AdsRangePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "7d", label: "Last 7 days" },
  { id: "28d", label: "Last 28 days" },
  { id: "sync", label: "Meta sync period" },
  { id: "custom", label: "Custom" },
];
