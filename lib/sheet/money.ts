import {
  PARTNER_TECH_RATE,
  isOwnWork,
  isPartnerWork,
  partnerHasOwnStock,
  type SheetPartner,
} from "@/lib/sheet/work-source";

export const BANK_FEE_RATE = 0.035;

export function parseMoney(value: string | number | null | undefined): number {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatMoneyUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function formatFee(n: number): string {
  if (!n) return "0.00";
  return n.toFixed(2);
}

/** Auto bank fee for card payments (3.5% of job cost). */
export function bankFeeFor(jobCost: string): string {
  return formatFee(parseMoney(jobCost) * BANK_FEE_RATE);
}

/** Partner default tech pay = 30% of gross. */
export function partnerTechSalary(gross: string): string {
  const n = parseMoney(gross) * PARTNER_TECH_RATE;
  if (!n) return "";
  return formatFee(n);
}

export type SheetMoneyRow = {
  workSource: string;
  partnerName: string;
  jobCost: string;
  techSalary: string;
  partsCost: string;
  bankFee?: string;
  leadCost?: string;
};

/** Clear profit for a sheet row (Garage Guys vs Partner / own-stock rules). */
export function clearProfitFor(row: SheetMoneyRow, partners: SheetPartner[]): string {
  if (isPartnerWork(row.workSource)) {
    const has = parseMoney(row.jobCost) || parseMoney(row.techSalary) || parseMoney(row.partsCost);
    if (!has) return "";
    if (partnerHasOwnStock(row.partnerName, partners)) {
      return formatMoneyUsd(0);
    }
    return formatMoneyUsd(
      parseMoney(row.jobCost) - parseMoney(row.techSalary) - parseMoney(row.partsCost),
    );
  }

  if (!isOwnWork(row.workSource)) return "";

  const hasMoney =
    parseMoney(row.jobCost) ||
    parseMoney(row.leadCost || "") ||
    parseMoney(row.bankFee || "") ||
    parseMoney(row.partsCost) ||
    parseMoney(row.techSalary);
  if (!hasMoney) return "";

  return formatMoneyUsd(
    parseMoney(row.jobCost) -
      parseMoney(row.leadCost || "") -
      parseMoney(row.bankFee || "") -
      parseMoney(row.partsCost) -
      parseMoney(row.techSalary),
  );
}

/** Effective tech pay for totals (auto 30% when partner salary blank). */
export function effectiveTechPay(row: SheetMoneyRow): number {
  let pay = parseMoney(row.techSalary);
  if (!pay && isPartnerWork(row.workSource) && parseMoney(row.jobCost)) {
    pay = parseMoney(partnerTechSalary(row.jobCost));
  }
  return pay;
}

/**
 * Fill job cost from a priced catalog service when the cell is empty
 * or still holds the previous service's auto price.
 */
export type SheetServiceLineLike = { name: string; qty: number };

export function servicesTotalPrice(
  lines: SheetServiceLineLike[],
  priceByName: Map<string, number>,
): number {
  let total = 0;
  for (const line of lines) {
    const unit = priceByName.get(line.name.trim().toLowerCase()) || 0;
    if (unit > 0) total += unit * line.qty;
  }
  return total;
}

export function applyServicesPriceToJobCost(
  jobCost: string,
  previousLines: SheetServiceLineLike[],
  nextLines: SheetServiceLineLike[],
  priceByName: Map<string, number>,
): string {
  const prevTotal = servicesTotalPrice(previousLines, priceByName);
  const nextTotal = servicesTotalPrice(nextLines, priceByName);
  const current = parseMoney(jobCost);
  if (!nextLines.length) {
    if (prevTotal > 0 && Math.abs(current - prevTotal) < 0.009) return "";
    return jobCost;
  }
  if (nextTotal <= 0) return jobCost;
  if (current === 0) return formatFee(nextTotal);
  if (prevTotal > 0 && Math.abs(current - prevTotal) < 0.009) return formatFee(nextTotal);
  return jobCost;
}

export function applyServicePriceToJobCost(
  jobCost: string,
  previousService: string,
  nextService: string,
  priceByName: Map<string, number>,
): string {
  const prevLines = previousService.trim()
    ? [{ name: previousService.trim(), qty: 1 }]
    : [];
  const nextLines = nextService.trim() ? [{ name: nextService.trim(), qty: 1 }] : [];
  return applyServicesPriceToJobCost(jobCost, prevLines, nextLines, priceByName);
}
