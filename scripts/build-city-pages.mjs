import { getCityContent, OC_CITY_SLUGS } from './oc-city-content.mjs';
import { seoMetaDescription } from './seo-meta.mjs';

function repairPage(city) {
  const { slug, name } = city;
  const r = city.repair;
  return {
    path: `garage-door-repair/${slug}`,
    h1: `Garage Door Repair in ${name}, CA`,
    title: `Garage Door Repair ${name} CA | Same-Day Service | Garage Guys`,
    ogTitle: `Garage Door Repair ${name} CA | Garage Guys`,
    description: seoMetaDescription(r.lead, {
      fallback: `Same-day garage door repair in ${name}, CA — springs, cables, panels, and openers.`,
    }),
    schemaDescription: `Garage door repair service in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead: r.lead,
    sectionTitle: r.sectionTitle,
    paragraphs: r.paragraphs,
    features: r.features,
    ctaTitle: `${name} Repair Today?`,
    ctaText: `Call now for same-day garage door repair in ${name}.`,
    areaServed: { type: 'City', name },
  };
}

function springPage(city) {
  const { slug, name } = city;
  const s = city.spring;
  return {
    path: `garage-door-spring-repair/${slug}`,
    h1: `Garage Door Spring Repair in ${name}, CA`,
    title: `Garage Door Spring Repair ${name} CA | Same-Day | Garage Guys`,
    ogTitle: `Garage Door Spring Repair ${name} CA | Garage Guys`,
    description: seoMetaDescription(s.lead, {
      fallback: `Broken garage door spring in ${name}, CA? Same-day torsion and extension replacement.`,
    }),
    schemaDescription: `Garage door spring repair in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead: s.lead,
    sectionTitle: s.sectionTitle,
    paragraphs: s.paragraphs,
    features: s.features,
    ctaTitle: `Broken Spring in ${name}?`,
    ctaText: `Same-day spring replacement in ${name} — call now.`,
    areaServed: { type: 'City', name },
  };
}

function openerPage(city) {
  const { slug, name } = city;
  const o = city.opener;
  return {
    path: `garage-door-opener-repair/${slug}`,
    h1: `Garage Door Opener Repair in ${name}, CA`,
    title: `Garage Door Opener Repair ${name} CA | Same-Day | Garage Guys`,
    ogTitle: `Garage Door Opener Repair ${name} CA | Garage Guys`,
    description: seoMetaDescription(o.lead, {
      fallback: `Garage door opener repair in ${name}, CA — sensors, motors, remotes, and smart openers.`,
    }),
    schemaDescription: `Garage door opener repair in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead: o.lead,
    sectionTitle: o.sectionTitle,
    paragraphs: o.paragraphs,
    features: o.features,
    ctaTitle: `${name} Opener Repair`,
    ctaText: `Call for opener repair in ${name} today.`,
    areaServed: { type: 'City', name },
  };
}

function cablePage(city) {
  const { slug, name } = city;
  const cableLead = city.cable.paragraphs?.[0] ?? `Frayed or snapped lift cables in ${name}?`;
  return {
    path: `garage-door-cable-repair/${slug}`,
    h1: `Garage Door Cable Repair in ${name}, CA`,
    title: `Garage Door Cable Repair ${name} CA | Same-Day | Garage Guys`,
    ogTitle: `Garage Door Cable Repair ${name} CA | Garage Guys`,
    description: seoMetaDescription(cableLead, {
      fallback: `Garage door cable repair in ${name}, CA — frayed cables, drum issues, and uneven lift.`,
    }),
    schemaDescription: `Garage door cable repair in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead: `Cable or drum issue in ${name}? We replace lift cables safely and rebalance the door.`,
    sectionTitle: `Garage Door Cable Repair in ${name}`,
    paragraphs: city.cable.paragraphs,
    features: city.cable.features ?? [
      'Frayed cable replacement',
      'Drum and bearing inspection',
      'Bottom bracket service',
      'Post-repair balance test',
      'Same-day scheduling',
    ],
    ctaTitle: `${name} Cable Repair`,
    ctaText: `Call now for cable repair in ${name}.`,
    areaServed: { type: 'City', name },
  };
}

function offTrackPage(city) {
  const { slug, name } = city;
  const offLead = city.offTrack.paragraphs?.[0] ?? `Garage door off track in ${name}?`;
  return {
    path: `garage-door-off-track/${slug}`,
    h1: `Garage Door Off Track Repair in ${name}, CA`,
    title: `Garage Door Off Track Repair ${name} CA | Same-Day | Garage Guys`,
    ogTitle: `Garage Door Off Track Repair ${name} CA | Garage Guys`,
    description: seoMetaDescription(offLead, {
      fallback: `Garage door off track in ${name}, CA? Safe realignment and roller repair.`,
    }),
    schemaDescription: `Garage door off track repair in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead: `Door jumped the track in ${name}? Stop using the opener — we realign tracks and replace damaged rollers.`,
    sectionTitle: `Garage Door Off Track Repair in ${name}`,
    paragraphs: city.offTrack.paragraphs,
    features: city.offTrack.features ?? [
      'Safe derailment recovery',
      'Track straightening and replacement',
      'Roller and bracket upgrades',
      'Cable tension balancing',
      'Same-day appointments',
    ],
    ctaTitle: `${name} Off Track Repair`,
    ctaText: `Call now for off-track repair in ${name}.`,
    areaServed: { type: 'City', name },
  };
}

export function buildCitySeoPages(slug) {
  const city = getCityContent(slug);
  if (!city) return [];
  return [repairPage(city), springPage(city), openerPage(city), cablePage(city), offTrackPage(city)];
}

export function buildAllOcCityPages() {
  return [...OC_CITY_SLUGS].flatMap((slug) => buildCitySeoPages(slug));
}

export { OC_CITY_SLUGS };
