import type { FieldJob } from "@/lib/field/days";
import { dayKeyFromIso, startOfToday, toDayKey } from "@/lib/field/days";
import type { StockState } from "@/lib/stock/store";
import { techQty } from "@/lib/stock/store";

export type AttentionItem = {
  id: string;
  kind: "low_stock" | "open_job" | "overdue_job" | "recall";
  title: string;
  detail: string;
  href: string;
  severity: "warn" | "danger" | "info";
};

export function buildAttentionItems(input: {
  jobs: FieldJob[];
  stock: StockState;
  technicianId: string;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  const today = toDayKey(startOfToday());

  for (const job of input.jobs) {
    if (job.status === "done" || job.status === "cancelled") continue;
    const day = dayKeyFromIso(job.scheduled_start);
    const overdue = Boolean(day && day < today);
    items.push({
      id: `job-${job.id}`,
      kind: overdue ? "overdue_job" : "open_job",
      title: overdue ? "Overdue job" : "Open job",
      detail: `${job.title}${job.zip ? ` · ${job.zip}` : ""} · ${job.status.replace(/_/g, " ")}`,
      href: `/field/jobs/${job.id}`,
      severity: overdue ? "danger" : "warn",
    });
  }

  for (const item of input.stock.items) {
    const qty = techQty(input.stock, item.id, input.technicianId);
    if (qty <= 0) continue;
    const threshold = item.reorderAt > 0 ? item.reorderAt : 2;
    if (qty <= threshold) {
      items.push({
        id: `stock-${item.id}`,
        kind: "low_stock",
        title: "Low on van",
        detail: `${item.name} · ${qty} left`,
        href: "/stock?view=tech",
        severity: qty <= 1 ? "danger" : "warn",
      });
    }
  }

  // Placeholder lane for future recalls
  // (kept empty until CRM recall flow exists)

  const rank = { danger: 0, warn: 1, info: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function money(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isInRange(iso: string | null | undefined, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}
