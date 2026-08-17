/** Field service catalog for job invoices (editable later in admin). */

export type FieldService = {
  id: string;
  name: string;
  unitPriceCents: number;
  category: string;
};

export const FIELD_SERVICES: FieldService[] = [
  { id: "svc-diag", name: "Diagnostic / Service call", unitPriceCents: 8900, category: "Service" },
  { id: "svc-spring-single", name: "Torsion spring replacement (single)", unitPriceCents: 24900, category: "Springs" },
  { id: "svc-spring-pair", name: "Torsion spring replacement (pair)", unitPriceCents: 39900, category: "Springs" },
  { id: "svc-cable", name: "Cable replacement", unitPriceCents: 18900, category: "Hardware" },
  { id: "svc-roller-set", name: "Roller replacement (set)", unitPriceCents: 22900, category: "Hardware" },
  { id: "svc-hinge", name: "Hinge / bracket repair", unitPriceCents: 14900, category: "Hardware" },
  { id: "svc-opener-repair", name: "Opener repair / gear kit", unitPriceCents: 27900, category: "Opener" },
  { id: "svc-opener-install", name: "Opener installation labor", unitPriceCents: 19900, category: "Opener" },
  { id: "svc-sensor", name: "Safety sensor alignment / replace", unitPriceCents: 12900, category: "Opener" },
  { id: "svc-offtrack", name: "Off-track door recovery", unitPriceCents: 24900, category: "Emergency" },
  { id: "svc-panel", name: "Panel replacement labor", unitPriceCents: 17900, category: "Door" },
  { id: "svc-tuneup", name: "Tune-up / lubrication", unitPriceCents: 9900, category: "Service" },
  { id: "svc-weatherstrip", name: "Weatherstrip / bottom seal", unitPriceCents: 14900, category: "Door" },
  { id: "svc-lock", name: "Lock / handle service", unitPriceCents: 11900, category: "Hardware" },
  { id: "svc-custom", name: "Custom service (set price)", unitPriceCents: 0, category: "Other" },
];

export function findFieldService(id: string) {
  return FIELD_SERVICES.find((s) => s.id === id) || null;
}

export function findFieldServiceByName(name: string) {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return FIELD_SERVICES.find((s) => s.name.toLowerCase() === needle) || null;
}

export const CUSTOM_FIELD_SERVICE =
  FIELD_SERVICES.find((s) => s.id === "svc-custom") ||
  ({
    id: "svc-custom",
    name: "Custom service (set price)",
    unitPriceCents: 0,
    category: "Other",
  } satisfies FieldService);

export const FIELD_SERVICE_NAMES = FIELD_SERVICES.map((s) => s.name);

export function withCustomService(list: FieldService[]): FieldService[] {
  const seen = new Set<string>();
  const out: FieldService[] = [];
  for (const item of [...list, CUSTOM_FIELD_SERVICE]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
