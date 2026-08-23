export type InvoiceLineKind = "part" | "service";

export type InvoiceLine = {
  id: string;
  kind: InvoiceLineKind;
  refId?: string;
  name: string;
  qty: number;
  /** Catalog / list price at add time (before any discount). */
  listCents: number;
  /** Charged unit price (may be higher or lower than list). */
  unitCents: number;
  /** Client discount when unit < list: (listCents - unitCents) * qty. */
  discountCents: number;
  totalCents: number;
};

/** Build a line with discount only when charged price is below list. */
export function buildInvoiceLine(input: {
  id: string;
  kind: InvoiceLineKind;
  refId?: string;
  name: string;
  qty: number;
  listCents: number;
  unitCents: number;
}): InvoiceLine {
  const qty = Math.max(1, Math.floor(Number(input.qty) || 1));
  const listCents = Math.max(0, Math.round(Number(input.listCents) || 0));
  const unitCents = Math.max(0, Math.round(Number(input.unitCents) || 0));
  const discountCents = unitCents < listCents ? (listCents - unitCents) * qty : 0;
  return {
    id: input.id,
    kind: input.kind,
    refId: input.refId,
    name: input.name,
    qty,
    listCents,
    unitCents,
    discountCents,
    totalCents: unitCents * qty,
  };
}

export function sumInvoiceDiscounts(lines: InvoiceLine[]) {
  return lines.reduce((sum, line) => sum + (Number(line.discountCents) || 0), 0);
}

export type JobInvoiceStatus =
  | "draft"
  | "estimate_ready"
  | "estimate_confirmed"
  | "payment_pending"
  | "payment_confirmed"
  | "signed"
  | "complete";

export type JobInvoice = {
  id: string;
  job_id: string;
  job_number: number | null;
  lead_id: string | null;
  customer_id: string | null;
  public_token: string;
  status: JobInvoiceStatus;
  client_name: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_zip: string | null;
  lines: InvoiceLine[];
  subtotal_cents: number;
  total_cents: number;
  payment_type: string | null;
  estimate_confirmed_at: string | null;
  payment_confirmed_at: string | null;
  signature_data: string | null;
  signed_at: string | null;
  completed_at: string | null;
  finance_invoice_id: string | null;
  created_at: string;
  updated_at: string;
};

export const PAYMENT_OPTIONS = [
  "Credit Card",
  "Venmo",
  "Zelle",
  "Cash",
  "Check",
] as const;

export { formatJobNumber, isLegacyJobNumber, parseJobNumberLabel } from "@/lib/field/job-number";

export function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function sumInvoiceLines(lines: InvoiceLine[]) {
  return lines.reduce((sum, line) => sum + (line.totalCents || 0), 0);
}

export function parseInvoiceLines(raw: unknown): InvoiceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as Partial<InvoiceLine> & { listPriceCents?: number };
      const qty = Number(r.qty) || 0;
      const unitCents = Number(r.unitCents) || 0;
      const listCents =
        Number(r.listCents) ||
        Number(r.listPriceCents) ||
        unitCents;
      const discountCents =
        Number(r.discountCents) ||
        (unitCents < listCents ? (listCents - unitCents) * qty : 0);
      return {
        id: String(r.id || `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        kind: r.kind === "part" ? "part" : "service",
        refId: r.refId ? String(r.refId) : undefined,
        name: String(r.name || ""),
        qty,
        listCents,
        unitCents,
        discountCents,
        totalCents: Number(r.totalCents) || qty * unitCents,
      } as InvoiceLine;
    })
    .filter((l) => l.name && l.qty > 0);
}
