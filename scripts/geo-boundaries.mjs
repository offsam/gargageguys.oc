/** Orange County city boundaries via US Census TIGER/Line (aligned, official). */

import { OC_CITIES_SERVICE } from './oc-city-content.mjs';

export const OC_CITY_NAMES = OC_CITIES_SERVICE.map((c) => c.name);

/** Major cities only — labels on homepage map. */
export const OC_LABELED_CITIES = new Set([
  'Irvine',
  'Anaheim',
  'Santa Ana',
  'Huntington Beach',
  'Newport Beach',
  'Costa Mesa',
]);

const CENSUS_PLACES_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4/query';
const CENSUS_COUNTY_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query';

function parseCoord(value) {
  return Number(String(value).replace(/^\+/, ''));
}

export function simplifyRing(ring, maxPoints = 80) {
  if (ring.length <= maxPoints) return ring;
  const step = Math.ceil(ring.length / maxPoints);
  const out = ring.filter((_, i) => i % step === 0);
  if (out[0] !== ring[0]) out.push(ring[0]);
  return out;
}

export function extractRing(geojson) {
  const rings = [];
  if (geojson?.type === 'Polygon') rings.push(geojson.coordinates[0]);
  else if (geojson?.type === 'MultiPolygon') {
    for (const poly of geojson.coordinates) rings.push(poly[0]);
  }
  if (!rings.length) return null;
  return rings.reduce((a, b) => (a.length > b.length ? a : b));
}

export function bboxOfRings(rings) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

export function projectPoint(lon, lat, bbox, w, h, pad) {
  const { minLon, maxLon, minLat, maxLat } = bbox;
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const scale = Math.min(innerW / (maxLon - minLon), innerH / (maxLat - minLat));
  const x = pad.left + (lon - minLon) * scale;
  const y = pad.top + (maxLat - lat) * scale;
  return [x, y];
}

export function ringToPath(ring, bbox, w, h, pad) {
  const pts = ring.map(([lon, lat]) => {
    const [x, y] = projectPoint(lon, lat, bbox, w, h, pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${pts.join(' L ')} Z`;
}

async function censusQuery(url, params) {
  const qs = new URLSearchParams({
    f: 'geojson',
    returnGeometry: 'true',
    ...params,
  });
  const res = await fetch(`${url}?${qs}`, {
    headers: { 'User-Agent': 'garageguysoc-boundaries/1.0' },
  });
  if (!res.ok) throw new Error(`Census API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Census API error');
  return data.features ?? [];
}

export async function fetchOrangeCountyBoundary() {
  const features = await censusQuery(CENSUS_COUNTY_URL, {
    where: "STATE='06' AND COUNTY='059'",
    outFields: 'NAME',
  });
  const ring = extractRing(features[0]?.geometry);
  return ring ? simplifyRing(ring, 120) : null;
}

export async function fetchOrangeCountyCities(names = OC_CITY_NAMES) {
  const quoted = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
  const features = await censusQuery(CENSUS_PLACES_URL, {
    where: `STATE='06' AND BASENAME IN (${quoted})`,
    outFields: 'NAME,BASENAME,INTPTLAT,INTPTLON',
  });

  const byName = new Map();
  for (const f of features) {
    const name = f.properties?.BASENAME;
    const ring = extractRing(f.geometry);
    if (!name || !ring) continue;
    byName.set(name, {
      name,
      ring: simplifyRing(ring, 70),
      center: [
        parseCoord(f.properties.INTPTLON),
        parseCoord(f.properties.INTPTLAT),
      ],
    });
  }

  return names.filter((n) => byName.has(n)).map((n) => byName.get(n));
}
