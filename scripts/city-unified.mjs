import { cityHeroBlock, cityNameFromPage } from './city-hero.mjs';
import { getCityContent, OC_CITY_SLUGS } from './oc-city-content.mjs';
import { seoMetaDescription } from './seo-meta.mjs';

export const CITY_LAYOUT_PILOT = 'irvine-ca';

export function isCityLayoutPilot(slug) {
  return OC_CITY_SLUGS.has(slug);
}

export const CITY_SERVICE_ANCHORS = [
  { id: 'repair', label: 'Garage Door Repair' },
  { id: 'spring', label: 'Spring Repair' },
  { id: 'opener', label: 'Opener Repair' },
  { id: 'cable', label: 'Cable Repair' },
  { id: 'off-track', label: 'Off Track Repair' },
];

export function cityStripAnchorItems() {
  return CITY_SERVICE_ANCHORS.map((item) => ({
    href: `#${item.id}`,
    label: item.label,
  }));
}

export function isCityRepairHub(path) {
  return /^garage-door-repair\/[a-z0-9-]+-ca$/.test(path);
}

export function isCitySpringOrOpenerPath(path) {
  return /^garage-door-(spring|opener)-repair\/[a-z0-9-]+-ca$/.test(path);
}

export function cityHomePage(city) {
  const name = city.name;
  const content = getCityContent(city.slug);
  return {
    path: `service-areas/${city.slug}`,
    h1: `${name}, California`,
    title: `Garage Guys ${name} CA | Same-Day Garage Door Service`,
    ogTitle: `Garage Guys ${name} CA | Garage Guys`,
    description: seoMetaDescription(content?.homeLead, {
      fallback: `Same-day garage door service in ${name}, CA — repair, springs, openers, cables and emergency help.`,
    }),
    schemaDescription: `Garage door repair and service in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead: content?.homeLead ?? `Your local Garage Guys crew in ${name} — same-day repair, springs, openers, and emergency service when routes are open.`,
    ctaTitle: `${name} Service Today?`,
    ctaText: `Call now for same-day garage door service in ${name}.`,
    areaServed: { type: 'City', name },
  };
}

export function pilotCablePage(slug, cityName) {
  return {
    path: `garage-door-cable-repair/${slug}`,
    h1: `Garage Door Cable Repair in ${cityName}, CA`,
    title: `Garage Door Cable Repair ${cityName} CA | Same-Day | Garage Guys`,
    ogTitle: `Garage Door Cable Repair ${cityName} CA | Garage Guys`,
    description: `Garage door cable repair in ${cityName}, CA — frayed cables, drum issues &amp; uneven lift. Same-day. Call (949) 539-0009.`,
    schemaDescription: `Garage door cable repair in ${cityName}, California.`,
    eyebrow: `${cityName}, California`,
    lead: `Cable or drum problem in ${cityName}? We replace lift cables safely and rebalance the door.`,
    sectionTitle: `Garage Door Cable Repair in ${cityName}`,
    paragraphs: [
      `Garage Guys services frayed or snapped lift cables in ${cityName}. We inspect drums, bottom brackets, and spring tension before reinstalling correctly sized cable.`,
      `Call <a href="tel:+19495390009">(949) 539-0009</a> for a same-day estimate — seven days a week across Orange County.`,
    ],
    features: ['Same-day scheduling', 'Upfront on-site quote', 'Drum and balance check'],
    related: [
      { href: `/garage-door-repair/${slug}/`, label: `Garage Door Repair ${cityName}` },
      { href: `/garage-door-off-track/${slug}/`, label: `Off Track Repair ${cityName}` },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: `${cityName} Cable Repair`,
    ctaText: `Call now for cable repair in ${cityName}.`,
    areaServed: { type: 'City', name: cityName },
  };
}

export function pilotOffTrackPage(slug, cityName) {
  return {
    path: `garage-door-off-track/${slug}`,
    h1: `Garage Door Off Track Repair in ${cityName}, CA`,
    title: `Garage Door Off Track Repair ${cityName} CA | Same-Day | Garage Guys`,
    ogTitle: `Garage Door Off Track Repair ${cityName} CA | Garage Guys`,
    description: `Garage door off track in ${cityName}, CA? Safe realignment &amp; roller repair. Same-day. Call (949) 539-0009.`,
    schemaDescription: `Garage door off track repair in ${cityName}, California.`,
    eyebrow: `${cityName}, California`,
    lead: `Door jumped the track in ${cityName}? Stop using the opener — we realign tracks and replace damaged rollers.`,
    sectionTitle: `Garage Door Off Track Repair in ${cityName}`,
    paragraphs: [
      `Garage Guys safely resets off-track doors in ${cityName} — rollers back in the rail, tracks straightened, and cables balanced on both sides.`,
      `Call <a href="tel:+19495390009">(949) 539-0009</a> for same-day off-track service in ${cityName} and surrounding OC cities.`,
    ],
    features: ['Safe derailment recovery', 'Track and roller service', 'Same-day appointments'],
    related: [
      { href: `/garage-door-repair/${slug}/`, label: `Garage Door Repair ${cityName}` },
      { href: `/garage-door-cable-repair/${slug}/`, label: `Cable Repair ${cityName}` },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: `${cityName} Off Track Repair`,
    ctaText: `Call now for off-track repair in ${cityName}.`,
    areaServed: { type: 'City', name: cityName },
  };
}

export function isCityPilotUnifiedPath(path) {
  const slug = citySlugFromPath(path);
  if (!slug || !isCityLayoutPilot(slug)) return isCityUnifiedPath(path);
  return /^(service-areas|garage-door-repair|garage-door-spring-repair|garage-door-opener-repair|garage-door-cable-repair|garage-door-off-track)\/[a-z0-9-]+-ca$/.test(
    path,
  );
}

export function cityServiceAreaPath(slug) {
  return `service-areas/${slug}`;
}

export function cityCanonicalUrl(slug) {
  return `https://garageguysoc.com/service-areas/${slug}/`;
}

export function isCityUnifiedHubPath(path) {
  return /^service-areas\/[a-z0-9-]+-ca$/.test(path);
}

export function isCityUnifiedPath(path) {
  return isCityRepairHub(path) || isCitySpringOrOpenerPath(path);
}

export function sectionIdFromPath(path) {
  const slug = citySlugFromPath(path);
  if (slug && isCityLayoutPilot(slug)) {
    if (/^service-areas\//.test(path)) return 'home';
    if (/^garage-door-spring-repair\//.test(path)) return 'spring';
    if (/^garage-door-opener-repair\//.test(path)) return 'opener';
    if (/^garage-door-cable-repair\//.test(path)) return 'cable';
    if (/^garage-door-off-track\//.test(path)) return 'off-track';
    if (/^garage-door-repair\//.test(path)) return 'repair';
    return 'home';
  }
  if (/^garage-door-spring-repair\/[a-z0-9-]+-ca$/.test(path)) return 'spring';
  if (/^garage-door-opener-repair\/[a-z0-9-]+-ca$/.test(path)) return 'opener';
  return 'repair';
}

export function buildCitySectionRoutes(slug, pagesByPath) {
  const repair = pagesByPath.get(repairHubPath(slug));
  const spring = pagesByPath.get(`garage-door-spring-repair/${slug}`);
  const opener = pagesByPath.get(`garage-door-opener-repair/${slug}`);
  const cable = pagesByPath.get(`garage-door-cable-repair/${slug}`);
  const offTrack = pagesByPath.get(`garage-door-off-track/${slug}`);
  const repairPath = `/garage-door-repair/${slug}/`;
  const cityName = repair?.areaServed?.name ?? cityHomePage({ slug, name: 'City' }).areaServed.name;

  const route = (id, path, page) => ({
    id,
    path,
    title: page?.title ?? '',
    description: page?.description ?? '',
  });

  if (isCityLayoutPilot(slug)) {
    const home = cityHomePage({ slug, name: cityName });
    return {
      home: route('home', `/service-areas/${slug}/`, home),
      repair: route('repair', repairPath, repair),
      spring: route('spring', `/garage-door-spring-repair/${slug}/`, spring),
      opener: route('opener', `/garage-door-opener-repair/${slug}/`, opener),
      cable: route('cable', `/garage-door-cable-repair/${slug}/`, cable ?? pilotCablePage(slug, cityName)),
      'off-track': route(
        'off-track',
        `/garage-door-off-track/${slug}/`,
        offTrack ?? pilotOffTrackPage(slug, cityName),
      ),
    };
  }

  return {
    repair: route('repair', repairPath, repair),
    spring: route('spring', `/garage-door-spring-repair/${slug}/`, spring),
    opener: route('opener', `/garage-door-opener-repair/${slug}/`, opener),
    cable: route('cable', `${repairPath}#cable`, repair),
    'off-track': route('off-track', `${repairPath}#off-track`, repair),
  };
}

export function citySectionRoutesScript(slug, pagesByPath, initialSection) {
  const routes = buildCitySectionRoutes(slug, pagesByPath);
  const payload = JSON.stringify({ slug, initialSection, routes });
  const magnet = isCityLayoutPilot(slug)
    ? '\n<script src="/js/city-scroll-magnet.js" defer></script>'
    : '';
  return `<script type="application/json" id="city-section-routes">${payload}</script>
<script src="/js/city-section-url.js" defer></script>${magnet}`;
}

export function citySlugFromPath(path) {
  return path.match(/([a-z0-9-]+-ca)$/)?.[1] ?? null;
}

export function repairHubPath(slug) {
  return `garage-door-repair/${slug}`;
}

function fallbackSection(id, cityName) {
  const titles = {
    spring: `Garage Door Spring Repair in ${cityName}`,
    opener: `Garage Door Opener Repair in ${cityName}`,
    cable: `Garage Door Cable Repair in ${cityName}`,
    'off-track': `Garage Door Off Track Repair in ${cityName}`,
  };
  return {
    id,
    title: titles[id] ?? `Garage Door Service in ${cityName}`,
    paragraphs: [
      `Garage Guys provides same-day ${titles[id]?.toLowerCase() ?? 'garage door service'} across ${cityName}. We inspect the full system, quote upfront, and carry common parts on the truck.`,
      `Call <a href="tel:+19495390009">(949) 539-0009</a> for a free estimate — seven days a week across Orange County.`,
    ],
    features: ['Same-day scheduling', 'Upfront on-site quote', 'Stocked service van', 'Safety check included'],
  };
}

function sectionFromPage(page, id) {
  if (!page) return null;
  return {
    id,
    title: page.sectionTitle || page.h1.replace(/, CA$/, ''),
    paragraphs: page.paragraphs,
    features: page.features ?? [],
  };
}

function localizeProblemParagraphs(paragraphs, cityName) {
  return paragraphs.map((p) =>
    p
      .replace(/across Orange County/gi, `in ${cityName}`)
      .replace(/Orange County including/gi, `${cityName} and surrounding OC cities including`)
      .replace(/Serving Irvine, Anaheim/gi, `Serving ${cityName} and neighbors including Irvine, Anaheim`),
  );
}

export function buildUnifiedCitySections(slug, cityName, pagesByPath, problemPages = []) {
  const content = getCityContent(slug);
  const problemByPath = new Map(problemPages.map((p) => [p.path, p]));
  const cableProblem = problemByPath.get('garage-door-cable-repair');
  const offTrackProblem = problemByPath.get('garage-door-off-track');

  const repair = sectionFromPage(pagesByPath.get(repairHubPath(slug)), 'repair');
  const spring =
    sectionFromPage(pagesByPath.get(`garage-door-spring-repair/${slug}`), 'spring') ??
    fallbackSection('spring', cityName);
  const opener =
    sectionFromPage(pagesByPath.get(`garage-door-opener-repair/${slug}`), 'opener') ??
    fallbackSection('opener', cityName);

  const cable = content?.cable?.paragraphs?.length
    ? {
        id: 'cable',
        title: `Garage Door Cable Repair in ${cityName}`,
        paragraphs: content.cable.paragraphs,
        features: pagesByPath.get(`garage-door-cable-repair/${slug}`)?.features ?? [],
      }
    : cableProblem
      ? {
          id: 'cable',
          title: `Garage Door Cable Repair in ${cityName}`,
          paragraphs: localizeProblemParagraphs(cableProblem.paragraphs, cityName),
          features: cableProblem.features ?? [],
        }
      : fallbackSection('cable', cityName);

  const offTrack = content?.offTrack?.paragraphs?.length
    ? {
        id: 'off-track',
        title: `Garage Door Off Track Repair in ${cityName}`,
        paragraphs: content.offTrack.paragraphs,
        features: pagesByPath.get(`garage-door-off-track/${slug}`)?.features ?? [],
      }
    : offTrackProblem
      ? {
          id: 'off-track',
          title: `Garage Door Off Track Repair in ${cityName}`,
          paragraphs: localizeProblemParagraphs(offTrackProblem.paragraphs, cityName),
          features: offTrackProblem.features ?? [],
        }
      : fallbackSection('off-track', cityName);

  return [repair, spring, opener, cable, offTrack].filter(Boolean);
}

const SECTION_VISUALS = {
  repair: {
    badge: 'Garage Door Repair',
    statIcon: '⚡',
    statValue: 'Same-Day',
    statLabel: 'Local dispatch',
    image: '/Pictures/VAN.png',
    van: true,
  },
  spring: {
    badge: 'Spring Repair',
    statIcon: '🔩',
    statValue: 'Under 2 Hrs',
    statLabel: 'Typical spring job',
    before: '/Pictures/work/before-spring-irvine.jpg',
    after: '/Pictures/work/after-spring-irvine.jpg',
    pair: 'spring',
  },
  opener: {
    badge: 'Opener Repair',
    statIcon: '📡',
    statValue: 'All Brands',
    statLabel: 'LiftMaster · Genie · myQ',
    before: '/Pictures/work/before-opener-newport.jpg',
    after: '/Pictures/work/after-opener-newport.jpg',
    pair: 'opener',
  },
  cable: {
    badge: 'Cable Repair',
    statIcon: '🔗',
    statValue: 'Safe Lift',
    statLabel: 'Cable + drum check',
    icon: '🔗',
    caption: 'Frayed cables & uneven drum tension',
    image: '/Pictures/Neon Garage.png',
  },
  'off-track': {
    badge: 'Off Track Repair',
    statIcon: '🛤️',
    statValue: 'Same-Day',
    statLabel: 'Safe realignment',
    before: '/Pictures/work/before-offtrack-anaheim.jpg',
    after: '/Pictures/work/after-offtrack-anaheim.jpg',
    pair: 'off-track',
  },
};

function sectionVisual(sectionId, cityName) {
  const base = SECTION_VISUALS[sectionId] ?? SECTION_VISUALS.repair;
  const visual = { ...base };
  if (sectionId === 'repair' && cityName) {
    visual.statLabel = `${cityName} dispatch`;
    visual.imageAlt = `Garage Guys service van — ${cityName}, CA`;
  }
  if (visual.pair === 'spring') {
    visual.beforeAlt = `Broken garage door spring before repair ${cityName} CA`;
    visual.afterAlt = `New torsion spring installed ${cityName} CA`;
  } else if (visual.pair === 'opener') {
    visual.beforeAlt = `Garage door opener issue before repair ${cityName} CA`;
    visual.afterAlt = `Garage door opener repaired ${cityName} CA`;
  } else if (visual.pair === 'off-track') {
    visual.beforeAlt = `Garage door off track before repair ${cityName} CA`;
    visual.afterAlt = `Garage door back on track after repair ${cityName} CA`;
  } else if (visual.image && !visual.van) {
    visual.imageAlt = `Garage door cable repair ${cityName} CA`;
  }
  return visual;
}

function renderSectionMedia(sectionId, visual) {
  if (visual.before && visual.after) {
    return `<div class="city-service-block__media">
      <div class="city-service-media city-service-media--pair">
        <figure class="city-service-shot">
          <img src="${visual.before}" alt="${visual.beforeAlt}" loading="lazy" width="400" height="300">
          <span class="city-service-shot__label">Before</span>
        </figure>
        <figure class="city-service-shot city-service-shot--after">
          <img src="${visual.after}" alt="${visual.afterAlt}" loading="lazy" width="400" height="300">
          <span class="city-service-shot__label">After</span>
        </figure>
      </div>
      ${renderSectionStat(visual)}
    </div>`;
  }

  if (visual.van) {
    return `<div class="city-service-block__media">
      <div class="city-service-card city-service-card--van">
        <div class="city-service-card__shine" aria-hidden="true"></div>
        <img class="city-service-card__img" src="${visual.image}" alt="${visual.imageAlt}" loading="lazy" width="640" height="480">
      </div>
      ${renderSectionStat(visual)}
    </div>`;
  }

  if (visual.icon) {
    return `<div class="city-service-block__media">
      <div class="city-service-card city-service-card--icon">
        <div class="city-service-card__shine" aria-hidden="true"></div>
        <span class="city-service-card__icon" aria-hidden="true">${visual.icon}</span>
        <p class="city-service-card__caption">${visual.caption}</p>
      </div>
      ${renderSectionStat(visual)}
    </div>`;
  }

  return `<div class="city-service-block__media">
    <div class="city-service-card">
      <div class="city-service-card__shine" aria-hidden="true"></div>
      <img class="city-service-card__img" src="${visual.image}" alt="${visual.imageAlt}" loading="lazy" width="640" height="480">
    </div>
    ${renderSectionStat(visual)}
  </div>`;
}

function renderSectionStat(visual) {
  if (!visual.statValue) return '';
  return `<div class="city-service-stat">
    <span class="city-service-stat__icon" aria-hidden="true">${visual.statIcon ?? '✓'}</span>
    <div>
      <div class="city-service-stat__value">${visual.statValue}</div>
      <div class="city-service-stat__label">${visual.statLabel}</div>
    </div>
  </div>`;
}

export function renderRichCitySectionsHtml(sections, cityName = '') {
  return sections
    .map((section, index) => {
      const visual = sectionVisual(section.id, cityName);
      const paragraphs = [...section.paragraphs];
      const lead = paragraphs.shift() ?? '';
      const restParas = paragraphs.map((p) => `        <p>${p}</p>`).join('\n');
      const chips = section.features?.length
        ? `        <ul class="city-service-block__chips">\n${section.features.map((f) => `          <li class="city-service-chip"><span class="city-service-chip__icon" aria-hidden="true">✓</span>${f}</li>`).join('\n')}\n        </ul>\n`
        : '';
      const tone = index % 2 === 0 ? 'city-service-block--light' : 'city-service-block--alt';
      const flip = index % 2 === 1 ? ' city-service-block--flip' : '';
      const media = renderSectionMedia(section.id, visual);

      return `<section class="city-service-block city-service-block--${section.id} ${tone}${flip}" id="${section.id}">
  <div class="city-service-block__glow" aria-hidden="true"></div>
  <div class="city-service-block__inner">
    <header class="city-service-block__head">
      <span class="city-service-block__badge">${visual.badge}</span>
      <h2 class="city-service-block__title">${section.title}</h2>
      <p class="city-service-block__lead">${lead}</p>
    </header>
    <div class="city-service-block__grid">
      <div class="city-service-block__copy">
${restParas}${chips}        <div class="city-service-block__actions">
          <a href="tel:+19495390009" class="city-service-block__cta city-service-block__cta--primary">Call (949) 539-0009</a>
          <button type="button" class="city-service-block__cta city-service-block__cta--ghost" data-open-callback>Request Callback</button>
        </div>
      </div>
${media}
    </div>
  </div>
</section>`;
    })
    .join('\n\n');
}

export function renderCitySectionsHtml(sections, { rich = false, cityName = '' } = {}) {
  if (rich) return renderRichCitySectionsHtml(sections, cityName);

  return sections
    .map((section, index) => {
      const paras = section.paragraphs.map((p) => `      <p>${p}</p>`).join('\n');
      const features = section.features?.length
        ? `      <ul class="service-features">\n${section.features.map((f) => `        <li>${f}</li>`).join('\n')}\n      </ul>\n`
        : '';
      const tone = index % 2 === 0 ? 'city-service-section--light' : 'city-service-section--alt';
      return `<section class="service-main city-service-section ${tone}" id="${section.id}">
  <div class="service-main__inner">
    <h2>${section.title}</h2>
${paras}${features}
  </div>
</section>`;
    })
    .join('\n\n');
}

export function renderCityAnchorRedirect(targetUrl, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0;url=${targetUrl}">
<link rel="canonical" href="${targetUrl.split('#')[0]}">
<title>${title}</title>
<script>location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body><p><a href="${targetUrl}">Continue</a></p></body>
</html>`;
}

export function unifiedCityHero(slug, mapSvg, pagesByPath) {
  const repairPage = pagesByPath.get(repairHubPath(slug));
  const cityName = repairPage ? cityNameFromPage(repairPage) : slug.replace(/-ca$/, '').replace(/-/g, ' ');
  const page = cityHomePage({ slug, name: cityName });
  return cityHeroBlock(page, mapSvg, {
    serviceItems: cityStripAnchorItems(),
    features: [],
    dockStrip: true,
    mapLarge: true,
    mapBare: true,
    footerDock: true,
    badge: { label: 'Our Services', href: '#repair' },
  });
}
