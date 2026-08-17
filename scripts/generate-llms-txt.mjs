import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { problemPages } from './seo-problem-pages.mjs';
import {
  BUSINESS_HOURS_DISPLAY,
  BUSINESS_LOCATION_DISPLAY,
  BUSINESS_NAME,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_RATING,
  FOOTER_DISCLAIMER,
  SITE_ORIGIN,
} from './seo-business.mjs';
import { writeStaticFile } from './write-static-html.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function publicIndex(relDir) {
  return existsSync(path.join(root, 'public', relDir, 'index.html'))
    || existsSync(path.join(root, relDir, 'index.html'));
}

function mdLink(label, relDir) {
  return `- [${label}](${SITE_ORIGIN}/${relDir}/)`;
}

export function buildLlmsTxt() {
  const serviceCandidates = [
    ['Garage Door Repair', 'garage-door-repair'],
    ['Garage Door Spring Repair', 'garage-door-spring-repair'],
    ['Emergency Garage Door Repair', 'emergency-garage-door-repair/orange-county'],
    ['Garage Door Opener Repair', 'garage-door-opener-repair'],
  ];
  const problemCandidates = problemPages.map((page) => [page.h1.replace(/\?$/, ''), page.path]);
  const guideCandidates = [
    ['How long garage door springs last', 'garage-door-spring-lifespan'],
    ['Repair vs replace a garage door', 'repair-vs-replace-garage-door'],
    ['Garage door opener troubleshooting', 'garage-door-opener-troubleshooting'],
    ['Garage door maintenance checklist', 'garage-door-maintenance-checklist'],
  ];
  const services = [...serviceCandidates, ...problemCandidates]
    .filter(([, dir]) => publicIndex(dir))
    .filter((row, index, list) => list.findIndex((other) => other[1] === row[1]) === index);
  const guides = guideCandidates.filter(([, dir]) => publicIndex(dir));

  const serviceAreaHub = publicIndex('service-areas') ? mdLink('Full city list', 'service-areas') : '';

  return `# ${BUSINESS_NAME}

> Same-day garage door repair, spring repair, opener repair, and installation in
> Orange County, CA. ${FOOTER_DISCLAIMER} Insured, jobs quoted upfront.
> Call ${BUSINESS_PHONE_DISPLAY}.

Based in ${BUSINESS_LOCATION_DISPLAY}. Service area: Irvine, Tustin, Orange, Santa Ana, Anaheim,
Costa Mesa, Newport Beach, Huntington Beach, and greater Orange County.
Hours: ${BUSINESS_HOURS_DISPLAY}.

## Services

${services.map(([label, dir]) => mdLink(label, dir)).join('\n')}

## Service areas

${serviceAreaHub}

## Guides

${guides.map(([label, dir]) => mdLink(label, dir)).join('\n')}

## Optional

- [Reviews](${SITE_ORIGIN}/#reviews): ${BUSINESS_RATING.ratingValue} average, ${BUSINESS_RATING.reviewCount}+ reviews
- [Book a callback](${SITE_ORIGIN}/): request-callback form on every page
`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const body = buildLlmsTxt();
  await writeStaticFile('llms.txt', body);
  console.log('wrote llms.txt');
}
