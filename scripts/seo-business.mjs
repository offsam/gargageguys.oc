export const FOOTER_DISCLAIMER =
  'Not a licensed contractor. All work performed under $1,000 per project per California AB 2622.';

/** Shared LocalBusiness fields for Garage Guys schema.org markup. */
export const BUSINESS_ADDRESS = {
  '@type': 'PostalAddress',
  addressLocality: 'Tustin',
  addressRegion: 'CA',
  postalCode: '92780',
  addressCountry: 'US',
};

export const BUSINESS_GEO = {
  '@type': 'GeoCoordinates',
  latitude: 33.7458,
  longitude: -117.8261,
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
  reviewCount: '67',
  bestRating: '5',
};

export const BUSINESS_SAME_AS = [
  'https://www.thumbtack.com/ca/tustin/garage-door-repair/garage-guys/service/533172338874097690',
];

export function localBusinessFields(overrides = {}) {
  return {
    '@type': 'LocalBusiness',
    '@id': 'https://garageguysoc.com/#business',
    name: 'Garage Guys',
    telephone: '+19495390009',
    url: 'https://garageguysoc.com/',
    image: 'https://garageguysoc.com/favicon-192x192.png',
    priceRange: '$$',
    address: BUSINESS_ADDRESS,
    geo: BUSINESS_GEO,
    openingHoursSpecification: BUSINESS_HOURS,
    aggregateRating: BUSINESS_RATING,
    sameAs: BUSINESS_SAME_AS,
    ...overrides,
  };
}
