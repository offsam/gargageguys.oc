/** Sheet row work channel — drives which columns are editable and how money is calculated. */

export const WORK_SOURCES = ["Garage Guys", "Partner"] as const;
export type WorkSource = (typeof WORK_SOURCES)[number] | "";

export const PARTNER_TECH_RATE = 0.3;

export type SheetPartner = {
  name: string;
  hasOwnStock: boolean;
};

export type SheetColumnKey =
  | "jobNumber"
  | "workSource"
  | "partnerName"
  | "date"
  | "time"
  | "clientName"
  | "clientAddress"
  | "jobStatus"
  | "jobType"
  | "service"
  | "leadSource"
  | "leadCost"
  | "parts"
  | "paymentType"
  | "checkNumber"
  | "jobCost"
  | "bankFee"
  | "partsCost"
  | "technician"
  | "techSalary"
  | "description";

export type ColumnOpts = {
  usesOurParts?: boolean;
};

const ALWAYS: SheetColumnKey[] = ["workSource", "jobNumber"];

const SHARED: SheetColumnKey[] = [
  "date",
  "time",
  "clientName",
  "clientAddress",
  "jobStatus",
  "jobType",
  "service",
  "parts",
  "paymentType",
  "checkNumber",
  "jobCost",
  "technician",
  "description",
];

const OWN_ONLY: SheetColumnKey[] = [
  "leadSource",
  "leadCost",
  "bankFee",
  "partsCost",
  "techSalary",
];

const PARTNER_ONLY: SheetColumnKey[] = ["partnerName"];

/** Partner tech pay is auto (30% of Gross) — visible but not manually edited. */
const PARTNER_READONLY: SheetColumnKey[] = ["techSalary"];

/** System fields — never typed by hand. */
const SYSTEM_READONLY: SheetColumnKey[] = ["jobNumber"];

export function normalizeWorkSource(raw: string | null | undefined): WorkSource {
  const v = String(raw || "").trim();
  if (v === "Garage Guys" || v === "Partner") return v;
  if (/^partner$/i.test(v)) return "Partner";
  if (/garage\s*guys/i.test(v)) return "Garage Guys";
  return "";
}

export function isOwnWork(source: string): boolean {
  return normalizeWorkSource(source) === "Garage Guys";
}

export function isPartnerWork(source: string): boolean {
  return normalizeWorkSource(source) === "Partner";
}

export function partnerHasOwnStock(partnerName: string, partners: SheetPartner[]): boolean {
  const needle = partnerName.trim().toLowerCase();
  if (!needle) return false;
  return Boolean(
    partners.find((p) => p.name.trim().toLowerCase() === needle)?.hasOwnStock,
  );
}

/** Named partner that does not keep a warehouse — uses Garage Guys parts. */
export function partnerUsesOurStock(partnerName: string, partners: SheetPartner[]): boolean {
  const needle = partnerName.trim().toLowerCase();
  if (!needle) return false;
  return !partnerHasOwnStock(partnerName, partners);
}

export function usesOurParts(
  workSource: string,
  partnerName: string,
  partners: SheetPartner[],
): boolean {
  if (isOwnWork(workSource)) return true;
  if (isPartnerWork(workSource) && partnerUsesOurStock(partnerName, partners)) return true;
  return false;
}

export function isColumnActive(
  workSource: string,
  key: SheetColumnKey,
  opts?: ColumnOpts,
): boolean {
  const src = normalizeWorkSource(workSource);
  if (ALWAYS.includes(key)) return true;
  if (!src) return false;
  if (SHARED.includes(key)) return true;
  if (src === "Garage Guys") return OWN_ONLY.includes(key);
  if (src === "Partner") {
    if (PARTNER_READONLY.includes(key)) return true; // visible / filled, but UI locks edit
    if (key === "partsCost" && opts?.usesOurParts) return true;
    return PARTNER_ONLY.includes(key);
  }
  return false;
}

export function isColumnEditable(
  workSource: string,
  key: SheetColumnKey,
  opts?: ColumnOpts,
): boolean {
  const src = normalizeWorkSource(workSource);
  if (!isColumnActive(workSource, key, opts)) return false;
  if (SYSTEM_READONLY.includes(key)) return false;
  if (src === "Partner" && PARTNER_READONLY.includes(key)) return false;
  // Bank fee is auto for card on own jobs — still editable override
  return true;
}
