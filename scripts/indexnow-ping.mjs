#!/usr/bin/env node
/**
 * Ping Bing/IndexNow with every URL in sitemap.xml.
 * Runs after `next build` on Vercel production only (fail-open).
 * Local / GitHub CI skip unless INDEXNOW_FORCE=1.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDEXNOW_KEY } from './indexnow-key.mjs';
import { SITE_ORIGIN } from './seo-business.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'garageguysoc.com';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

export function indexNowKeyLocation() {
  return `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;
}

export function urlsFromSitemap(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((m) => m[1].trim());
}

function shouldPing() {
  return process.env.VERCEL_ENV === 'production' || process.env.INDEXNOW_FORCE === '1';
}

export async function pingIndexNow() {
  if (!shouldPing()) {
    console.log('IndexNow: skip (not Vercel production; set INDEXNOW_FORCE=1 to ping)');
    return { skipped: true };
  }

  const keyFile = path.join(root, 'public', `${INDEXNOW_KEY}.txt`);
  if (!existsSync(keyFile) || readFileSync(keyFile, 'utf8').trim() !== INDEXNOW_KEY) {
    throw new Error(`IndexNow key file missing or mismatched: public/${INDEXNOW_KEY}.txt`);
  }

  const sitemapPath = existsSync(path.join(root, 'public', 'sitemap.xml'))
    ? path.join(root, 'public', 'sitemap.xml')
    : path.join(root, 'sitemap.xml');
  const urls = urlsFromSitemap(readFileSync(sitemapPath, 'utf8'));
  if (!urls.length) throw new Error('IndexNow: sitemap.xml has no <loc> URLs');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: indexNowKeyLocation(),
      urlList: urls,
    }),
  });
  const text = await res.text();
  return { skipped: false, status: res.status, body: text, count: urls.length };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  pingIndexNow()
    .then((result) => {
      if (result.skipped) return;
      console.log(`IndexNow: ${result.count} URLs → HTTP ${result.status}`);
      if (result.body) console.log(result.body);
    })
    .catch((err) => {
      console.warn('IndexNow ping failed (non-blocking):', err instanceof Error ? err.message : err);
      process.exit(0);
    });
}
