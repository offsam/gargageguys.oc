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
