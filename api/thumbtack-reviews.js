const THUMBTACK_URL =
  'https://www.thumbtack.com/ca/tustin/garage-door-repair/garage-guys/service/533172338874097690';
const FALLBACK_COUNT = 74;
const CACHE_TTL_MS = 3.5 * 24 * 60 * 60 * 1000;

let cache = null;

function parseReviewCount(html) {
  const short = html.match(/"shortNumReviewsText"\s*:\s*"\((\d+)\)"/);
  if (short) return Number(short[1]);
  const visible = html.match(/>(\d+)\s+reviews</i);
  if (visible) return Number(visible[1]);
  const schema = html.match(/"reviewCount"\s*:\s*(\d+)/);
  if (schema) return Number(schema[1]);
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const origin = req.headers.origin || '';
  if (
    origin.includes('garageguysoc.com') ||
    origin.includes('pullgaragedoor.com') ||
    origin.endsWith('.vercel.app') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=259200');
    res.status(200).json({ reviewCount: cache.count, source: 'cache' });
    return;
  }

  try {
    const response = await fetch(THUMBTACK_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GarageGuysOC/1.0; +https://garageguysoc.com/)',
        Accept: 'text/html',
      },
    });
    if (!response.ok) throw new Error(`Thumbtack HTTP ${response.status}`);
    const html = await response.text();
    const count = parseReviewCount(html);
    if (!count || count < 1 || count > 10000) throw new Error('Could not parse review count');
    cache = { count, fetchedAt: Date.now() };
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=259200');
    res.status(200).json({ reviewCount: count, source: 'thumbtack' });
  } catch {
    const count = cache?.count ?? FALLBACK_COUNT;
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ reviewCount: count, source: 'fallback' });
  }
};
