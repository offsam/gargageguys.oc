export type AddressSuggestion = {
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
};

function compactLabel(input: {
  line1: string;
  city: string;
  state: string;
  zip: string;
  formatted: string;
}): string {
  const parts = [
    input.line1,
    [input.city, input.state].filter(Boolean).join(", "),
    input.zip,
  ].filter(Boolean);
  return parts.join(", ") || input.formatted.replace(/, United States of America$/i, "");
}

export function mapGeoapifyFeatures(raw: unknown): AddressSuggestion[] {
  const features =
    raw && typeof raw === "object" && Array.isArray((raw as { features?: unknown }).features)
      ? ((raw as { features: Array<{ properties?: Record<string, unknown> }> }).features)
      : [];

  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const p = feature.properties || {};
    const line1 = String(p.address_line1 || "").trim();
    const city = String(p.city || "").trim();
    const state = String(p.state_code || p.state || "").trim();
    const zip = String(p.postcode || "").trim();
    const formatted = String(p.formatted || "").trim();
    const label = compactLabel({ line1, city, state, zip, formatted });
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, line1, city, state, zip });
  }
  return out;
}
