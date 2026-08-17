export const FOOTER_DISCLAIMER =
  'Not a licensed contractor. All work performed under $1,000 per project per California AB 2622.';

export const SITE_ORIGIN = 'https://garageguysoc.com';
export const BUSINESS_NAME = 'Garage Guys';
export const BUSINESS_PHONE_E164 = '+19495390009';
export const BUSINESS_PHONE_DISPLAY = '(949) 539-0009';

/** Shared LocalBusiness fields for Garage Guys schema.org markup. */
export const BUSINESS_ADDRESS = {
  '@type': 'PostalAddress',
  addressLocality: 'Newport Beach',
  addressRegion: 'CA',
  postalCode: '92660',
  addressCountry: 'US',
};

export const BUSINESS_LOCATION_DISPLAY = `${BUSINESS_ADDRESS.addressLocality}, ${BUSINESS_ADDRESS.addressRegion} ${BUSINESS_ADDRESS.postalCode}`;

export const BUSINESS_GEO = {
  '@type': 'GeoCoordinates',
  latitude: 33.6641495,
  longitude: -117.8724153,
};

export const BUSINESS_HOURS = {
  '@type': 'OpeningHoursSpecification',
  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  opens: '07:00',
  closes: '20:00',
};

export const BUSINESS_RATING = {
  '@type': 'AggregateRating',
  ratingValue: '5.0',
  reviewCount: '74',
  bestRating: '5',
};

export const THUMBTACK_URL =
  'https://www.thumbtack.com/ca/tustin/garage-door-repair/garage-guys/service/533172338874097690';
export const THUMBTACK_REVIEW_COUNT = '74';

/** Short share link for UI; full place URL is better for schema. */
export const GOOGLE_MAPS_URL = 'https://maps.app.goo.gl/67GLPdiUocxgueEh8';
export const GOOGLE_MAPS_PLACE_URL =
  'https://www.google.com/maps/place/Garage+Guys/@33.6641495,-117.8724153,17z/data=!4m6!3m5!1s0x43ab6332ea244b2b:0xee9d549c4475ae56!8m2!3d33.6641495!4d-117.8724153!16s%2Fg%2F11nr2gs_vt';
/** Update when Google review count changes (Maps scrape is unreliable). */
export const GOOGLE_REVIEW_COUNT = '7';
export const GOOGLE_RATING = '5.0';

export const BUSINESS_SAME_AS = [THUMBTACK_URL, GOOGLE_MAPS_PLACE_URL];

export function formatClock(hhmm) {
  const [hourRaw, minuteRaw] = String(hhmm || '00:00').split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw) || 0;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hr = hour % 12 || 12;
  return `${hr}:${String(minute).padStart(2, '0')} ${ampm}`;
}

export const BUSINESS_HOURS_DISPLAY = `${formatClock(BUSINESS_HOURS.opens)}–${formatClock(BUSINESS_HOURS.closes)}, 7 days a week`;

export function localBusinessFields(overrides = {}) {
  return {
    '@type': 'LocalBusiness',
    '@id': `${SITE_ORIGIN}/#business`,
    name: BUSINESS_NAME,
    telephone: BUSINESS_PHONE_E164,
    url: `${SITE_ORIGIN}/`,
    image: `${SITE_ORIGIN}/favicon-192x192.png`,
    priceRange: '$$',
    address: BUSINESS_ADDRESS,
    geo: BUSINESS_GEO,
    openingHoursSpecification: BUSINESS_HOURS,
    aggregateRating: BUSINESS_RATING,
    sameAs: BUSINESS_SAME_AS,
    ...overrides,
  };
}

export function ldJsonScript(data) {
  return `<script type="application/ld+json">
${JSON.stringify(data, null, 2)}
</script>`;
}

function faqTopicFromPath(pagePath = '') {
  const path = String(pagePath);
  if (path.includes('emergency')) return 'emergency garage door repair';
  if (path.includes('wont-open') || path.includes("won't-open")) return 'a garage door that will not open';
  if (path.includes('wont-close') || path.includes("won't-close")) return 'a garage door that will not close';
  if (path.includes('off-track')) return 'off-track garage door repair';
  if (path.includes('cable')) return 'garage door cable repair';
  if (path.includes('torsion')) return 'torsion spring repair';
  if (path.includes('broken-garage-door-spring')) return 'broken garage door spring repair';
  if (path.includes('spring-repair-cost')) return 'garage door spring replacement';
  if (path.includes('opener')) return 'garage door opener repair';
  if (path.includes('spring')) return 'garage door spring repair';
  if (path.startsWith('service-areas')) return 'garage door service';
  return 'garage door repair';
}

function placeName(page) {
  const area = page?.areaServed;
  if (area?.type === 'City' && area.name) return area.name;
  if (area?.name) return area.name.replace(/, California$/, '');
  return 'Orange County';
}

/** 3–4 FAQ Q&As for generated landings — phone/hours/rating from this file only. */
export function landingFaqItems(page = {}) {
  const place = placeName(page);
  const topic = faqTopicFromPath(page.path);
  const phone = BUSINESS_PHONE_DISPLAY;
  return [
    {
      name: `Do you offer same-day ${topic} in ${place}?`,
      text: `Yes. ${BUSINESS_NAME} routes technicians through ${place} ${BUSINESS_HOURS_DISPLAY}. Most jobs are quoted on-site and finished in one visit when you call before early afternoon. Call ${phone}.`,
    },
    {
      name: `How much does ${topic} cost in ${place}?`,
      text: `It depends on the door type and weight. We inspect on-site and quote before any work starts — no phone guesswork. ${FOOTER_DISCLAIMER} Call ${phone} for a free estimate.`,
    },
    {
      name: `Is ${BUSINESS_NAME} a licensed contractor?`,
      text: `${FOOTER_DISCLAIMER} We are insured and based in ${BUSINESS_LOCATION_DISPLAY}. Call ${phone}.`,
    },
    {
      name: `What area does ${BUSINESS_NAME} cover near ${place}?`,
      text: `We serve ${place} and greater Orange County from ${BUSINESS_LOCATION_DISPLAY}. ${BUSINESS_RATING.ratingValue} average from ${BUSINESS_RATING.reviewCount}+ reviews. Call ${phone}.`,
    },
  ];
}

export function faqPageJsonLd(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: landingFaqItems(page).map((item) => ({
      '@type': 'Question',
      name: item.name,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.text,
      },
    })),
  };
}

export function faqLdJsonScript(page) {
  return ldJsonScript(faqPageJsonLd(page));
}

const PATH_CRUMB_LABELS = {
  'garage-door-repair': 'Garage Door Repair',
  'garage-door-spring-repair': 'Garage Door Spring Repair',
  'garage-door-opener-repair': 'Garage Door Opener Repair',
  'emergency-garage-door-repair': 'Emergency Garage Door Repair',
  'garage-door-wont-open': "Garage Door Won't Open",
  'garage-door-wont-close': "Garage Door Won't Close",
  'garage-door-off-track': 'Garage Door Off Track',
  'broken-garage-door-spring': 'Broken Garage Door Spring',
  'garage-door-cable-repair': 'Garage Door Cable Repair',
  'garage-door-torsion-spring-repair': 'Garage Door Torsion Spring Repair',
  'garage-door-spring-repair-cost': 'Garage Door Spring Repair Cost',
  'service-areas': 'Service Areas',
};

function pathUrl(pagePath = '') {
  const p = String(pagePath).replace(/^\/+|\/+$/g, '');
  return p ? `${SITE_ORIGIN}/${p}/` : `${SITE_ORIGIN}/`;
}

function crumbLabel(segment, fallback = '') {
  return PATH_CRUMB_LABELS[segment] || fallback || segment.replace(/-/g, ' ');
}

/** Home → Service Areas → Irvine (or problem/county equivalent). */
export function breadcrumbTrail(page = {}) {
  const home = { name: 'Home', url: `${SITE_ORIGIN}/` };
  const path = String(page.path || '').replace(/^\/+|\/+$/g, '');
  const cityName = page.areaServed?.type === 'City' ? page.areaServed.name : '';

  if (!path) return [home];

  if (path === 'service-areas') {
    return [home, { name: 'Service Areas', url: pathUrl('service-areas') }];
  }

  const cityHub = path.match(/^service-areas\/([a-z0-9-]+-ca)$/);
  if (cityHub) {
    return [
      home,
      { name: 'Service Areas', url: pathUrl('service-areas') },
      { name: cityName || crumbLabel(cityHub[1]), url: pathUrl(path) },
    ];
  }

  const cityService = path.match(/^(garage-door-[a-z0-9-]+)\/([a-z0-9-]+-ca)$/);
  if (cityService) {
    return [
      home,
      { name: 'Service Areas', url: pathUrl('service-areas') },
      {
        name: cityName || crumbLabel(cityService[2]),
        url: pathUrl(`service-areas/${cityService[2]}`),
      },
    ];
  }

  const county = path.match(/^(garage-door-[a-z0-9-]+|emergency-garage-door-repair)\/orange-county$/);
  if (county) {
    return [
      home,
      { name: crumbLabel(county[1]), url: pathUrl(county[1]) },
      { name: 'Orange County', url: pathUrl(path) },
    ];
  }

  return [home, { name: crumbLabel(path, page.h1), url: pathUrl(path) }];
}

export function breadcrumbJsonLd(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbTrail(page).map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

export function breadcrumbLdJsonScript(page) {
  return ldJsonScript(breadcrumbJsonLd(page));
}
