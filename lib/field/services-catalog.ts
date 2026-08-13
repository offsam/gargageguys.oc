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
