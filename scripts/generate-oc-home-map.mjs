import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bboxOfRings,
  fetchOrangeCountyBoundary,
  fetchOrangeCountyCities,
  projectPoint,
  ringToPath,
} from './geo-boundaries.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Short labels so all 34 cities fit on the county map. */
const LABEL_SHORT = {
  'Huntington Beach': 'Huntington Bch',
  'Rancho Santa Margarita': 'Rancho SM',
  'San Juan Capistrano': 'San Juan Cap.',
  'Fountain Valley': 'Ftn Valley',
  'Laguna Niguel': 'Laguna Niguel',
  'Los Alamitos': 'Los Alamitos',
  'San Clemente': 'San Clemente',
  'Aliso Viejo': 'Aliso Viejo',
  'Buena Park': 'Buena Park',
  'Dana Point': 'Dana Point',
  'Garden Grove': 'Garden Grove',
  'Laguna Beach': 'Laguna Beach',
  'Laguna Hills': 'Laguna Hills',
  'Laguna Woods': 'Laguna Woods',
  'Lake Forest': 'Lake Forest',
  'Mission Viejo': 'Mission Viejo',
  'Newport Beach': 'Newport Bch',
  'Santa Ana': 'Santa Ana',
  'Yorba Linda': 'Yorba Linda',
};

/** Nudge crowded centroid labels (px offset from projected center). */
const LABEL_OFFSET = {
  Irvine: [-10, -6],
  Tustin: [8, 4],
  Orange: [-6, 8],
  Anaheim: [0, -8],
  'Santa Ana': [6, 0],
  'Costa Mesa': [-8, 6],
  'Newport Beach': [0, 10],
  Westminster: [8, -4],
  'Garden Grove': [-10, 0],
  Fullerton: [0, -8],
  Placentia: [6, 4],
  Brea: [-6, -4],
  'Yorba Linda': [0, -8],
  'La Habra': [-8, 0],
  'Seal Beach': [-10, 4],
  'Los Alamitos': [8, 0],
  Cypress: [-6, 4],
  'La Palma': [0, 8],
  Stanton: [6, -4],
  'Villa Park': [-8, -4],
};

function labelFontSize(label) {
  if (label.length > 15) return 7.5;
  if (label.length > 12) return 8.5;
  return 9.5;
}

console.log('Fetching Orange County boundary (Census TIGER)...');
const countyRing = await fetchOrangeCountyBoundary();
console.log('Fetching city boundaries (Census TIGER)...');
const cityData = await fetchOrangeCountyCities();

if (!countyRing) throw new Error('County boundary not found');
if (!cityData.length) throw new Error('No city boundaries returned');

const allRings = [countyRing, ...cityData.map((c) => c.ring)];
const bbox = bboxOfRings(allRings);

const w = 900;
const h = 900;
const pad = { top: 28, right: 28, bottom: 28, left: 28 };

const countyPath = ringToPath(countyRing, bbox, w, h, pad);

const cityPaths = cityData
  .map(({ ring }) => {
    const d = ringToPath(ring, bbox, w, h, pad);
    return `<path class="oc-city" d="${d}"/>`;
  })
  .join('\n    ');

const cityMarkers = cityData
  .map(({ name, center }) => {
    const [cx, cy] = projectPoint(center[0], center[1], bbox, w, h, pad);
    const label = LABEL_SHORT[name] ?? name;
    const [ox, oy] = LABEL_OFFSET[name] ?? [0, 0];
    const dotX = cx + ox;
    const dotY = cy + oy;
    const fs = labelFontSize(label);
    return `<g class="oc-marker">
      <circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="4.5" class="oc-marker__dot"/>
      <text x="${(dotX + 8).toFixed(1)}" y="${(dotY + 3.5).toFixed(1)}" class="oc-marker__label" text-anchor="start" dominant-baseline="middle" font-size="${fs}">${label}</text>
    </g>`;
  })
  .join('\n    ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Map of Orange County California with all city outlines and labels">
  <defs>
    <linearGradient id="ocCountyStroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fcd34d"/>
      <stop offset="45%" stop-color="#5ba3d9"/>
      <stop offset="100%" stop-color="#2e6da4"/>
    </linearGradient>
    <radialGradient id="ocCountyFill" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="rgba(91,163,217,0.18)"/>
      <stop offset="100%" stop-color="rgba(91,163,217,0.02)"/>
    </radialGradient>
    <filter id="ocGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="ocLabelShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="rgba(15,35,64,0.85)"/>
    </filter>
    <style>
      .oc-city { fill: rgba(91,163,217,0.1); stroke: rgba(91,163,217,0.55); stroke-width: 1.1; stroke-linejoin: round; }
      .oc-county { fill: url(#ocCountyFill); stroke: url(#ocCountyStroke); stroke-width: 2.6; stroke-linejoin: round; filter: url(#ocGlow); }
      .oc-marker__dot { fill: #fcd34d; stroke: rgba(15,35,64,0.85); stroke-width: 1.2; }
      .oc-marker__label { fill: rgba(255,255,255,0.96); font-family: Inter, sans-serif; font-weight: 600; letter-spacing: 0.01em; filter: url(#ocLabelShadow); pointer-events: none; }
    </style>
  </defs>
  <path class="oc-county" d="${countyPath}"/>
    ${cityPaths}
    ${cityMarkers}
</svg>`;

const outPath = path.join(root, 'Pictures', 'oc-county-cities-map.svg');
await writeFile(outPath, svg);
console.log('Wrote', outPath, `(${cityData.length} cities, Census TIGER)`);
