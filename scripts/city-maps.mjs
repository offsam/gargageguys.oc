import {
  bboxOfRings,
  fetchOrangeCountyCities,
  projectPoint,
  ringToPath,
} from './geo-boundaries.mjs';

export function cityToSvg(city, size = 440) {
  const w = size;
  const h = size;
  const pad = { top: 36, right: 36, bottom: 36, left: 36 };
  const bbox = bboxOfRings([city.ring]);
  const d = ringToPath(city.ring, bbox, w, h, pad);
  const safeName = city.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const [cx, cy] = projectPoint(city.center[0], city.center[1], bbox, w, h, pad);
  const label = `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="hero-city-map__label">${safeName}</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" class="hero-city-map__svg" role="img" aria-label="Map outline of ${safeName}, California"><path d="${d}" fill="rgba(91,163,217,0.16)" stroke="#5ba3d9" stroke-width="2.8" stroke-linejoin="round"/>${label}</svg>`;
}

export async function loadCityMaps(names) {
  const cities = await fetchOrangeCountyCities(names);
  const maps = new Map();
  for (const city of cities) {
    maps.set(city.name, cityToSvg(city));
  }
  return maps;
}
