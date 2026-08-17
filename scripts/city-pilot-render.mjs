import { cityNameFromPage } from './city-hero.mjs';
import {
  buildUnifiedCitySections,
  cityCanonicalUrl,
  cityHomePage,
  citySectionRoutesScript,
  citySlugFromPath,
  isCityLayoutPilot,
  isCityPilotUnifiedPath,
  renderCitySectionsHtml,
  repairHubPath,
  sectionIdFromPath,
  unifiedCityHero,
} from './city-unified.mjs';
import { localBusinessFields, faqLdJsonScript } from './seo-business.mjs';
import { navActiveFromPath, pageTail, siteNav, ctaBlock } from './shared-layout.mjs';

function schemaJson(page) {
  const areaServed =
    page.areaServed?.type === 'City'
      ? {
          '@type': 'City',
          name: page.areaServed.name,
          containedInPlace: { '@type': 'State', name: 'California' },
        }
      : {
          '@type': 'AdministrativeArea',
          name: page.areaServed?.name ?? 'Orange County, California',
        };

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      ...localBusinessFields({
        description: page.schemaDescription ?? page.description?.replace(/&amp;/g, '&'),
        areaServed,
      }),
    },
    null,
    2,
  );
}

function logoAlt(page) {
  if (page.areaServed?.type === 'City') {
    return `Garage Guys ${page.areaServed.name} CA`;
  }
  return 'Garage Guys garage door repair Orange County CA';
}

export function renderUnifiedCityPage(page, pagesByPath, cityMaps, problemPages = []) {
  const slug = citySlugFromPath(page.path);
  const repairPage = pagesByPath.get(repairHubPath(slug)) ?? page;
  const cityName = cityNameFromPage(repairPage);
  const mapSvg = cityMaps.get(cityName) ?? null;
  const alt = logoAlt(page);
  const navActive = navActiveFromPath(page.path);
  const initialSection = sectionIdFromPath(page.path);
  const sections = buildUnifiedCitySections(slug, cityName, pagesByPath, problemPages);
  const pilot = isCityLayoutPilot(slug);
  const sectionsHtml = renderCitySectionsHtml(sections, { rich: pilot, cityName });
  const heroSection = unifiedCityHero(slug, mapSvg, pagesByPath);
  const sectionRoutes = citySectionRoutesScript(slug, pagesByPath, initialSection);
  const extraStyles = pilot ? '<link rel="stylesheet" href="/css/city-service-blocks.css">' : '';
  const bodyClass = pilot ? ' class="page-city-unified"' : '';
  const canonical = slug && isCityLayoutPilot(slug) ? cityCanonicalUrl(slug) : `https://garageguysoc.com/${page.path}/`;
  const pageUrl = `https://garageguysoc.com/${page.path}/`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garage Guys">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${page.ogTitle ?? page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:image" content="https://garageguysoc.com/favicon-192x192.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${page.ogTitle ?? page.title}">
<meta name="twitter:description" content="${page.description}">
<script type="application/ld+json">
${schemaJson(page)}
</script>
${faqLdJsonScript(page)}
<meta name="theme-color" content="#0f2340">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/service-page.css">
<link rel="stylesheet" href="/css/home-hero.css">
${extraStyles}
<script src="/api/analytics.js" defer></script>
</head>
<body${bodyClass}>

<div class="site-van-bg" data-tone="hero" aria-hidden="true"></div>

${siteNav({ logoAlt: `${alt} — home`, active: navActive })}

${heroSection}

${sectionsHtml}

${ctaBlock({ title: page.ctaTitle ?? `${cityName} Service Today?`, text: page.ctaText ?? `Call now for same-day garage door service in ${cityName}.` })}

${sectionRoutes}
${pageTail(alt)}`;
}

export function renderPilotServiceAreaPage(city, pagesByPath, cityMaps, problemPages) {
  return renderUnifiedCityPage(cityHomePage(city), pagesByPath, cityMaps, problemPages);
}

export { isCityPilotUnifiedPath, cityHomePage };
