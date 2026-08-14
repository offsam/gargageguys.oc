export type FinanceSourceKind = "garage_guys" | "partner" | "unknown";

export type FinanceRow = {
  id: string;
  invoiceId: string | null;
  clientName: string;
  jobNumber: string | null;
  workDate: string;
  workDateLabel: string;
  sourceKind: FinanceSourceKind;
  sourceLabel: string;
  amountCents: number;
  status: string;
  invoiceUrl: string | null;
  publicToken: string | null;
  clientEmail: string;
  description: string;
  paymentType: string;
};
