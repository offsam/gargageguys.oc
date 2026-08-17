import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAllPages } from './generate-seo-landing-pages.mjs';
import { localBusinessFields, faqLdJsonScript } from './seo-business.mjs';
import { writeStaticHtml } from './write-static-html.mjs';
import { OC_CITIES_SERVICE } from './oc-city-content.mjs';
import { renderPilotServiceAreaPage } from './city-pilot-render.mjs';
import { problemPages } from './seo-problem-pages.mjs';
import { cityToSvg } from './city-maps.mjs';
import { fetchOrangeCountyCities } from './geo-boundaries.mjs';
import {
  ctaBlock,
  heroActionsBlock,
  pageTail,
  siteNav,
} from './shared-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const today = '2026-07-11';

const CITIES = OC_CITIES_SERVICE;

function headBlock({ title, description, canonical, ogTitle, schema }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garage Guys">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="https://garageguysoc.com/favicon-192x192.png">
<meta name="theme-color" content="#0f2340">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/service-page.css">
<link rel="stylesheet" href="/css/home-hero.css">
<link rel="stylesheet" href="/css/service-areas.css">
<script src="/api/analytics.js" defer></script>
<script type="application/ld+json">
${schema}
</script>
${faqLdJsonScript({ path: 'service-areas', areaServed: { type: 'AdministrativeArea', name: 'Orange County, California' } })}
</head>
<body>
<div class="site-van-bg" data-tone="hero" aria-hidden="true"></div>`;
}

function cityAreaHref(slug) {
  return `/service-areas/${slug}/`;
}

function renderCityPage(city, pagesByPath, cityMapsByName) {
  return renderPilotServiceAreaPage(city, pagesByPath, cityMapsByName, problemPages);
}

function citiesAlphabetical() {
  return [...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function renderHub(cityMaps) {
  const canonical = 'https://garageguysoc.com/service-areas/';
  const sorted = citiesAlphabetical();
  const cards = sorted.map((c) => {
    const svg = cityMaps[c.slug] || '';
    return `      <a href="${cityAreaHref(c.slug)}" class="area-card">
        <div class="area-card__map">${svg}</div>
        <div class="area-card__body">
          <div class="area-card__name">${c.name}</div>
          <div class="area-card__meta">Garage door repair · Same-day</div>
        </div>
      </a>`;
  }).join('\n');

  const hubSchema = JSON.stringify(
    {
      '@context': 'https://schema.org',
      ...localBusinessFields({
        description: 'Garage door repair service areas across Orange County, California.',
        areaServed: sorted.map((c) => ({
          '@type': 'City',
          name: c.name,
          containedInPlace: { '@type': 'State', name: 'California' },
        })),
      }),
    },
    null,
    2,
  );

  const hubLogoAlt = 'Garage Guys garage door repair Orange County CA';

  return `${headBlock({
    title: 'Service Areas | Garage Door Repair Orange County | Garage Guys',
    description:
      'Garage Guys service areas across all 34 Orange County cities — Irvine, Anaheim, Newport Beach, Huntington Beach, and more. Call (949) 539-0009.',
    canonical,
    ogTitle: 'Service Areas | Garage Guys Orange County',
    schema: hubSchema,
  })}
${siteNav({ logoAlt: `${hubLogoAlt} — home`, active: 'areas' })}

<header class="service-hero">
  <div class="service-hero__inner">
    <div class="service-hero__eyebrow">Orange County, California</div>
    <h1 class="service-hero__title">Service Areas</h1>
    <p class="service-hero__lead">Same-day garage door repair across Orange County — select your city for local service details, maps, and direct links to repair, spring, opener, and emergency help.</p>
${heroActionsBlock()}
  </div>
</header>

<main class="service-main">
  <div class="service-main__inner service-main__inner--wide">
    <div class="areas-grid">
${cards}
    </div>
    <p class="service-home-link"><a href="/">← Back to Garage Guys home</a></p>
  </div>
</main>

${ctaBlock({
    title: 'Need Garage Door Help Today?',
    text: 'Call now for same-day service anywhere in Orange County.',
  })}

${pageTail(hubLogoAlt)}`;
}

const cityMaps = {};
const censusCities = await fetchOrangeCountyCities(CITIES.map((c) => c.name));
const censusByName = new Map(censusCities.map((c) => [c.name, c]));

for (const city of CITIES) {
  const geo = censusByName.get(city.name);
  cityMaps[city.slug] = geo ? cityToSvg(geo) : '';
}

const pagesByPath = new Map(buildAllPages().map((p) => [p.path, p]));
const cityMapsByName = new Map(CITIES.map((c) => [c.name, cityMaps[c.slug]]));

await writeStaticHtml('service-areas', renderHub(cityMaps));
console.log('wrote service-areas/');

for (const city of CITIES) {
  await writeStaticHtml(
    `service-areas/${city.slug}`,
    renderCityPage(city, pagesByPath, cityMapsByName),
  );
  console.log('wrote service-areas/' + city.slug);
}

// Merge service area URLs into sitemap via regenerate script constants
const seoScript = await readFile(path.join(root, 'scripts/generate-seo-landing-pages.mjs'), 'utf8');
if (!seoScript.includes('SERVICE_AREA')) {
  console.warn('Update generate-seo-landing-pages.mjs sitemap to include service-areas');
}

console.log(`Generated service areas: 1 hub + ${CITIES.length} cities.`);
