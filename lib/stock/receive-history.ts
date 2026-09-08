import type { StockItem, StockMovement, StockMovementKind } from "@/lib/stock/store";

const RECEIVE_KINDS = new Set<StockMovementKind>([
  "receive_supplier_to_warehouse",
  "receive_supplier_to_tech",
  "receive_supplier_to_partner",
]);

export type StockReceiveHistoryLine = {
  id: string;
  createdAt: string;
  itemName: string;
  sku: string;
  qty: number;
  kind: StockMovementKind;
  destination: "warehouse" | "tech" | "partner";
  technicianId: string | null;
  technicianLabel: string;
  actorLabel: string;
  note: string;
};

export type StockReceiveHistoryDay = {
  /** Pacific calendar day YYYY-MM-DD */
  date: string;
  label: string;
  totalQty: number;
  lineCount: number;
  lines: StockReceiveHistoryLine[];
};

function pacificYmd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  return utc.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function destinationFor(kind: StockMovementKind): "warehouse" | "tech" | "partner" {
  if (kind === "receive_supplier_to_tech") return "tech";
  if (kind === "receive_supplier_to_partner") return "partner";
  return "warehouse";
}

export function buildStockReceiveHistory(input: {
  movements: StockMovement[];
  items: StockItem[];
  technicians: Array<{ id: string; label: string }>;
  /** Limit to receives onto this tech van (and created by them when known). */
  technicianId?: string | null;
  limitDays?: number;
}): StockReceiveHistoryDay[] {
  const byItem = new Map(input.items.map((i) => [i.id, i]));
  const byTech = new Map(input.technicians.map((t) => [t.id, t.label]));
  const techFilter = input.technicianId || null;

  const lines: StockReceiveHistoryLine[] = [];
  for (const m of input.movements) {
    if (!RECEIVE_KINDS.has(m.kind)) continue;
    const qty = Number(m.qty) || 0;
    if (qty <= 0) continue;

    const techId = m.toTechnicianId || null;
    if (techFilter) {
      const ontoThisVan = techId === techFilter;
      const byThisTech = m.createdBy === techFilter;
      if (!ontoThisVan && !byThisTech) continue;
    }

    const item = byItem.get(m.itemId);
    const techLabel = techId ? byTech.get(techId) || "Technician" : "—";
    const actorLabel = m.createdBy
      ? byTech.get(m.createdBy) || "Staff"
      : techId
        ? techLabel
        : "Staff";

    lines.push({
      id: m.id,
      createdAt: m.createdAt,
      itemName: item?.name || "Unknown part",
      sku: item?.sku || "",
      qty,
      kind: m.kind,
      destination: destinationFor(m.kind),
      technicianId: techId,
      technicianLabel: techLabel,
      actorLabel,
      note: String(m.note || "").trim(),
    });
  }

  lines.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const byDay = new Map<string, StockReceiveHistoryLine[]>();
  for (const line of lines) {
    const day = pacificYmd(line.createdAt);
    if (!day) continue;
    const list = byDay.get(day) || [];
    list.push(line);
    byDay.set(day, list);
  }

  const days = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayLines]) => ({
      date,
      label: dayLabel(date),
      totalQty: dayLines.reduce((sum, l) => sum + l.qty, 0),
      lineCount: dayLines.length,
      lines: dayLines,
    }));

  const limit = input.limitDays && input.limitDays > 0 ? input.limitDays : 60;
  return days.slice(0, limit);
}
