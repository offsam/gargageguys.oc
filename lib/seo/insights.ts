export type SeoQueryRow = {
  key: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type SeoTotals = {
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type SeoInsight = {
  kind: "do" | "watch" | "ok";
  title: string;
  detail: string;
};

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function pctChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function ctr(clicks: number, impressions: number) {
  if (!impressions) return 0;
  return clicks / impressions;
}

function isMoneyQuery(query: string) {
  return /garage|door|opener|spring|repair|broken|emergency|off.?track|cable|roller|orange county|irvine|anaheim|santa ana/i.test(
    query,
  );
}

export function buildSeoInsights(input: {
  currentTotals?: SeoTotals;
  previousTotals?: SeoTotals;
  queries?: SeoQueryRow[];
  hasPrevious: boolean;
}): SeoInsight[] {
  const insights: SeoInsight[] = [];
  const clicks = n(input.currentTotals?.clicks);
  const impressions = n(input.currentTotals?.impressions);
  const position = n(input.currentTotals?.position);
  const prevClicks = n(input.previousTotals?.clicks);
  const prevImpressions = n(input.previousTotals?.impressions);
  const prevPosition = n(input.previousTotals?.position);
  const queries = [...(input.queries || [])].sort((a, b) => n(b.impressions) - n(a.impressions));

  if (!input.hasPrevious) {
    insights.push({
      kind: "watch",
      title: "First snapshot is in",
      detail:
        "Next period this page will compare clicks and positions and tell you what moved. Until then, scan Top queries for jobs you actually want.",
    });
  } else {
    const clickDelta = pctChange(clicks, prevClicks);
    if (clickDelta <= -20) {
      insights.push({
        kind: "do",
        title: "Search clicks dropped",
        detail: `${Math.round(Math.abs(clickDelta))}% fewer clicks than last period. Check the site and Google profile before buying more ads — paid traffic cannot fix a listing that fell in search.`,
      });
    } else if (clickDelta >= 20) {
      insights.push({
        kind: "ok",
        title: "Search clicks are up",
        detail: `${Math.round(clickDelta)}% more clicks than last period. Organic is bringing jobs. Do not pause or rewrite the pages that already rank.`,
      });
    }

    if (impressions > prevImpressions * 1.1 && clicks < prevClicks * 0.95 && impressions >= 50) {
      insights.push({
        kind: "do",
        title: "More people see you, fewer click",
        detail:
          "That is usually the Google title and description, not a broken website. Tighten the homepage and service-page titles around garage door repair + your city.",
      });
    }

    if (prevPosition && position - prevPosition >= 1.5) {
      insights.push({
        kind: "watch",
        title: "Average position slipped",
        detail: `From ${prevPosition.toFixed(1)} to ${position.toFixed(1)}. Look at money queries that fell onto page 2 — those are the ones that cost jobs.`,
      });
    }
  }

  const lowCtr = queries.find(
    (row) =>
      n(row.impressions) >= 40 &&
      ctr(n(row.clicks), n(row.impressions)) < 0.03 &&
      n(row.position) <= 12,
  );
  if (lowCtr) {
    insights.push({
      kind: "do",
      title: `Shown for “${lowCtr.key}”, almost nobody clicks`,
      detail:
        "Google already puts you in front of this search. Change the title/snippet so it says the service, city, and that you come out same day.",
    });
  }

  const pageTwo = queries.find(
    (row) => isMoneyQuery(row.key) && n(row.position) >= 8 && n(row.position) <= 20 && n(row.impressions) >= 20,
  );
  if (pageTwo) {
    insights.push({
      kind: "do",
      title: `Page 2 for “${pageTwo.key}”`,
      detail:
        "One jump onto page 1 here brings calls without extra ad spend. Keep Google reviews coming and make sure that phrase is on the matching service page.",
    });
  }

  const topMoney = queries.find((row) => isMoneyQuery(row.key) && n(row.position) > 0 && n(row.position) <= 3);
  if (topMoney) {
    insights.push({
      kind: "ok",
      title: `Already near the top for “${topMoney.key}”`,
      detail:
        "Protect this. Answer new Google reviews and keep the Google Business hours/photos current. Losing this spot costs more than most ad tests.",
    });
  }

  if (!insights.length) {
    insights.push({
      kind: "watch",
      title: "No big swing this period",
      detail:
        "Use Top queries as a job list: anything with impressions and a weak position is cheaper to fix than turning up ads.",
    });
  }

  const doFirst = insights.filter((row) => row.kind === "do");
  const rest = insights.filter((row) => row.kind !== "do");
  return [...doFirst, ...rest].slice(0, 5);
}
