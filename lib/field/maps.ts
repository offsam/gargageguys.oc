/** Orange County, CA — default Field map center (same bias as address autocomplete). */
export const OC_MAP_CENTER = { lat: 33.7455, lng: -117.8677 } as const;

/** Carto Positron — open tiles (same stack as КРУГИ; no OSM flag watermark). */
export const CARTO_POSITRON_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export type GeoPoint = { lat: number; lng: number };

export function mapsAppUrl(address: string): string {
  const q = address.trim();
  if (!q) return "";
  // Opens Apple Maps / Google Maps app on phones when available.
  return `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
}

export function formatJobAddress(address?: string | null, zip?: string | null): string {
  return [address, zip].filter(Boolean).join(", ").trim();
}

export function googleMapsFallbackUrl(address: string): string {
  const q = address.trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
