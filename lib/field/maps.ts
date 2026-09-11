/** Orange County, CA — default Field map center (same bias as address autocomplete). */
export const OC_MAP_CENTER = { lat: 33.7455, lng: -117.8677 } as const;

/**
 * Field basemap tiles.
 * Carto Positron started watermarking “API KEY REQUIRED” without a key (2026).
 * Esri World Light Gray needs no key and has no OSM flag chrome.
 * Leaflet XYZ template uses {z}/{y}/{x} for ArcGIS tile services.
 */
export const FIELD_BASEMAP_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";

/** @deprecated Use FIELD_BASEMAP_URL — kept so older imports keep compiling. */
export const CARTO_POSITRON_URL = FIELD_BASEMAP_URL;

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
