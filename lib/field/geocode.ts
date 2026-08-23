import { OC_MAP_CENTER, type GeoPoint } from "@/lib/field/maps";

type CacheEntry = { point: GeoPoint | null; at: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

function cacheKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function readCache(key: string): GeoPoint | null | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.point;
}

function writeCache(key: string, point: GeoPoint | null) {
  cache.set(key, { point, at: Date.now() });
}

async function geocodeGeoapify(text: string, key: string): Promise<GeoPoint | null> {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", text.slice(0, 160));
  url.searchParams.set("apiKey", key);
  url.searchParams.set("filter", "countrycode:us");
  url.searchParams.set("bias", `proximity:${OC_MAP_CENTER.lng},${OC_MAP_CENTER.lat}`);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "en");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: number[] } }>;
  };
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Nominatim (OpenStreetMap) — open geocoder fallback when Geoapify is unset. */
async function geocodeNominatim(text: string): Promise<GeoPoint | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", text.slice(0, 160));
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "GarageGuysOC-Field/1.0 (field schedule map)",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const row = data[0];
  if (!row) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function geocodeAddress(text: string): Promise<GeoPoint | null> {
  const trimmed = text.trim();
  if (trimmed.length < 5) return null;
  const key = cacheKey(trimmed);
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const apiKey = process.env.GEOAPIFY_API_KEY || "";
  let point: GeoPoint | null = null;
  try {
    point = apiKey
      ? await geocodeGeoapify(trimmed, apiKey)
      : await geocodeNominatim(trimmed);
    if (!point && apiKey) {
      point = await geocodeNominatim(trimmed);
    }
  } catch {
    point = null;
  }
  writeCache(key, point);
  return point;
}

export async function geocodeMany(
  queries: Array<{ id: string; text: string }>,
): Promise<Record<string, GeoPoint>> {
  const out: Record<string, GeoPoint> = {};
  const hasKey = Boolean(process.env.GEOAPIFY_API_KEY);
  if (hasKey) {
    const results = await Promise.all(
      queries.map(async (q) => {
        const point = await geocodeAddress(q.text);
        return { id: q.id, point };
      }),
    );
    for (const row of results) {
      if (row.point) out[row.id] = row.point;
    }
    return out;
  }

  // Sequential for Nominatim usage policy when Geoapify is unset.
  for (const q of queries) {
    const point = await geocodeAddress(q.text);
    if (point) out[q.id] = point;
  }
  return out;
}
