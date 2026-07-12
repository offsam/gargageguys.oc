const PHONE_ICON = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

export function isCityLandingPage(path) {
  if (/^garage-door-(cable-repair|off-track)\/[a-z0-9-]+-ca$/.test(path)) return false;
  return path.endsWith('-ca') && !path.includes('orange-county');
}

export function cityNameFromPage(page) {
  if (page.areaServed?.type === 'City') return page.areaServed.name;
  const m = page.eyebrow?.match(/^(.+),\s*California$/);
  return m ? m[1] : page.eyebrow;
}

export function serviceBadgeFromPath(path, { anchorMode = false } = {}) {
  if (anchorMode) return { label: 'Garage Door Repair', href: '#repair' };
  if (path.includes('spring-repair')) return { label: 'Spring Repair', href: '/garage-door-spring-repair/' };
  if (path.includes('opener-repair')) return { label: 'Opener Repair', href: '/garage-door-opener-repair/' };
  if (path.includes('emergency')) return { label: 'Emergency Service', href: '/emergency-garage-door-repair/orange-county/' };
  return { label: 'Garage Door Repair', href: '/garage-door-repair/' };
}

export function heroTitleLines(page) {
  const line1 = page.h1.replace(/,\s*CA\s*$/i, '').trim();
  return { line1, line2: 'Same-Day Service' };
}

/** Service links for the city strip (above stats bar). */
export function cityStripServiceItems(page) {
  const city = cityNameFromPage(page);
  const slugMatch = page.path.match(/([a-z0-9-]+-ca)$/);
  const slug = slugMatch?.[1];
  if (!slug) return [];

  const path = page.path;
  const items = [];

  if (!path.startsWith('garage-door-repair/')) {
    items.push({ href: `/garage-door-repair/${slug}/`, label: 'Garage Door Repair' });
  }
  if (!path.startsWith('garage-door-spring-repair/')) {
    items.push({ href: `/garage-door-spring-repair/${slug}/`, label: 'Spring Repair' });
  }
  if (!path.startsWith('garage-door-opener-repair/')) {
    items.push({ href: `/garage-door-opener-repair/${slug}/`, label: 'Opener Repair' });
  }
  items.push({ href: '/garage-door-cable-repair/', label: 'Cable Repair' });
  items.push({ href: '/garage-door-off-track/', label: 'Off Track Repair' });
  items.push({ href: `/service-areas/${slug}/`, label: `${city} Service Area` });
  return items;
}

export function cityServicesStripBlock({ cityName, items = [], features = [], docked = false }) {
  if (!items.length && !features.length) return '';

  const dockClass = docked ? ' city-services-strip--dock' : '';
  const links = items
    .map(
      (item) =>
        `      <a href="${item.href}" class="city-service-link">${item.label}</a>`,
    )
    .join('\n');

  const featuresHtml = features.length
    ? `
    <div class="city-services-strip__features">
${features.map((f) => `      <span class="city-service-feature">${f}</span>`).join('\n')}
    </div>`
    : '';

  const linksBlock = items.length
    ? `
    <div class="city-services-strip__links">
${links}
    </div>`
    : '';

  return `<div class="city-services-strip${dockClass}">
  <div class="city-services-strip__inner">
    <h2 class="city-services-strip__title">Services in ${cityName}</h2>
${linksBlock}${featuresHtml}
  </div>
</div>`;
}

export function statsBarBlock() {
  return `<div class="stats-bar" data-van-tone="dark">
  <div class="stats-inner">
    <div class="stat-item">
      <div class="stat-num">Same<span>-</span>Day</div>
      <div class="stat-label">Service Available</div>
    </div>
    <div class="stat-item stat-item--warranty">
      <div class="stat-num">Up to 1 <span>Year</span></div>
      <div class="stat-label">Labor Warranty</div>
    </div>
    <div class="stat-item stat-item--reviews">
      <a class="stat-tt-link" target="_blank" rel="noopener noreferrer" href="https://www.thumbtack.com/ca/tustin/garage-door-repair/garage-guys/service/533172338874097690" aria-label="See 67 reviews on Thumbtack"></a>
      <div class="stat-num">
        <span class="stat-review-score">5.0</span>
        <span class="stat-review-stars">★★★★★</span>
      </div>
      <div class="stat-label">67 Reviews · Thumbtack</div>
    </div>
    <div class="stat-item stat-item--parts-warranty">
      <div class="stat-num">1<span>–5</span> Years</div>
      <div class="stat-label">Parts Warranty</div>
    </div>
  </div>
</div>`;
}

export function cityHeroBlock(page, mapSvg, { serviceItems = [], features = [], dockStrip = false, mapLarge = false, mapBare = false, footerDock = false, badge: badgeOverride } = {}) {
  const city = cityNameFromPage(page);
  const eyebrow = `${city}, California`;
  const { line1, line2 } = heroTitleLines(page);
  const anchorMode = dockStrip || serviceItems.some((i) => i.href?.startsWith('#'));
  const badge = badgeOverride ?? serviceBadgeFromPath(page.path, { anchorMode });
  const servicesStrip = cityServicesStripBlock({
    cityName: city,
    items: serviceItems,
    features,
    docked: dockStrip,
  });
  const heroClass = mapLarge ? 'hero hero--city hero--city-map-lg' : 'hero hero--city';
  const mapClasses = [
    mapLarge ? 'hero-city-map hero-city-map--lg' : 'hero-city-map',
    mapBare ? 'hero-city-map--bare' : '',
  ].filter(Boolean).join(' ');
  const mapBlock = mapSvg
    ? `<div class="hero-map-col">
      <div class="${mapClasses}" aria-hidden="false">
        ${mapSvg}
      </div>
    </div>`
    : '';

  const stats = statsBarBlock();
  const footer = footerDock
    ? `<div class="city-hero-footer">
${servicesStrip}
${stats}
</div>`
    : `${servicesStrip}
${stats}`;

  const outerOpen = footerDock ? '<div class="city-hero-stack" id="home">' : '';
  const outerClose = footerDock ? '</div>' : '';

  return `${outerOpen}<section class="${heroClass}" data-van-tone="hero">
  <div class="hero-bg"></div>
  <div class="hero-grid"></div>
  <div class="hero-layout">
    <div class="hero-content">
      <div class="hero-eyebrow">${eyebrow}</div>
      <a href="${badge.href}" class="hero-handyman">${badge.label}</a>
      <h1 class="hero-title">
        <span class="hero-title__line">${line1}</span>
        <span class="hero-title__line hero-title__line--accent">${line2}</span>
      </h1>
      <p class="hero-lead">${page.lead}</p>
      <div class="hero-phone-big">
        <div class="hero-phone-label">Tap to call · free estimate</div>
        <a href="tel:+19495390009" class="hero-phone-number phone-link" aria-label="Call (949) 539-0009">
          <span class="hero-phone-icon" aria-hidden="true">${PHONE_ICON}</span>
          (949) 539-0009
        </a>
        <button type="button" class="stat-item stat-item--callback hero-callback-btn" data-open-callback aria-label="Request a callback">
          <div class="stat-num">Request <span>Callback</span></div>
          <div class="stat-label">Free Estimate</div>
        </button>
      </div>
    </div>
    ${mapBlock}
  </div>
</section>
${footer}${outerClose}`;
}
