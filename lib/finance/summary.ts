import type { FinanceRow } from "@/lib/finance/types";

export function isFinanceEarned(status: string) {
  return ["paid", "complete", "signed", "completed", "partner"].includes(status);
}

export function earnedBySource(rows: FinanceRow[]) {
  let garageGuysCents = 0;
  let otherCents = 0;
  const partners = new Map<string, number>();

  for (const row of rows) {
    if (!isFinanceEarned(row.status)) continue;
    const amount = Number(row.amountCents) || 0;
    if (row.sourceKind === "garage_guys") {
      garageGuysCents += amount;
    } else if (row.sourceKind === "partner") {
      const name = row.sourceLabel.trim() || "Partner";
      partners.set(name, (partners.get(name) || 0) + amount);
    } else {
      otherCents += amount;
    }
  }

  return {
    garageGuysCents,
    otherCents,
    partners: [...partners.entries()]
      .map(([name, cents]) => ({ name, cents }))
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name)),
  };
}
