import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const today = '2026-07-11';

const CITIES = [
  {
    slug: 'irvine-ca',
    name: 'Irvine',
    blurb:
      'Irvine master-planned communities see heavy garage use — from Woodbridge townhomes to Portola Springs estates. Garage Guys handles off-track doors, broken springs, opener failures, and cable emergencies with same-day routing across the city. We stock parts for standard and oversized doors common in Irvine HOAs and quote every repair before work starts.',
  },
  {
    slug: 'anaheim-ca',
    name: 'Anaheim',
    blurb:
      'From Anaheim Hills hillside garages to west-side tracts near the Platinum Triangle, Garage Guys repairs springs, cables, panels, and openers throughout the city. Older hardware and high-cycle family doors both get full-system inspections — not quick patches. Same-day appointments available seven days a week.',
  },
  {
    slug: 'santa-ana-ca',
    name: 'Santa Ana',
    blurb:
      'Santa Ana\'s mix of historic homes and newer infill means everything from extension springs to modern torsion systems. We realign off-track doors, replace frayed cables, and fix openers that lost programming after outages. Clear upfront pricing for homeowners and rental properties alike.',
  },
  {
    slug: 'huntington-beach-ca',
    name: 'Huntington Beach',
    blurb:
      'Coastal salt air in Huntington Beach accelerates corrosion on cables, hinges, and bottom fixtures. Garage Guys services Surf City homes with corrosion-aware inspections, track cleaning, spring replacement, and opener repairs — same day when routes allow.',
  },
  {
    slug: 'newport-beach-ca',
    name: 'Newport Beach',
    blurb:
      'Newport Beach custom and wood doors need careful balancing and premium hardware service. We repair heavy coastal doors, high-cycle springs, smart openers, and sensor issues without damaging finishes. Serving Corona del Mar, Newport Coast, and harbor communities.',
  },
  {
    slug: 'costa-mesa-ca',
    name: 'Costa Mesa',
    blurb:
      'Central Orange County puts Costa Mesa on our daily routes — condos, ranch homes, and light commercial bays. Common fixes include sensor misalignment, worn rollers, off-track realignment, and spring swaps finished in one visit when parts are on the truck.',
  },
  {
    slug: 'mission-viejo-ca',
    name: 'Mission Viejo',
    blurb:
      'Mission Viejo lake-area and hillside homes often use standardized door sizes, which helps us match springs and rollers on the first trip. We fix noisy doors, broken springs, opener strain on heavy panels, and weather seal gaps at the floor.',
  },
  {
    slug: 'yorba-linda-ca',
    name: 'Yorba Linda',
    blurb:
      'Yorba Linda estate garages frequently run oversized doors with higher spring loads. Garage Guys sizes torsion springs correctly, replaces cables and bearings, and calibrates openers so motors are not overloaded on three-car openings.',
  },
  {
    slug: 'fullerton-ca',
    name: 'Fullerton',
    blurb:
      'Fullerton blends vintage garages near downtown with remodeled homes around Sunny Hills. We service extension and torsion spring systems, realign tracks, reprogram openers, and turn around rental properties quickly between tenants.',
  },
  {
    slug: 'garden-grove-ca',
    name: 'Garden Grove',
    blurb:
      'Dense Garden Grove neighborhoods mean tight driveways and high daily cycle counts. Garage Guys replaces worn rollers, fixes cables, balances doors after spring work, and programs remotes and keypads in the same appointment.',
  },
  {
    slug: 'fountain-valley-ca',
    name: 'Fountain Valley',
    blurb:
      'Fountain Valley\'s central OC location enables fast dispatch for stuck doors, broken springs, and opener gear failures. We carry common parts for ranch-style homes and condo carports, with free estimates before any repair begins.',
  },
  {
    slug: 'lake-forest-ca',
    name: 'Lake Forest',
    blurb:
      'Lake Forest planned communities use consistent door sizes — ideal for same-day spring and roller replacement. We serve Foothill Ranch and Baker Ranch with HOA-friendly scheduling, debris cleanup, and full safety tests after every job.',
  },
  {
    slug: 'laguna-niguel-ca',
    name: 'Laguna Niguel',
    blurb:
      'Laguna Niguel hillside lots add weight and track angle challenges. Garage Guys inspects spring tension, corrosion on coastal hardware, and opener force settings on premium belt-drive units common in south OC.',
  },
  {
    slug: 'orange-ca',
    name: 'Orange',
    blurb:
      'Orange features historic Old Towne garages and Chapman-area rentals alongside newer tracts. We handle tilt-up and sectional doors, extension spring aging, and emergency off-track calls with transparent on-site quotes.',
  },
  {
    slug: 'tustin-ca',
    name: 'Tustin',
    blurb:
      'Tustin is at the heart of our service area — Old Town vintage garages and newer developments near The District both get fast response. Local routes mean shorter wait times for spring emergencies, opener failures, and cable repairs.',
  },
];

const sharedTail = `  <div class="fab-bar" id="fab-bar">
  <a href="tel:+19495390009" class="fab-call" aria-label="Call (949) 539-0009">
    <span>(949) 539-0009</span>
  </a>
  <button type="button" class="fab-callback" data-open-callback aria-label="Request a callback">
    <span class="fab-callback-label">Free estimate</span>
    <span class="fab-callback-title">Request Callback</span>
  </button>
</div>

<div class="callback-modal" id="callback-modal" aria-hidden="true">
  <div class="callback-backdrop" data-close-callback></div>
  <div class="callback-dialog" role="dialog" aria-labelledby="callback-title" aria-modal="true">
    <button type="button" class="callback-close" data-close-callback aria-label="Close">&times;</button>
    <div id="callback-form-wrap">
      <h3 id="callback-title">We'll Call You Back</h3>
      <p>Leave your name, number and ZIP — Sam usually responds within the hour.</p>
      <form class="callback-form" id="callback-form">
        <label>Your Name
          <input type="text" name="name" required autocomplete="name" placeholder="John Smith">
        </label>
        <label>Your Phone
          <input type="tel" name="phone" required autocomplete="tel" placeholder="(949) 555-0000">
        </label>
        <label>ZIP Code
          <input type="text" name="zip" required autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" maxlength="10" placeholder="92660">
        </label>
        <label>What do you need? <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span>
          <textarea name="message" placeholder="Garage door won't close, need repair..."></textarea>
        </label>
        <label class="callback-honeypot" aria-hidden="true">
          Leave blank
          <input type="text" name="_gotcha" tabindex="-1" autocomplete="off">
        </label>
        <p class="callback-error" id="callback-error" hidden></p>
        <button type="submit" class="callback-submit">Send My Request</button>
      </form>
    </div>
    <div class="callback-success" id="callback-success" hidden>
      <div class="callback-success-icon">✓</div>
      <h4>You're on the list!</h4>
      <p>We'll call you back at<br><span class="callback-success-phone"></span><br>Usually within the hour — 7 days a week.</p>
      <button type="button" class="callback-done" data-close-callback>Got it</button>
    </div>
  </div>
</div>

<footer>
  <a href="/" class="footer-logo">
    <img src="/Pictures/Logo.png" alt="Garage Guys">
  </a>
  <div class="footer-copy">© 2026 Garage Guys · <a href="/">Orange County &amp; Inland Empire, CA</a></div>
  <p class="footer-disclaimer">Not a licensed contractor. All work performed under $1,000 per project.</p>
</footer>

<script src="/js/callback-form.js"></script>
<link rel="stylesheet" href="/css/ai-chat.css">
<script src="/js/ai-chat.js" defer></script>
</body>
</html>`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function simplifyRing(ring, maxPoints = 100) {
  if (ring.length <= maxPoints) return ring;
  const step = Math.ceil(ring.length / maxPoints);
  const out = ring.filter((_, i) => i % step === 0);
  if (out[0] !== ring[0]) out.push(ring[0]);
  return out;
}

function ringToPath(ring, w, h, pad) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const scale = Math.min((w - 2 * pad) / (maxLon - minLon), (h - 2 * pad) / (maxLat - minLat));
  const pts = ring.map(([lon, lat]) => {
    const x = pad + (lon - minLon) * scale;
    const y = pad + (maxLat - lat) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${pts.join(' L ')} Z`;
}

function geoToSvg(geojson) {
  const w = 400;
  const h = 400;
  const pad = 24;
  let ring = null;
  if (geojson?.type === 'Polygon') ring = geojson.coordinates[0];
  else if (geojson?.type === 'MultiPolygon') ring = geojson.coordinates[0][0];
  if (!ring) {
    return `<svg viewBox="0 0 ${w} ${h}" class="city-map__svg" aria-hidden="true"><circle cx="200" cy="200" r="80" fill="rgba(46,109,164,0.12)" stroke="#2e6da4" stroke-width="2"/></svg>`;
  }
  ring = simplifyRing(ring);
  const d = ringToPath(ring, w, h, pad);
  return `<svg viewBox="0 0 ${w} ${h}" class="city-map__svg" aria-hidden="true" role="img"><path d="${d}" fill="rgba(46,109,164,0.14)" stroke="#2e6da4" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}

async function fetchCityGeo(name) {
  const q = encodeURIComponent(`${name}, Orange County, California, USA`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&polygon_geojson=1&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'garageguysoc-service-areas/1.0' } });
  const data = await res.json();
  return data[0]?.geojson ?? null;
}

function schemaJson(city) {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': 'https://garageguysoc.com/#business',
      name: 'Garage Guys',
      description: `Garage door repair and service in ${city.name}, California.`,
      telephone: '+19495390009',
      url: 'https://garageguysoc.com/',
      image: 'https://garageguysoc.com/favicon-192x192.png',
      priceRange: '$$',
      areaServed: {
        '@type': 'City',
        name: city.name,
        containedInPlace: { '@type': 'State', name: 'California' },
      },
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '07:00',
        closes: '20:00',
      },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: '5.0', reviewCount: '67', bestRating: '5' },
      sameAs: [
        'https://www.thumbtack.com/ca/tustin/garage-door-repair/garage-guys/service/533172338874097690',
      ],
    },
    null,
    2,
  );
}

function serviceLinks(slug) {
  const citySeo = slug !== 'tustin-ca';
  return [
    { label: 'Garage Door Repair', href: citySeo ? `/garage-door-repair/${slug}/` : '/garage-door-repair/orange-county/' },
    { label: 'Spring Repair', href: citySeo ? `/garage-door-spring-repair/${slug}/` : '/garage-door-spring-repair/orange-county/' },
    { label: 'Opener Repair', href: citySeo ? `/garage-door-opener-repair/${slug}/` : '/garage-door-opener-repair/orange-county/' },
    { label: 'Cable Repair', href: '/garage-door-cable-repair/' },
    { label: 'Off Track Repair', href: '/garage-door-off-track/' },
    { label: 'Emergency Service', href: '/emergency-garage-door-repair/orange-county/' },
  ];
}

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
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/service-page.css">
<link rel="stylesheet" href="/css/service-areas.css">
<script src="/api/analytics.js" defer></script>
<script type="application/ld+json">
${schema}
</script>
</head>
<body>
<div class="site-van-bg" aria-hidden="true"></div>
<nav class="nav-seo">
  <a href="/" class="nav-logo">
    <img src="/Pictures/Logo.png" alt="Garage Guys — home">
  </a>
</nav>`;
}

function renderCityPage(city, mapSvg) {
  const canonical = `https://garageguysoc.com/service-areas/${city.slug}/`;
  const title = `Garage Door Repair ${city.name} CA | Service Area | Garage Guys`;
  const description = `Garage door repair in ${city.name}, CA — springs, openers, cables &amp; emergency service. Same-day OC dispatch. Call (949) 539-0009.`;
  const services = serviceLinks(city.slug)
    .map((s) => `        <li><a href="${s.href}">${s.label}</a></li>`)
    .join('\n');

  return `${headBlock({
    title,
    description,
    canonical,
    ogTitle: `Garage Door Repair ${city.name} CA | Garage Guys`,
    schema: schemaJson(city),
  })}
<header class="service-areas-hero">
  <div class="service-areas-hero__inner">
    <h1>Garage Door Repair in ${city.name}, CA</h1>
    <p>Same-day garage door service across ${city.name} — repair, springs, openers, cables, and emergencies.</p>
  </div>
</header>
<main class="service-areas-main">
  <div class="service-areas-main__inner city-page">
    <div class="city-map-panel">
      <h2>${city.name} Service Area</h2>
      <div class="city-map__wrap">
        ${mapSvg}
      </div>
    </div>
    <div class="city-content-panel">
      <p>${city.blurb}</p>
      <p>Garage Guys is based in Orange County and routes technicians through ${city.name} daily. Every job includes a safety check and upfront quote before work begins.</p>
      <div class="city-phone-block">
        <a href="tel:+19495390009" class="city-phone">(949) 539-0009</a>
        <a href="tel:+19495390009" class="btn-call-now">Call Now</a>
      </div>
      <div class="city-cta-row">
        <button type="button" class="btn-callback-inline" data-open-callback>
          Request Callback
          <span>Free Estimate</span>
        </button>
      </div>
      <nav class="city-services" aria-label="Services in ${city.name}">
        <h2>Services in ${city.name}</h2>
        <ul class="city-services__list">
${services}
        </ul>
      </nav>
      <p class="service-areas-back"><a href="/service-areas/">← All service areas</a> · <a href="/">Garage Guys home</a></p>
    </div>
  </div>
</main>
${sharedTail}`;
}

function renderHub(cityMaps) {
  const canonical = 'https://garageguysoc.com/service-areas/';
  const cards = CITIES.map((c) => {
    const svg = cityMaps[c.slug] || '';
    return `      <a href="/service-areas/${c.slug}/" class="area-card">
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
      '@type': 'LocalBusiness',
      '@id': 'https://garageguysoc.com/#business',
      name: 'Garage Guys',
      telephone: '+19495390009',
      url: 'https://garageguysoc.com/',
      areaServed: CITIES.map((c) => ({ '@type': 'City', name: c.name })),
    },
    null,
    2,
  );

  return `${headBlock({
    title: 'Service Areas | Garage Door Repair Orange County | Garage Guys',
    description:
      'Garage Guys service areas across Orange County — Irvine, Anaheim, Newport Beach, Huntington Beach, and 11 more cities. Call (949) 539-0009.',
    canonical,
    ogTitle: 'Service Areas | Garage Guys Orange County',
    schema: hubSchema,
  })}
<header class="service-areas-hero">
  <div class="service-areas-hero__inner">
    <h1>Service Areas</h1>
    <p>Same-day garage door repair across Orange County — select your city for local service details, maps, and direct links to repair, spring, opener, and emergency help.</p>
  </div>
</header>
<main class="service-areas-main">
  <div class="service-areas-main__inner">
    <div class="areas-grid">
${cards}
    </div>
    <p class="service-areas-back" style="margin-top:28px"><a href="/">← Back to Garage Guys home</a></p>
  </div>
</main>
${sharedTail}`;
}

const cityMaps = {};

for (const city of CITIES) {
  console.log('fetching outline', city.name);
  const geo = await fetchCityGeo(city.name);
  cityMaps[city.slug] = geoToSvg(geo);
  await sleep(1100);
}

await mkdir(path.join(root, 'service-areas'), { recursive: true });
await writeFile(path.join(root, 'service-areas/index.html'), renderHub(cityMaps), 'utf8');
console.log('wrote service-areas/');

for (const city of CITIES) {
  const dir = path.join(root, 'service-areas', city.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), renderCityPage(city, cityMaps[city.slug]), 'utf8');
  console.log('wrote service-areas/' + city.slug);
}

// Merge service area URLs into sitemap via regenerate script constants
const seoScript = await readFile(path.join(root, 'scripts/generate-seo-landing-pages.mjs'), 'utf8');
if (!seoScript.includes('SERVICE_AREA')) {
  console.warn('Update generate-seo-landing-pages.mjs sitemap to include service-areas');
}

console.log(`Generated service areas: 1 hub + ${CITIES.length} cities.`);
