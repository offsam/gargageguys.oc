import {
  masterQty,
  partnerQty,
  techQty,
  warehouseQty,
  type StockState,
} from "@/lib/stock/store";

export type StockPlaceRow = {
  label: string;
  units: number;
  warn?: boolean;
};

export function summarizeStockPlaces(
  state: StockState,
  technicians: Array<{ id: string; label: string }>,
  partners: Array<{ id: string; name: string }>,
) {
  const items = state.items.filter((item) => item.active !== false);
  let ggWarehouse = 0;
  let valueCents = 0;
  let lowCount = 0;
  const ggVan: Record<string, number> = Object.fromEntries(technicians.map((t) => [t.id, 0]));
  const partnerWh: Record<string, number> = Object.fromEntries(partners.map((p) => [p.id, 0]));
  const partnerVan: Record<string, number> = Object.fromEntries(partners.map((p) => [p.id, 0]));

  for (const item of items) {
    ggWarehouse += warehouseQty(state, item.id);
    const master = masterQty(state, item.id);
    valueCents += master * (item.unitCostCents || 0);
    if (master <= (item.reorderAt || 0)) lowCount += 1;
    for (const tech of technicians) {
      ggVan[tech.id] += techQty(state, item.id, tech.id);
    }
    for (const partner of partners) {
      partnerWh[partner.id] += partnerQty(state, item.id, partner.id);
      for (const tech of technicians) {
        partnerVan[partner.id] += techQty(state, item.id, tech.id, partner.id);
      }
    }
  }

  const places: StockPlaceRow[] = [
    { label: "Garage Guys warehouse", units: ggWarehouse },
  ];
  for (const tech of technicians) {
    places.push({ label: `${tech.label} van · GG`, units: ggVan[tech.id] || 0 });
  }
  for (const partner of partners) {
    const warehouse = partnerWh[partner.id] || 0;
    const onVans = partnerVan[partner.id] || 0;
    if (warehouse === 0 && onVans === 0) continue;
    places.push({ label: `${partner.name} warehouse`, units: warehouse });
    places.push({ label: `${partner.name} on vans`, units: onVans });
  }
  places.push({ label: "Low / reorder · GG", units: lowCount, warn: lowCount > 0 });

  const totalUnits =
    ggWarehouse +
    Object.values(ggVan).reduce((sum, n) => sum + n, 0) +
    Object.values(partnerWh).reduce((sum, n) => sum + n, 0) +
    Object.values(partnerVan).reduce((sum, n) => sum + n, 0);

  return {
    skuCount: items.length,
    lowCount,
    valueCents,
    totalUnits,
    places,
  };
}
