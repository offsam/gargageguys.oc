const {
  fetchSearchConsoleMetrics,
  fetchGa4Metrics,
  getDefaultPeriod,
} = require('../lib/google-seo');

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth === `Bearer ${cronSecret}`) return true;
  }
  return req.headers['x-vercel-cron'] === '1';
}

async function sendAiCouncilSeoMetrics(payload) {
  const baseUrl = String(process.env.AI_COUNCIL_BASE_URL || '').trim().replace(/\/$/, '');
  const secret = process.env.GARAGE_GUYS_LEAD_WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    return { skipped: true, reason: 'AI Council env not configured' };
  }

  const res = await fetch(`${baseUrl}/api/public/garage-guys/seo-metrics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`AI Council seo-metrics failed: ${await res.text()}`);
  }

  return res.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const siteUrl = process.env.GSC_SITE_URL?.trim() || 'sc-domain:garageguysoc.com';
  const ga4PropertyId = process.env.GA4_PROPERTY_ID?.trim() || '';
  const period = getDefaultPeriod(Number(process.env.SEO_SYNC_DAYS || 28));

  try {
    const tasks = [];
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      tasks.push(
        fetchSearchConsoleMetrics(siteUrl, period).then((searchConsole) => ({ searchConsole })),
      );
      if (ga4PropertyId) {
        tasks.push(
          fetchGa4Metrics(ga4PropertyId, period).then((ga4) => ({ ga4 })),
        );
      }
    }

    if (!tasks.length) {
      return res.status(503).json({
        error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not configured',
      });
    }

    const chunks = await Promise.all(tasks);
    const merged = Object.assign({}, ...chunks);
    if (!merged.searchConsole && !merged.ga4) {
      return res.status(502).json({ error: 'No SEO metrics fetched' });
    }

    const payload = {
      period,
      source: 'garageguysoc.com',
      syncedAt: new Date().toISOString(),
      ...merged,
    };

    const council = await sendAiCouncilSeoMetrics(payload);

    return res.status(200).json({
      ok: true,
      period,
      council,
      hasSearchConsole: Boolean(merged.searchConsole),
      hasGa4: Boolean(merged.ga4),
    });
  } catch (err) {
    console.error('[seo-sync]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'SEO sync failed',
    });
  }
};
