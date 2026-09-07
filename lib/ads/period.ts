export type AdsRangePreset =
  | "today"
  | "yesterday"
  | "week"
  | "7d"
  | "28d"
  | "30d"
  | "sync"
  | "custom";

export type AdsReportPeriod = {
  preset: AdsRangePreset;
  periodStart: string;
  periodEnd: string;
};

function pacificYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

/** Monday as start of week (Pacific). */
function startOfWeekYmd(todayYmd: string): string {
  const [y, m, d] = todayYmd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const wd = utc.getUTCDay(); // 0 Sun
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDaysYmd(todayYmd, offset);
}

export function resolveAdsReportPeriod(input: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  syncStart?: string | null;
  syncEnd?: string | null;
}): AdsReportPeriod {
  const range = String(input.range || "").trim().toLowerCase() || "sync";
  const today = pacificYmd();

  if (range === "today") {
    return { preset: "today", periodStart: today, periodEnd: today };
  }
  if (range === "yesterday") {
    const y = addDaysYmd(today, -1);
    return { preset: "yesterday", periodStart: y, periodEnd: y };
  }
  if (range === "week") {
    return { preset: "week", periodStart: startOfWeekYmd(today), periodEnd: today };
  }
  if (range === "7d") {
    return {
      preset: "7d",
      periodStart: addDaysYmd(today, -6),
      periodEnd: today,
    };
  }
  if (range === "28d") {
    return {
      preset: "28d",
      periodStart: addDaysYmd(today, -27),
      periodEnd: today,
    };
  }
  if (range === "30d") {
    return {
      preset: "30d",
      periodStart: addDaysYmd(today, -29),
      periodEnd: today,
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
    periodStart: addDaysYmd(today, -6),
    periodEnd: today,
  };
}

export const ADS_RANGE_OPTIONS: Array<{ id: AdsRangePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "7d", label: "Last 7 days" },
  { id: "28d", label: "Last 28 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "sync", label: "Meta sync period" },
  { id: "custom", label: "Custom" },
];
