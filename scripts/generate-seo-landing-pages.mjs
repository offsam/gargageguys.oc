import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const today = '2026-07-11';

const sharedTail = `  <div class="fab-bar" id="fab-bar">
  <a href="tel:+19495390009" class="fab-call" aria-label="Call (949) 539-0009">
    <span>(949) 539-0009</span>
  </a>
  <button type="button" class="fab-callback" data-open-callback aria-label="Request a callback">
    <span class="fab-callback-label">Free estimate</span>
    <span class="fab-callback-title">Request Callback</span>
  </button>
</div>

<div class="callback-modal" id="callback-modal" aria-hidden="true">
  <div class="callback-backdrop" data-close-callback></div>
  <div class="callback-dialog" role="dialog" aria-labelledby="callback-title" aria-modal="true">
    <button type="button" class="callback-close" data-close-callback aria-label="Close">&times;</button>
    <div id="callback-form-wrap">
      <h3 id="callback-title">We'll Call You Back</h3>
      <p>Leave your name, number and ZIP — Sam usually responds within the hour.</p>
      <form class="callback-form" id="callback-form">
        <label>Your Name
          <input type="text" name="name" required autocomplete="name" placeholder="John Smith">
        </label>
        <label>Your Phone
          <input type="tel" name="phone" required autocomplete="tel" placeholder="(949) 555-0000">
        </label>
        <label>ZIP Code
          <input type="text" name="zip" required autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" maxlength="10" placeholder="92660">
        </label>
        <label>What do you need? <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span>
          <textarea name="message" placeholder="Garage door won't close, need repair..."></textarea>
        </label>
        <label class="callback-honeypot" aria-hidden="true">
          Leave blank
          <input type="text" name="_gotcha" tabindex="-1" autocomplete="off">
        </label>
        <p class="callback-error" id="callback-error" hidden></p>
        <button type="submit" class="callback-submit">Send My Request</button>
      </form>
    </div>
    <div class="callback-success" id="callback-success" hidden>
      <div class="callback-success-icon">✓</div>
      <h4>You're on the list!</h4>
      <p>We'll call you back at<br><span class="callback-success-phone"></span><br>Usually within the hour — 7 days a week.</p>
      <button type="button" class="callback-done" data-close-callback>Got it</button>
    </div>
  </div>
</div>

<footer>
  <a href="/" class="footer-logo">
    <img src="/Pictures/Logo.png" alt="Garage Guys">
  </a>
  <div class="footer-copy">© 2026 Garage Guys · <a href="/">Orange County &amp; Inland Empire, CA</a></div>
  <p class="footer-disclaimer">Not a licensed contractor. All work performed under $1,000 per project.</p>
</footer>

<script src="/js/callback-form.js"></script>
<link rel="stylesheet" href="/css/ai-chat.css">
<script src="/js/ai-chat.js" defer></script>
</body>
</html>`;

function schemaJson(page) {
  const areaServed = page.areaServed.type === 'City'
    ? {
        '@type': 'City',
        name: page.areaServed.name,
        containedInPlace: { '@type': 'State', name: 'California' },
      }
    : {
        '@type': 'AdministrativeArea',
        name: page.areaServed.name,
      };

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': 'https://garageguysoc.com/#business',
      name: 'Garage Guys',
      description: page.schemaDescription,
      telephone: '+19495390009',
      url: 'https://garageguysoc.com/',
      image: 'https://garageguysoc.com/favicon-192x192.png',
      priceRange: '$$',
      areaServed,
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '07:00',
        closes: '20:00',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '5.0',
        reviewCount: '67',
        bestRating: '5',
      },
      sameAs: [
        'https://www.thumbtack.com/ca/tustin/garage-door-repair/garage-guys/service/533172338874097690',
      ],
    },
    null,
    2,
  );
}

function localTrustParagraph(page) {
  if (page.areaServed.type !== 'City') return '';
  const city = page.areaServed.name;
  const service = page.path.includes('spring-repair')
    ? 'spring replacement'
    : page.path.includes('opener-repair')
      ? 'opener diagnostics and repair'
      : 'garage door repair';
  return `    <p>Garage Guys handles ${service} across ${city} with upfront quotes and same-day routing when slots are open. Our technician explains findings in plain language — no pressure to replace parts that still have safe life left. The service van carries common hardware so most ${city} appointments wrap in a single trip. We test door balance, safety sensors, and manual release whenever those items are in scope. Labor warranty up to one year on qualifying work.</p>\n`;
}

function renderPage(page) {
  const canonical = `https://garageguysoc.com/${page.path}/`;
  const paragraphs = page.paragraphs.map((p) => `    <p>${p}</p>`).join('\n');
  const trust = localTrustParagraph(page);
  const features = page.features
    ? `    <ul class="service-features">\n${page.features.map((f) => `      <li>${f}</li>`).join('\n')}\n    </ul>\n`
    : '';
  const related = page.related
    ? `    <div class="service-related">
      <h3>Related Pages</h3>
      <div class="service-related__links">
${page.related.map((r) => `        <a href="${r.href}">${r.label}</a>`).join('\n')}
      </div>
    </div>`
    : '';

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
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${page.ogTitle}">
<meta property="og:description" content="${page.description}">
<meta property="og:image" content="https://garageguysoc.com/favicon-192x192.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${page.ogTitle}">
<meta name="twitter:description" content="${page.description}">
<script type="application/ld+json">
${schemaJson(page)}
</script>
<meta name="theme-color" content="#0f2340">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/service-page.css">
<script src="/api/analytics.js" defer></script>
</head>
<body>

<div class="site-van-bg" aria-hidden="true"></div>

<nav class="nav-seo">
  <a href="/" class="nav-logo">
    <img src="/Pictures/Logo.png" alt="Garage Guys — home">
  </a>
</nav>

<header class="service-hero">
  <div class="service-hero__inner">
    <div class="service-hero__eyebrow">${page.eyebrow}</div>
    <h1 class="service-hero__title">${page.h1}</h1>
    <p class="service-hero__lead">${page.lead}</p>
    <div class="service-hero__actions">
      <a href="tel:+19495390009" class="btn-call-now">Call Now</a>
      <a href="tel:+19495390009" class="service-hero__phone">(949) 539-0009</a>
      <button type="button" class="btn-callback-inline" data-open-callback>
        Request Callback
        <span>Free Estimate</span>
      </button>
    </div>
  </div>
</header>

<main class="service-main">
  <div class="service-main__inner">
    <h2>${page.sectionTitle}</h2>
${paragraphs}
${trust}${features}${related}
    <p class="service-home-link"><a href="/">← Back to Garage Guys home</a></p>
  </div>
</main>

<section class="service-cta">
  <h2>${page.ctaTitle}</h2>
  <p>${page.ctaText}</p>
  <a href="tel:+19495390009" class="btn-call-now btn-call-now--cta">Call Now</a>
  <a href="tel:+19495390009" class="service-cta__phone">(949) 539-0009</a>
</section>

${sharedTail}`;
}

const pages = [
  {
    path: 'garage-door-repair/orange-county',
    h1: 'Garage Door Repair in Orange County, CA',
    title: 'Garage Door Repair Orange County CA | Same-Day Service | Garage Guys',
    ogTitle: 'Garage Door Repair Orange County CA | Garage Guys',
    description:
      'Same-day garage door repair across Orange County — panels, cables, rollers, off-track doors &amp; more. Free estimate. Call (949) 539-0009.',
    schemaDescription:
      'Same-day garage door repair service across Orange County, California including panels, cables, rollers, and emergency repairs.',
    eyebrow: 'Orange County, California',
    lead:
      'Stuck door, broken cable, or loud grinding noise? Garage Guys dispatches a local technician across Orange County — usually the same day you call.',
    sectionTitle: 'County-Wide Garage Door Repair',
    paragraphs: [
      'Orange County homeowners deal with everything from aging builder-grade hardware to salt air corrosion near the coast. Garage Guys handles full-system diagnostics and repair in one visit: we inspect springs, cables, rollers, tracks, panels, and opener connections before quoting any work.',
      'Our cargo van is stocked with common replacement parts for major door brands, so most repairs finish without a second trip. Whether you are in a planned community in Irvine, a coastal home in Newport Beach, or an older tract in Santa Ana, we show up on time with clear pricing upfront.',
      'Every job includes a balance check and safety test before we leave. Labor is warrantied up to one year, and manufacturer parts carry their own coverage where applicable. For emergency situations — a door off the track or stuck open — call <a href="tel:+19495390009">(949) 539-0009</a> seven days a week.',
      'Garage Guys also serves the Inland Empire when schedules allow. If you need spring-only or opener-only service, see our dedicated <a href="/garage-door-spring-repair/orange-county/">spring repair</a> and <a href="/garage-door-opener-repair/orange-county/">opener repair</a> pages across Orange County.',
    ],
    features: [
      'Off-track and misaligned door correction',
      'Broken lift cables and worn rollers',
      'Panel dents, cracks, and section replacement',
      'Weather seal and bottom rubber',
      'Emergency same-day appointments',
    ],
    related: [
      { href: '/garage-door-repair/irvine-ca/', label: 'Garage Door Repair Irvine' },
      { href: '/garage-door-repair/newport-beach-ca/', label: 'Garage Door Repair Newport Beach' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Need Repair in Orange County?',
    ctaText: 'Call now for a free estimate — same-day service available across OC.',
    areaServed: { type: 'AdministrativeArea', name: 'Orange County, California' },
  },
  {
    path: 'garage-door-spring-repair/orange-county',
    h1: 'Garage Door Spring Repair in Orange County, CA',
    title: 'Garage Door Spring Repair Orange County CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Orange County | Garage Guys',
    description:
      'Broken garage door spring in Orange County? Same-day torsion &amp; extension spring replacement. Free estimate — call (949) 539-0009.',
    schemaDescription:
      'Professional garage door spring repair and replacement across Orange County, California including torsion and extension springs.',
    eyebrow: 'Orange County, California',
    lead:
      'A loud bang from the garage often means a broken spring. We replace torsion and extension springs safely — same day across Orange County.',
    sectionTitle: 'Spring Replacement Across Orange County',
    paragraphs: [
      'Garage door springs carry hundreds of pounds of tension. DIY spring work is dangerous; Garage Guys uses the right winding bars, sizing charts, and safety procedures on every job. We measure your door weight and height, then install matched springs rated for the correct cycle life.',
      'Typical signs you need a spring repair: the door feels extremely heavy when lifting manually, the opener strains or stalls, you see a visible gap in a torsion spring, or the door only opens a few inches. We fix the spring and verify cable tension, drum alignment, and opener force settings in the same appointment.',
      'Most spring replacements in Orange County take under two hours. We lubricate moving parts, check balance, and test auto-reverse safety after installation. You get a clear quote before work starts — no surprise fees when we arrive.',
      'Serving Irvine, Tustin, Costa Mesa, Mission Viejo, Newport Beach, and surrounding OC cities. For general door issues beyond springs, visit our <a href="/garage-door-repair/orange-county/">garage door repair Orange County</a> page or call <a href="tel:+19495390009">(949) 539-0009</a>.',
    ],
    features: [
      'Torsion and extension spring replacement',
      'Correct sizing for door weight and height',
      'Cable and drum inspection included',
      'Opener force recalibration after install',
      'Same-day scheduling, 7 days a week',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Garage Door Repair Orange County' },
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Broken Spring in OC?',
    ctaText: 'Do not force the door — call for same-day spring repair.',
    areaServed: { type: 'AdministrativeArea', name: 'Orange County, California' },
  },
  {
    path: 'garage-door-opener-repair/orange-county',
    h1: 'Garage Door Opener Repair in Orange County, CA',
    title: 'Garage Door Opener Repair Orange County CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Orange County | Garage Guys',
    description:
      'Garage door opener not working in Orange County? Motor, sensor, remote &amp; Wi-Fi opener repair. Call (949) 539-0009 for same-day service.',
    schemaDescription:
      'Garage door opener repair, installation, and troubleshooting across Orange County, California.',
    eyebrow: 'Orange County, California',
    lead:
      'Opener humming but door not moving? Remote dead? We troubleshoot chain, belt, and smart openers across Orange County — often fixed same day.',
    sectionTitle: 'Opener Diagnostics &amp; Repair in OC',
    paragraphs: [
      'Modern garage openers combine a motor unit, travel limits, safety sensors, and sometimes Wi-Fi or battery backup. Garage Guys tests each layer: wall button, remotes, photo-eyes, gear assembly, carriage, and rail alignment. Many opener problems are sensor misalignment or worn gears — not a full replacement.',
      'When a new opener makes sense, we install belt, chain, or wall-mount jackshaft units and pair them with your existing door after a balance check. Smart openers from major brands can be linked to phone apps; we walk you through setup before leaving.',
      'Orange County homes range from older chain-drive units in established neighborhoods to new belt-drive systems in master-planned communities. We carry common gear kits and safety sensors on the truck to avoid return visits.',
      'Opener issues often appear alongside worn springs. If the door feels heavy, we inspect springs too — running an opener on a poorly balanced door burns out motors fast. See also <a href="/garage-door-repair/orange-county/">garage door repair</a> and <a href="/garage-door-spring-repair/orange-county/">spring repair</a> in Orange County, or call <a href="tel:+19495390009">(949) 539-0009</a>.',
    ],
    features: [
      'Photo-eye alignment and wiring checks',
      'Gear and sprocket replacement',
      'Remote, keypad, and wall control programming',
      'Travel limit and force adjustment',
      'Smart Wi-Fi opener setup',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Garage Door Repair Orange County' },
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Opener Not Working?',
    ctaText: 'Same-day opener repair across Orange County — free estimate by phone.',
    areaServed: { type: 'AdministrativeArea', name: 'Orange County, California' },
  },
  {
    path: 'garage-door-repair/irvine-ca',
    h1: 'Garage Door Repair in Irvine, CA',
    title: 'Garage Door Repair Irvine CA | Same-Day Service | Garage Guys',
    ogTitle: 'Garage Door Repair Irvine CA | Garage Guys',
    description:
      'Same-day garage door repair in Irvine, CA — springs, cables, panels, openers &amp; off-track doors. Free estimate. Call (949) 539-0009.',
    schemaDescription:
      'Same-day garage door repair service in Irvine, California.',
    eyebrow: 'Irvine, California',
    lead:
      'Garage door stuck in Irvine? Local technician, stocked van, and upfront pricing — most Irvine repairs completed in one visit.',
    sectionTitle: 'Local Repair Service in Irvine',
    paragraphs: [
      'Irvine\'s mix of townhomes, single-family homes, and HOA communities means garage doors see heavy daily use. Garage Guys responds to Irvine calls from Woodbridge to Portola Springs with same-day availability when slots are open. We handle off-track doors, snapped cables, cracked panels, and opener failures.',
      'Before any repair, we inspect the full system — springs, drums, cables, rollers, hinges, tracks, and opener force settings. Irvine coastal influence is less than beach cities, but dust and temperature swings still wear rollers and weather seals over time.',
      'Our technician quotes the repair on-site before turning a wrench. Common parts ride in the cargo van, so you are not waiting days for a follow-up. Every completed repair includes a balance test and safety reversal check.',
      'Garage Guys is based nearby and knows Irvine access rules for many communities. For county-wide coverage details, see <a href="/garage-door-repair/orange-county/">garage door repair Orange County</a>. Questions? Call <a href="tel:+19495390009">(949) 539-0009</a> or return to the <a href="/">Garage Guys homepage</a>.',
    ],
    features: [
      'HOA-friendly scheduling and communication',
      'Off-track and cable emergencies',
      'Roller, hinge, and bracket replacement',
      'Panel and weather seal repair',
      'Same-day Irvine appointments',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      { href: '/garage-door-repair/tustin-ca/', label: 'Garage Door Repair Tustin' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Irvine Repair Today?',
    ctaText: 'Call now — free estimate for Irvine garage door repair.',
    areaServed: { type: 'City', name: 'Irvine' },
  },
  {
    path: 'garage-door-repair/newport-beach-ca',
    h1: 'Garage Door Repair in Newport Beach, CA',
    title: 'Garage Door Repair Newport Beach CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Repair Newport Beach CA | Garage Guys',
    description:
      'Garage door repair in Newport Beach, CA — corrosion, springs, openers &amp; custom doors. Same-day service. Call (949) 539-0009.',
    schemaDescription:
      'Garage door repair and maintenance in Newport Beach, California.',
    eyebrow: 'Newport Beach, California',
    lead:
      'Coastal air, custom wood doors, and high-cycle openers — we repair garage doors across Newport Beach with same-day availability.',
    sectionTitle: 'Newport Beach Garage Door Service',
    paragraphs: [
      'Newport Beach properties often feature premium garage doors — wood overlays, frosted glass sections, and heavy custom slabs that demand careful balancing. Salt air accelerates corrosion on bottom fixtures, hinges, and steel cables. Garage Guys diagnoses whether you need hardware replacement, panel repair, or full spring recalibration.',
      'We regularly service homes from Corona del Mar to Newport Coast. Our approach: protect your driveway and interior, document existing damage, then quote repairs before starting. For cosmetic panel work, we explain realistic outcomes — some dents can be eased, others need section replacement.',
      'Opener strain is common when springs weaken on heavier coastal doors. We test spring tension first; fixing the root cause prevents repeated motor failures. Lubrication with appropriate products helps slow corrosion on exposed metal components.',
      'Many Newport Beach garages face afternoon sun on sensor lenses — we adjust mounting angle and recommend sun shields when glare causes false reversals near the floor.',
      'Need help beyond Newport Beach? Browse <a href="/garage-door-repair/orange-county/">Orange County garage door repair</a> or neighboring <a href="/garage-door-repair/costa-mesa-ca/">Costa Mesa</a>. Call <a href="tel:+19495390009">(949) 539-0009</a> or visit the <a href="/">Garage Guys home page</a>.',
    ],
    features: [
      'Corrosion-prone hardware inspection',
      'Custom and wood door adjustments',
      'High-cycle spring upgrades',
      'Opener and safety sensor repair',
      'Careful on-site estimates',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      { href: '/garage-door-repair/costa-mesa-ca/', label: 'Garage Door Repair Costa Mesa' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Newport Beach Call-Out',
    ctaText: 'Same-day garage door repair — call for a free estimate.',
    areaServed: { type: 'City', name: 'Newport Beach' },
  },
  {
    path: 'garage-door-repair/tustin-ca',
    h1: 'Garage Door Repair in Tustin, CA',
    title: 'Garage Door Repair Tustin CA | Same-Day Service | Garage Guys',
    ogTitle: 'Garage Door Repair Tustin CA | Garage Guys',
    description:
      'Garage door repair in Tustin, CA — local same-day service for springs, cables, rollers &amp; openers. Call (949) 539-0009.',
    schemaDescription:
      'Local garage door repair service in Tustin, California.',
    eyebrow: 'Tustin, California',
    lead:
      'Based near Tustin — fast response for stuck doors, broken springs, and noisy openers throughout the city.',
    sectionTitle: 'Tustin Garage Door Repair',
    paragraphs: [
      'Tustin sits at the heart of our service area. Garage Guys handles everything from quick roller swaps in older Old Town garages to full spring replacements in newer developments near The District. Because we are local, Tustin calls often get the fastest same-day windows.',
      'Common Tustin service calls include doors that reversed mid-cycle, frayed cables, worn rollers creating grinding sounds, and openers that lost travel limits after a power outage. We carry parts for standard residential door sizes found across Tustin tract homes and townhomes.',
      'Every visit follows the same process: inspect, explain, quote, then repair. You will know the total before we proceed. Labor warranty up to one year; parts covered per manufacturer where applicable.',
      'Tustin\'s blend of vintage garages downtown and newer two-story homes means we see both extension-spring aging and modern torsion systems — we stock parts for either configuration.',
      'Explore our broader <a href="/garage-door-repair/orange-county/">Orange County repair coverage</a> or nearby <a href="/garage-door-repair/irvine-ca/">Irvine</a> page. Reach us at <a href="tel:+19495390009">(949) 539-0009</a> or the <a href="/">main Garage Guys site</a>.',
    ],
    features: [
      'Fast Tustin response times',
      'Spring and cable replacement',
      'Roller and hinge upgrades',
      'Opener troubleshooting',
      'Free estimates before work',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      { href: '/garage-door-repair/irvine-ca/', label: 'Garage Door Repair Irvine' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Tustin Same-Day Repair',
    ctaText: 'Local garage door repair in Tustin — call now.',
    areaServed: { type: 'City', name: 'Tustin' },
  },
  {
    path: 'garage-door-repair/costa-mesa-ca',
    h1: 'Garage Door Repair in Costa Mesa, CA',
    title: 'Garage Door Repair Costa Mesa CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Repair Costa Mesa CA | Garage Guys',
    description:
      'Garage door repair in Costa Mesa, CA — panels, springs, openers &amp; off-track doors. Same-day appointments. (949) 539-0009.',
    schemaDescription:
      'Garage door repair service in Costa Mesa, California.',
    eyebrow: 'Costa Mesa, California',
    lead:
      'Central Orange County location means quick Costa Mesa dispatch — repairs for homes, condos, and small commercial bays.',
    sectionTitle: 'Costa Mesa Door Repair',
    paragraphs: [
      'Costa Mesa combines established neighborhoods, condo communities, and light commercial spaces — each with different garage door setups. Garage Guys services residential sectional doors, older one-piece tilt doors, and small shop roll-up doors when capacity allows.',
      'Frequent issues in Costa Mesa include doors knocked off track after accidental bumps, worn rollers on high-cycle daily commutes, and opener remotes that need reprogramming after battery failure. We test safety sensors on every opener call; misaligned photo-eyes are a common root cause of random reversals.',
      'Our technician arrives with ladders, winding bars, and standard hardware kits. You receive a written verbal quote before authorization. Most jobs wrap within a single visit.',
      'Costa Mesa homeowners near the 55 freeway and South Coast Plaza corridor often book morning or afternoon windows — we confirm ETA by text when you request a callback online.',
      'Also serving Newport Beach, Tustin, and Mission Viejo. County overview: <a href="/garage-door-repair/orange-county/">garage door repair Orange County</a>. Call <a href="tel:+19495390009">(949) 539-0009</a> or go to <a href="/">garageguysoc.com</a>.',
    ],
    features: [
      'Residential and light commercial',
      'Off-track realignment',
      'Sensor and opener diagnostics',
      'Spring and roller replacement',
      'Same-day Costa Mesa slots',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      { href: '/garage-door-repair/newport-beach-ca/', label: 'Garage Door Repair Newport Beach' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Costa Mesa Repair',
    ctaText: 'Free estimate — garage door repair in Costa Mesa today.',
    areaServed: { type: 'City', name: 'Costa Mesa' },
  },
  {
    path: 'garage-door-repair/mission-viejo-ca',
    h1: 'Garage Door Repair in Mission Viejo, CA',
    title: 'Garage Door Repair Mission Viejo CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Repair Mission Viejo CA | Garage Guys',
    description:
      'Garage door repair in Mission Viejo, CA — springs, cables, openers &amp; panel damage. Same-day service. (949) 539-0009.',
    schemaDescription:
      'Garage door repair and maintenance in Mission Viejo, California.',
    eyebrow: 'Mission Viejo, California',
    lead:
      'Lake-area homes and hillside communities — we repair garage doors across Mission Viejo with clear pricing and same-day options.',
    sectionTitle: 'Mission Viejo Service Area',
    paragraphs: [
      'Mission Viejo\'s planned communities often use standardized door sizes, which helps us stock the right springs and rollers on the first trip. Garage Guys addresses noisy operation, slow opening, broken springs, and doors that leave a gap at the floor — common when weather seals compress or tracks shift.',
      'Hillside lots can mean heavier doors and more strain on opener rails. We verify spring balance so motors are not doing extra work. For families using the garage as the main entry, we prioritize fast turnaround and safe auto-reverse function.',
      'From Casta del Sol to Pacific Hills, we treat every home with the same process: thorough inspection, upfront quote, professional repair, and a final walkthrough with you. Emergency off-track service is available seven days a week.',
      'Mission Viejo HOAs often require quiet hours for noisy repairs — we schedule accordingly and use impact-minimizing techniques when adjusting tracks or replacing rollers on attached garages.',
      'See all of <a href="/garage-door-repair/orange-county/">Orange County</a> or nearby <a href="/garage-door-repair/irvine-ca/">Irvine</a>. Call <a href="tel:+19495390009">(949) 539-0009</a> or return to <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Standard and oversized door repair',
      'Spring tuning for heavy doors',
      'Weather seal replacement',
      'Opener rail and carriage service',
      '7-day emergency availability',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      { href: '/garage-door-repair/irvine-ca/', label: 'Garage Door Repair Irvine' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Mission Viejo Repair',
    ctaText: 'Call now for Mission Viejo garage door repair.',
    areaServed: { type: 'City', name: 'Mission Viejo' },
  },
  // ── Spring repair by city ──
  {
    path: 'garage-door-spring-repair/irvine-ca',
    h1: 'Garage Door Spring Repair in Irvine, CA',
    title: 'Garage Door Spring Repair Irvine CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Irvine CA | Garage Guys',
    description:
      'Broken garage door spring in Irvine, CA? Same-day torsion &amp; extension spring replacement. Call (949) 539-0009 for a free estimate.',
    schemaDescription: 'Garage door spring repair and replacement in Irvine, California.',
    eyebrow: 'Irvine, California',
    lead:
      'Heard a loud snap from the garage in Irvine? We replace broken torsion and extension springs safely — usually the same day.',
    sectionTitle: 'Irvine Spring Replacement',
    paragraphs: [
      'A broken garage door spring in Irvine leaves the door too heavy for the opener — or impossible to lift by hand. Garage Guys measures door weight and height, then installs correctly rated springs with professional winding tools. Never attempt spring repair yourself; stored tension can cause serious injury.',
      'Irvine homes from Northwood to Woodbury use a mix of standard 16-foot doors and oversized three-car openings. We stock common spring sizes for residential doors and verify drum, cable, and bearing condition while the door is down.',
      'After installation we balance the door, lubricate moving hardware, and recalibrate opener force limits. Most Irvine spring jobs finish in under two hours. You approve the quote before we start — no hidden trip fees.',
      'Woodbridge and University Park townhomes sometimes have shorter ceiling clearance — we confirm headroom before ordering non-standard spring lengths.',
      'County-wide spring service: <a href="/garage-door-spring-repair/orange-county/">Orange County spring repair</a>. General door issues: <a href="/garage-door-repair/irvine-ca/">garage door repair Irvine</a>. Call <a href="tel:+19495390009">(949) 539-0009</a> or <a href="/">Garage Guys home</a>.',
    ],
    features: [
      'Torsion and extension spring replacement',
      'Door balance and safety test',
      'Opener force recalibration',
      'Cable and drum inspection',
      'Same-day Irvine scheduling',
    ],
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/garage-door-repair/irvine-ca/', label: 'Garage Door Repair Irvine' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Broken Spring in Irvine?',
    ctaText: 'Do not force the door — call for same-day spring repair.',
    areaServed: { type: 'City', name: 'Irvine' },
  },
  {
    path: 'garage-door-spring-repair/newport-beach-ca',
    h1: 'Garage Door Spring Repair in Newport Beach, CA',
    title: 'Garage Door Spring Repair Newport Beach CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Newport Beach | Garage Guys',
    description:
      'Garage door spring repair in Newport Beach, CA — heavy coastal doors, corrosion-aware service. Same-day replacement. (949) 539-0009.',
    schemaDescription: 'Garage door spring repair in Newport Beach, California.',
    eyebrow: 'Newport Beach, California',
    lead:
      'Coastal humidity and heavier custom doors stress springs faster in Newport Beach — we replace and balance them same day.',
    sectionTitle: 'Newport Beach Spring Service',
    paragraphs: [
      'Newport Beach garage doors are often heavier than standard builder grade — wood overlays, insulation, and wide double openings increase spring load. When a torsion spring breaks, you may notice a gap in the coil or the door rising only a foot before stopping.',
      'Salt air corrodes spring mounts and end bearings over time. Garage Guys inspects the full torsion system: springs, center bearing, cables, drums, and bottom brackets. We recommend high-cycle springs when doors see multiple daily cycles.',
      'Our technician winds new springs to precise tension, then confirms smooth manual lift at midpoint. Opener strain drops immediately when balance is correct — protecting your motor from premature failure.',
      'Balboa Peninsula and Lido Isle garages may have tighter clearances — we use low-headroom kits when standard drums will not fit.',
      'Also see <a href="/garage-door-repair/newport-beach-ca/">garage door repair Newport Beach</a> and <a href="/garage-door-spring-repair/orange-county/">OC spring repair</a>. Call <a href="tel:+19495390009">(949) 539-0009</a> or visit <a href="/">garageguysoc.com</a>.',
    ],
    features: [
      'High-cycle spring upgrades',
      'Corrosion inspection on hardware',
      'Heavy door balancing',
      'Bearing and drum checks',
      'Coastal home experience',
    ],
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/garage-door-repair/newport-beach-ca/', label: 'Garage Door Repair Newport Beach' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Newport Beach Spring Repair',
    ctaText: 'Same-day spring replacement — free estimate by phone.',
    areaServed: { type: 'City', name: 'Newport Beach' },
  },
  {
    path: 'garage-door-spring-repair/tustin-ca',
    h1: 'Garage Door Spring Repair in Tustin, CA',
    title: 'Garage Door Spring Repair Tustin CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Tustin CA | Garage Guys',
    description:
      'Garage door spring broken in Tustin, CA? Fast local spring replacement — torsion &amp; extension. Call (949) 539-0009.',
    schemaDescription: 'Garage door spring repair service in Tustin, California.',
    eyebrow: 'Tustin, California',
    lead:
      'Local to Tustin — we respond quickly when a spring breaks and get your door balanced again the same day.',
    sectionTitle: 'Tustin Spring Replacement',
    paragraphs: [
      'Tustin homeowners call us when the opener hums but the door barely moves — a classic sign of a fatigued or broken spring. Garage Guys is based nearby, so Tustin spring emergencies often receive the fastest appointment windows in our schedule.',
      'We replace single and double torsion springs, extension spring pairs on older doors, and worn cables that frequently fail at the same time. Every job includes a balance test: a properly balanced door should stay at mid-travel when released.',
      'Older Tustin garages near Old Town sometimes have shorter headroom or non-standard tracks. We bring winding bars sized for tight spaces and explain whether your hardware is due for an upgrade beyond the spring itself.',
      'If your door has two torsion springs and only one broke, we recommend replacing both so tension stays matched — preventing a second failure within weeks.',
      'Broader coverage: <a href="/garage-door-spring-repair/orange-county/">spring repair Orange County</a>. Full repairs: <a href="/garage-door-repair/tustin-ca/">garage door repair Tustin</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Fast Tustin dispatch',
      'Extension and torsion springs',
      'Cable replacement when needed',
      'Opener recalibration included',
      'Upfront pricing',
    ],
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/garage-door-repair/tustin-ca/', label: 'Garage Door Repair Tustin' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Tustin Spring Emergency',
    ctaText: 'Call now — broken spring repair in Tustin today.',
    areaServed: { type: 'City', name: 'Tustin' },
  },
  {
    path: 'garage-door-spring-repair/costa-mesa-ca',
    h1: 'Garage Door Spring Repair in Costa Mesa, CA',
    title: 'Garage Door Spring Repair Costa Mesa CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Costa Mesa | Garage Guys',
    description:
      'Garage door spring repair in Costa Mesa, CA — same-day torsion spring replacement for homes &amp; condos. (949) 539-0009.',
    schemaDescription: 'Garage door spring repair in Costa Mesa, California.',
    eyebrow: 'Costa Mesa, California',
    lead:
      'Central OC location means quick Costa Mesa spring repair — condos, townhomes, and single-family doors.',
    sectionTitle: 'Costa Mesa Spring Repair',
    paragraphs: [
      'Costa Mesa sees steady spring failures on high-traffic doors — daily commutes through the garage add cycles fast. When one spring breaks on a two-spring system, the remaining spring carries uneven load and should be replaced as a matched pair.',
      'Garage Guys explains whether your door needs one or two new springs, what cycle rating fits your usage, and whether cables or rollers should be addressed at the same time. Condo and townhome garages with low headroom get the same careful measurement as detached homes.',
      'We complete most spring swaps in a single visit. After winding, we test auto-reverse and manual release so you know the system is safe before we leave.',
      'Mesa Verde and Eastside Costa Mesa see high daily cycle counts — we offer higher-cycle spring options when you use the garage as your main entrance.',
      'Related: <a href="/garage-door-repair/costa-mesa-ca/">garage door repair Costa Mesa</a>, <a href="/garage-door-spring-repair/orange-county/">Orange County springs</a>. Phone <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    features: [
      'Matched two-spring replacement',
      'Condo and townhome service',
      'Cycle-rated spring options',
      'Safety reversal testing',
      'Same-day appointments',
    ],
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/garage-door-repair/costa-mesa-ca/', label: 'Garage Door Repair Costa Mesa' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Costa Mesa Spring Repair',
    ctaText: 'Broken spring? Call for same-day service in Costa Mesa.',
    areaServed: { type: 'City', name: 'Costa Mesa' },
  },
  {
    path: 'garage-door-spring-repair/mission-viejo-ca',
    h1: 'Garage Door Spring Repair in Mission Viejo, CA',
    title: 'Garage Door Spring Repair Mission Viejo CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Mission Viejo | Garage Guys',
    description:
      'Garage door spring repair in Mission Viejo, CA — hillside &amp; lake-area homes. Same-day replacement. Call (949) 539-0009.',
    schemaDescription: 'Garage door spring repair in Mission Viejo, California.',
    eyebrow: 'Mission Viejo, California',
    lead:
      'Mission Viejo hillside doors put extra load on springs — we replace, balance, and safety-test the full system.',
    sectionTitle: 'Mission Viejo Spring Service',
    paragraphs: [
      'Mission Viejo\'s sloped lots and three-car garages often mean heavier doors and steeper track angles. Springs fatigue on a predictable cycle count; if your door shudders opening or slams shut, the spring tension may be wrong even before a full break.',
      'Garage Guys measures door weight with the springs unwound, selects the correct wire size and length, and winds both sides evenly on dual-spring setups. We check that the door stays put at half-open — the standard balance test.',
      'Lake-area communities from Aegean Hills to Melinda Heights get the same transparent quoting process: diagnose, explain, price, then repair. Emergency same-day slots available seven days a week.',
      'Three-car Mission Viejo garages often use dual spring systems — we replace and wind both sides evenly so the door does not drift crooked on the way up.',
      'See <a href="/garage-door-repair/mission-viejo-ca/">garage door repair Mission Viejo</a> and <a href="/garage-door-spring-repair/orange-county/">OC spring repair</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Heavy door spring sizing',
      'Dual-spring balancing',
      'Hillside garage experience',
      'Lubrication and tune-up',
      '7-day availability',
    ],
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/garage-door-repair/mission-viejo-ca/', label: 'Garage Door Repair Mission Viejo' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Mission Viejo Spring Repair',
    ctaText: 'Call now for spring replacement in Mission Viejo.',
    areaServed: { type: 'City', name: 'Mission Viejo' },
  },
  // ── Opener repair by city ──
  {
    path: 'garage-door-opener-repair/irvine-ca',
    h1: 'Garage Door Opener Repair in Irvine, CA',
    title: 'Garage Door Opener Repair Irvine CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Irvine CA | Garage Guys',
    description:
      'Garage door opener not working in Irvine, CA? Sensor, motor, remote &amp; Wi-Fi opener repair. Call (949) 539-0009.',
    schemaDescription: 'Garage door opener repair in Irvine, California.',
    eyebrow: 'Irvine, California',
    lead:
      'Opener lights flash but door won\'t close in Irvine? We fix sensors, gears, remotes, and smart openers — often same day.',
    sectionTitle: 'Irvine Opener Diagnostics',
    paragraphs: [
      'Irvine opener calls usually fall into a few buckets: safety sensors knocked out of alignment, worn plastic gears stripping inside the motor head, wall button wiring issues, or travel limits lost after a power surge. Garage Guys tests each component in order instead of guessing.',
      'If your door is hard to lift manually, we check springs first — openers are not designed to hoist an unbalanced door. Fixing the spring often stops the opener from overheating and extends motor life.',
      'For Wi-Fi openers, we verify antenna placement, reconnect apps, and reprogram remotes and keypads. Belt-drive units in newer Irvine tracts get quieter adjustments when the rail vibrates against the ceiling.',
      'Great Park and Portola Springs residents often ask about myQ camera notifications — we confirm firmware is current and walk you through alert settings after the mechanical fix.',
      'More services: <a href="/garage-door-opener-repair/orange-county/">opener repair Orange County</a>, <a href="/garage-door-repair/irvine-ca/">garage door repair Irvine</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys home</a>.',
    ],
    features: [
      'Photo-eye realignment',
      'Gear and sprocket kits',
      'Remote and keypad programming',
      'Smart opener troubleshooting',
      'Spring balance check included',
    ],
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/garage-door-repair/irvine-ca/', label: 'Garage Door Repair Irvine' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Irvine Opener Repair',
    ctaText: 'Same-day opener repair in Irvine — call now.',
    areaServed: { type: 'City', name: 'Irvine' },
  },
  {
    path: 'garage-door-opener-repair/newport-beach-ca',
    h1: 'Garage Door Opener Repair in Newport Beach, CA',
    title: 'Garage Door Opener Repair Newport Beach CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Newport Beach | Garage Guys',
    description:
      'Garage door opener repair in Newport Beach, CA — luxury doors, smart systems &amp; coastal installs. (949) 539-0009.',
    schemaDescription: 'Garage door opener repair in Newport Beach, California.',
    eyebrow: 'Newport Beach, California',
    lead:
      'Premium doors need careful opener tuning in Newport Beach — we repair motors, rails, and smart controls without damaging finishes.',
    sectionTitle: 'Newport Beach Opener Service',
    paragraphs: [
      'Newport Beach homes often pair heavy or custom doors with belt-drive or wall-mount openers for quieter operation. When an opener struggles, the cause may be force settings set too low for door weight, corroded rail brackets near the coast, or moisture affecting safety sensor lenses.',
      'Garage Guys protects surrounding trim and flooring during service. We adjust force and travel limits to manufacturer specs, replace worn trolley assemblies, and upgrade brittle gear housings before they strip completely.',
      'Battery-backup openers and camera-equipped models need firmware-aware troubleshooting — we verify wall power, logic board indicators, and whether the unit is in vacation lock mode before recommending replacement.',
      'Harbor-side humidity can fog sensor lenses — we clean and reposition eyes, then run ten full close cycles to confirm consistent operation.',
      'Also: <a href="/garage-door-repair/newport-beach-ca/">garage door repair Newport Beach</a>, <a href="/garage-door-opener-repair/orange-county/">OC opener repair</a>. Call <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Belt and wall-mount openers',
      'Force and limit calibration',
      'Corrosion-aware sensor cleaning',
      'Battery backup diagnostics',
      'Careful interior protection',
    ],
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/garage-door-repair/newport-beach-ca/', label: 'Garage Door Repair Newport Beach' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Newport Beach Opener Fix',
    ctaText: 'Opener not working? Call for same-day repair.',
    areaServed: { type: 'City', name: 'Newport Beach' },
  },
  {
    path: 'garage-door-opener-repair/tustin-ca',
    h1: 'Garage Door Opener Repair in Tustin, CA',
    title: 'Garage Door Opener Repair Tustin CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Tustin CA | Garage Guys',
    description:
      'Garage door opener repair in Tustin, CA — chain, belt &amp; smart openers fixed same day. Call (949) 539-0009.',
    schemaDescription: 'Garage door opener repair in Tustin, California.',
    eyebrow: 'Tustin, California',
    lead:
      'Local Tustin opener repair — humming motor, dead remote, or door reversing? We diagnose and fix it fast.',
    sectionTitle: 'Tustin Opener Repair',
    paragraphs: [
      'Tustin residents often call when the opener runs but the door barely inches — stripped gears are a frequent culprit on older chain-drive units. We open the motor head, inspect nylon gears and the sprocket assembly, and replace kits on the spot when stocked.',
      'Random reversing at the floor usually traces to misaligned photo-eyes or sun glare hitting the sensors. We mount and wire them correctly, then run multiple full-cycle tests. If the door binds on the track, we fix that before cranking up opener force.',
      'Being local to Tustin means shorter wait times for opener emergencies — especially when your vehicle is stuck inside. We quote before replacing major components.',
      'Legacy chain-drive openers in pre-2000 Tustin garages often need rail bracket reinforcement — we tighten to studs, not just drywall anchors.',
      'Links: <a href="/garage-door-opener-repair/orange-county/">opener repair OC</a>, <a href="/garage-door-repair/tustin-ca/">garage door repair Tustin</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home page</a>.',
    ],
    features: [
      'Gear and sprocket replacement',
      'Sensor alignment',
      'Chain and belt tensioning',
      'Remote reprogramming',
      'Fast local response',
    ],
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/garage-door-repair/tustin-ca/', label: 'Garage Door Repair Tustin' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Tustin Opener Repair',
    ctaText: 'Call now — opener repair in Tustin today.',
    areaServed: { type: 'City', name: 'Tustin' },
  },
  {
    path: 'garage-door-opener-repair/costa-mesa-ca',
    h1: 'Garage Door Opener Repair in Costa Mesa, CA',
    title: 'Garage Door Opener Repair Costa Mesa CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Costa Mesa | Garage Guys',
    description:
      'Garage door opener repair in Costa Mesa, CA — motors, remotes, sensors &amp; keypads. Same-day service. (949) 539-0009.',
    schemaDescription: 'Garage door opener repair in Costa Mesa, California.',
    eyebrow: 'Costa Mesa, California',
    lead:
      'Costa Mesa opener problems solved same day — from condo carports to detached two-car garages.',
    sectionTitle: 'Costa Mesa Opener Service',
    paragraphs: [
      'Costa Mesa opener repairs span compact condo motors to full-size chain drives on detached garages. Common fixes include replacing burned logic boards after lightning events, reconnecting loose rail supports, and clearing obstructions that trigger constant reversing.',
      'We program new remotes when old ones lose dip-switch sync or need rolling-code pairing. Keypad entry codes can be reset on supported models after you verify ownership.',
      'Light commercial roll-up doors sometimes share opener issues with residential gear — limited travel, bad capacitors, or manual release handles stuck mid-position. We assess whether repair or replacement is more cost-effective before you spend on a new unit.',
      'Mesa del Mar condos frequently have low-headroom openers — we adjust chain sag and limit switches specific to those compact units.',
      'See <a href="/garage-door-repair/costa-mesa-ca/">garage door repair Costa Mesa</a> and <a href="/garage-door-opener-repair/orange-county/">Orange County opener repair</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Residential and light commercial',
      'Logic board and capacitor checks',
      'Keypad and remote setup',
      'Rail and trolley repair',
      'Repair vs replace guidance',
    ],
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/garage-door-repair/costa-mesa-ca/', label: 'Garage Door Repair Costa Mesa' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Costa Mesa Opener Repair',
    ctaText: 'Free estimate — opener repair in Costa Mesa.',
    areaServed: { type: 'City', name: 'Costa Mesa' },
  },
  {
    path: 'garage-door-opener-repair/mission-viejo-ca',
    h1: 'Garage Door Opener Repair in Mission Viejo, CA',
    title: 'Garage Door Opener Repair Mission Viejo CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Mission Viejo | Garage Guys',
    description:
      'Garage door opener repair in Mission Viejo, CA — smart openers, sensors &amp; motor service. Call (949) 539-0009.',
    schemaDescription: 'Garage door opener repair in Mission Viejo, California.',
    eyebrow: 'Mission Viejo, California',
    lead:
      'Mission Viejo opener acting up? We fix smart Wi-Fi units, safety sensors, and worn drive systems in one visit.',
    sectionTitle: 'Mission Viejo Opener Repair',
    paragraphs: [
      'Mission Viejo families rely on garage entry daily — when the opener fails, it disrupts school runs and commutes. Garage Guys prioritizes fast diagnosis: wall control, remotes, sensors, motor capacitor, drive gear, and door balance all get checked in sequence.',
      'Smart openers with myQ or similar apps may need Wi-Fi re-pairing or antenna extension in garages with weak signal. We confirm the door moves freely by hand before blaming the motor — binding rollers on hillside tracks often mimic opener failure.',
      'After repair we set force and limit screws to spec, test battery backup if equipped, and show you how to use manual release safely during future outages.',
      'Olympiad-area three-car garages sometimes need jackshaft opener service — we inspect wall-mount units for stripped couplers and loose chain to the torsion bar.',
      'Related pages: <a href="/garage-door-repair/mission-viejo-ca/">garage door repair Mission Viejo</a>, <a href="/garage-door-opener-repair/orange-county/">OC opener repair</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Wi-Fi opener setup help',
      'Full system diagnostic',
      'Roller and track binding fixes',
      'Manual release walkthrough',
      'Same-day Mission Viejo slots',
    ],
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/garage-door-repair/mission-viejo-ca/', label: 'Garage Door Repair Mission Viejo' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Mission Viejo Opener Repair',
    ctaText: 'Call now for opener repair in Mission Viejo.',
    areaServed: { type: 'City', name: 'Mission Viejo' },
  },
  // ── Priority cities: Anaheim, Santa Ana, Huntington Beach ──
  {
    path: 'garage-door-repair/anaheim-ca',
    h1: 'Garage Door Repair in Anaheim, CA',
    title: 'Garage Door Repair Anaheim CA | Same-Day Service | Garage Guys',
    ogTitle: 'Garage Door Repair Anaheim CA | Garage Guys',
    description:
      'Garage door repair in Anaheim, CA — springs, cables, panels &amp; off-track doors. Same-day service. Call (949) 539-0009.',
    schemaDescription: 'Garage door repair service in Anaheim, California.',
    eyebrow: 'Anaheim, California',
    lead:
      'Anaheim homeowners — stuck door, broken spring, or noisy opener? Same-day garage door repair with upfront pricing.',
    sectionTitle: 'Anaheim Garage Door Repair',
    paragraphs: [
      'Anaheim spans dense west-side neighborhoods, Anaheim Hills estates, and newer infill near the Platinum Triangle — each with different garage door wear patterns. Garage Guys handles off-track emergencies, snapped cables, cracked panels, and opener failures across the city.',
      'Older Anaheim tract homes often still run original rollers and single torsion springs past their cycle life. We inspect drums, bearings, and bottom brackets before quoting — fixing root causes instead of temporary patches.',
      'Near Angel Stadium and the convention center, rental properties need fast turnarounds between tenants. We communicate ETA clearly and finish most residential repairs in one trip when parts are on the truck.',
      'Anaheim Hills hillside doors add weight and track angle — we verify spring sizing so openers are not overloaded. Same-day slots available seven days a week.',
      'County page: <a href="/garage-door-repair/orange-county/">garage door repair Orange County</a>. Neighbors: <a href="/garage-door-repair/santa-ana-ca/">Santa Ana</a>, <a href="/garage-door-repair/irvine-ca/">Irvine</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Anaheim Hills heavy-door service',
      'Off-track and cable repair',
      'Rental property fast turnaround',
      'Panel and roller replacement',
      'Same-day appointments',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      { href: '/garage-door-repair/santa-ana-ca/', label: 'Garage Door Repair Santa Ana' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Anaheim Repair Today',
    ctaText: 'Call now for same-day garage door repair in Anaheim.',
    areaServed: { type: 'City', name: 'Anaheim' },
  },
  {
    path: 'garage-door-repair/santa-ana-ca',
    h1: 'Garage Door Repair in Santa Ana, CA',
    title: 'Garage Door Repair Santa Ana CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Repair Santa Ana CA | Garage Guys',
    description:
      'Garage door repair in Santa Ana, CA — emergency off-track, springs, openers &amp; cables. Free estimate. (949) 539-0009.',
    schemaDescription: 'Garage door repair in Santa Ana, California.',
    eyebrow: 'Santa Ana, California',
    lead:
      'Santa Ana repair calls answered same day — from historic Floral Park to newer South Coast Metro townhomes.',
    sectionTitle: 'Santa Ana Door Repair',
    paragraphs: [
      'Santa Ana has some of Orange County\'s oldest housing stock — extension springs, worn cables, and tilt-up doors still appear alongside modern sectional systems. Garage Guys diagnoses what you actually have before recommending parts.',
      'High-traffic alleys and narrow driveways make off-track events common when a bumper catches the bottom panel. We realign tracks, replace bent sections when needed, and test full travel before leaving.',
      'Security matters when a door will not close — we treat stuck-open calls as priority and carry common hardware to secure the opening the same visit when possible.',
      'Bilingual communication available on request. You get a verbal quote before work starts; no surprise line items on the invoice.',
      'See <a href="/garage-door-repair/orange-county/">Orange County repair</a>, <a href="/garage-door-repair/anaheim-ca/">Anaheim</a>, <a href="/garage-door-repair/costa-mesa-ca/">Costa Mesa</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    features: [
      'Older door and extension spring expertise',
      'Emergency off-track service',
      'Track and roller replacement',
      'Opener safety testing',
      '7-day scheduling',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      { href: '/garage-door-repair/anaheim-ca/', label: 'Garage Door Repair Anaheim' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Santa Ana Repair',
    ctaText: 'Same-day garage door repair in Santa Ana — call now.',
    areaServed: { type: 'City', name: 'Santa Ana' },
  },
  {
    path: 'garage-door-repair/huntington-beach-ca',
    h1: 'Garage Door Repair in Huntington Beach, CA',
    title: 'Garage Door Repair Huntington Beach CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Repair Huntington Beach | Garage Guys',
    description:
      'Garage door repair in Huntington Beach, CA — coastal corrosion, springs &amp; openers. Same-day. Call (949) 539-0009.',
    schemaDescription: 'Garage door repair in Huntington Beach, California.',
    eyebrow: 'Huntington Beach, California',
    lead:
      'Surf City garages face salt air and heavy daily use — we repair doors, springs, and openers across Huntington Beach.',
    sectionTitle: 'Huntington Beach Repair',
    paragraphs: [
      'Huntington Beach coastal breeze accelerates rust on bottom fixtures, hinges, and steel cables — especially on homes west of PCH. Garage Guys inspects corrosion during every service call and replaces compromised hardware before it fails catastrophically.',
      'Beach-adjacent neighborhoods see sand and grit in tracks. We clean rails, lubricate appropriately, and adjust rollers so the door runs quietly instead of grinding through debris.',
      'Many HB garages double as storage for boards and bikes — bumped panels and misaligned sensors are routine. We realign photo-eyes and explain when a panel replacement makes sense versus cosmetic living.',
      'From Seacliff to Huntington Harbour, we offer same-day repair windows when available. Opener gear wear is common on heavy insulated doors — we check spring balance first.',
      'Related: <a href="/garage-door-repair/orange-county/">OC repair</a>, <a href="/garage-door-repair/newport-beach-ca/">Newport Beach</a>, <a href="/garage-door-opener-repair/huntington-beach-ca/">HB opener repair</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Coastal corrosion inspection',
      'Track cleaning and alignment',
      'Insulated door balancing',
      'Sensor and opener repair',
      'Same-day HB service',
    ],
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      { href: '/garage-door-opener-repair/huntington-beach-ca/', label: 'Opener Repair Huntington Beach' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Huntington Beach Repair',
    ctaText: 'Call for same-day garage door repair in HB.',
    areaServed: { type: 'City', name: 'Huntington Beach' },
  },
  {
    path: 'garage-door-spring-repair/anaheim-ca',
    h1: 'Garage Door Spring Repair in Anaheim, CA',
    title: 'Garage Door Spring Repair Anaheim CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Anaheim CA | Garage Guys',
    description:
      'Broken garage door spring in Anaheim, CA? Same-day torsion &amp; extension replacement. Call (949) 539-0009.',
    schemaDescription: 'Garage door spring repair in Anaheim, California.',
    eyebrow: 'Anaheim, California',
    lead:
      'Loud bang in the garage in Anaheim? We replace broken springs safely and rebalance your door the same day.',
    sectionTitle: 'Anaheim Spring Replacement',
    paragraphs: [
      'Anaheim spring failures spike on doors with 15+ years of daily cycles — common in west Anaheim and central neighborhoods. A broken torsion spring leaves the door dead weight; forcing the opener strips gears.',
      'Garage Guys measures wire size, inside diameter, and length, then installs matched springs for your door weight. Dual-spring setups get both sides wound evenly so the slab does not rise crooked.',
      'Anaheim Hills heavier doors may need high-cycle springs when three vehicles pass through daily. We explain 10,000 vs 25,000 cycle options before you decide.',
      'Every spring job includes cable inspection, drum check, and opener force recalibration. Manual lift test at mid-travel confirms balance.',
      'Also: <a href="/garage-door-repair/anaheim-ca/">garage door repair Anaheim</a>, <a href="/garage-door-spring-repair/orange-county/">OC spring repair</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Torsion and extension springs',
      'High-cycle upgrades',
      'Anaheim Hills heavy doors',
      'Opener recalibration',
      'Same-day service',
    ],
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/garage-door-repair/anaheim-ca/', label: 'Garage Door Repair Anaheim' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Anaheim Spring Repair',
    ctaText: 'Broken spring in Anaheim? Call now.',
    areaServed: { type: 'City', name: 'Anaheim' },
  },
  {
    path: 'garage-door-spring-repair/santa-ana-ca',
    h1: 'Garage Door Spring Repair in Santa Ana, CA',
    title: 'Garage Door Spring Repair Santa Ana CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Santa Ana | Garage Guys',
    description:
      'Garage door spring repair in Santa Ana, CA — extension &amp; torsion springs replaced same day. (949) 539-0009.',
    schemaDescription: 'Garage door spring repair in Santa Ana, California.',
    eyebrow: 'Santa Ana, California',
    lead:
      'Santa Ana spring repair for older extension systems and modern torsion setups — safe replacement, same day.',
    sectionTitle: 'Santa Ana Spring Service',
    paragraphs: [
      'Santa Ana still has many extension-spring doors on older garages — stretched springs, frayed cables, and rusted pulleys often fail together. We replace the full set when safety warrants it, not just the broken piece.',
      'Torsion conversions are an option on some retrofits, but when extension springs remain appropriate, we use matched pairs with new safety cables through the springs.',
      'A door that slams shut or flies open after a spring break is dangerous — keep family away until a pro unwinds and replaces hardware. Garage Guys carries winding bars and sizing charts for every common residential height.',
      'After replacement we lubricate rollers and hinges, then test auto-reverse on the opener. Most Santa Ana spring calls finish within two hours.',
      'Links: <a href="/garage-door-repair/santa-ana-ca/">garage door repair Santa Ana</a>, <a href="/garage-door-spring-repair/orange-county/">Orange County</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    features: [
      'Extension spring expertise',
      'Safety cable replacement',
      'Torsion spring sizing',
      'Balance and safety testing',
      '7-day availability',
    ],
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/garage-door-repair/santa-ana-ca/', label: 'Garage Door Repair Santa Ana' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Santa Ana Spring Repair',
    ctaText: 'Call for spring replacement in Santa Ana.',
    areaServed: { type: 'City', name: 'Santa Ana' },
  },
  {
    path: 'garage-door-spring-repair/huntington-beach-ca',
    h1: 'Garage Door Spring Repair in Huntington Beach, CA',
    title: 'Garage Door Spring Repair Huntington Beach CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Spring Repair Huntington Beach | Garage Guys',
    description:
      'Garage door spring repair in Huntington Beach, CA — coastal doors, same-day replacement. Call (949) 539-0009.',
    schemaDescription: 'Garage door spring repair in Huntington Beach, California.',
    eyebrow: 'Huntington Beach, California',
    lead:
      'Salt air shortens spring life in Huntington Beach — we replace and balance with corrosion-aware hardware checks.',
    sectionTitle: 'Huntington Beach Spring Repair',
    paragraphs: [
      'Huntington Beach springs and end bearings corrode faster than inland OC cities. Rust pits on torsion shafts can score new springs prematurely — we clean or replace bearings when needed.',
      'Insulated and wind-rated doors common near the coast weigh more, requiring correctly rated springs. Undersized springs fatigue within a year; we size to manufacturer door weight charts.',
      'If you heard a snap after a morning surf session, the door may look fine but hang crooked — that is a classic single-spring failure on a two-spring door. Replace both for even tension.',
      'Post-install we apply appropriate lubricant to springs (not grease overload) and verify smooth manual operation before handing back to your opener.',
      'See <a href="/garage-door-repair/huntington-beach-ca/">garage door repair HB</a>, <a href="/garage-door-spring-repair/orange-county/">OC springs</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Corrosion inspection',
      'Heavy insulated door sizing',
      'Bearing and shaft service',
      'Dual-spring replacement',
      'Same-day HB slots',
    ],
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      { href: '/garage-door-repair/huntington-beach-ca/', label: 'Garage Door Repair Huntington Beach' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'HB Spring Repair',
    ctaText: 'Broken spring in Huntington Beach? Call now.',
    areaServed: { type: 'City', name: 'Huntington Beach' },
  },
  {
    path: 'garage-door-opener-repair/anaheim-ca',
    h1: 'Garage Door Opener Repair in Anaheim, CA',
    title: 'Garage Door Opener Repair Anaheim CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Anaheim CA | Garage Guys',
    description:
      'Garage door opener repair in Anaheim, CA — chain, belt, sensors &amp; remotes. Same-day. (949) 539-0009.',
    schemaDescription: 'Garage door opener repair in Anaheim, California.',
    eyebrow: 'Anaheim, California',
    lead:
      'Anaheim opener not responding? We fix sensors, gears, remotes, and smart units — often the same day you call.',
    sectionTitle: 'Anaheim Opener Repair',
    paragraphs: [
      'Anaheim opener service runs the gamut: stripped nylon gears on vintage chain drives, miswired wall buttons in remodeled garages, and Wi-Fi models that lost pairing after router changes.',
      'We start with door balance — many Anaheim Hills openers fail because springs weakened slowly over years. Replacing a motor without fixing springs wastes your money.',
      'Rental and multi-family properties near the resort district need reliable photo-eyes — we mount them rigidly and run wire so vibration does not knock them out of alignment every month.',
      'Gear and sprocket kits, capacitors, and limit switches ride on the truck for common LiftMaster, Chamberlain, and Genie units.',
      'More: <a href="/garage-door-opener-repair/orange-county/">opener repair OC</a>, <a href="/garage-door-repair/anaheim-ca/">garage door repair Anaheim</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Gear and sprocket replacement',
      'Smart opener re-pairing',
      'Sensor alignment',
      'Spring balance check',
      'Same-day Anaheim service',
    ],
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/garage-door-repair/anaheim-ca/', label: 'Garage Door Repair Anaheim' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Anaheim Opener Fix',
    ctaText: 'Call now for opener repair in Anaheim.',
    areaServed: { type: 'City', name: 'Anaheim' },
  },
  {
    path: 'garage-door-opener-repair/santa-ana-ca',
    h1: 'Garage Door Opener Repair in Santa Ana, CA',
    title: 'Garage Door Opener Repair Santa Ana CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Santa Ana | Garage Guys',
    description:
      'Garage door opener repair in Santa Ana, CA — motors, remotes &amp; safety sensors. Call (949) 539-0009.',
    schemaDescription: 'Garage door opener repair in Santa Ana, California.',
    eyebrow: 'Santa Ana, California',
    lead:
      'Santa Ana opener humming or reversing? We diagnose wall controls, sensors, and drive systems on-site.',
    sectionTitle: 'Santa Ana Opener Service',
    paragraphs: [
      'Santa Ana garages often pair older openers with updated doors — mismatch causes constant reversing. We set travel limits and force to match actual door weight after verifying springs.',
      'Extension-spring doors need careful opener force; too much adjustment strips gears when springs stretch further. We inspect springs during every opener call.',
      'Frayed sensor wires from garage clutter are a quick fix when caught early. We replace low-voltage leads and secure them along the rail away from moving parts.',
      'When replacement beats repair on a 20-year-old unit, we explain belt-drive quiet options and install with fresh reinforcement to ceiling joists.',
      'Related: <a href="/garage-door-repair/santa-ana-ca/">garage door repair Santa Ana</a>, <a href="/garage-door-opener-repair/orange-county/">OC openers</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    features: [
      'Legacy opener expertise',
      'Travel limit calibration',
      'Sensor wiring repair',
      'Repair vs replace advice',
      '7-day scheduling',
    ],
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/garage-door-repair/santa-ana-ca/', label: 'Garage Door Repair Santa Ana' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Santa Ana Opener Repair',
    ctaText: 'Same-day opener repair in Santa Ana — call now.',
    areaServed: { type: 'City', name: 'Santa Ana' },
  },
  {
    path: 'garage-door-opener-repair/huntington-beach-ca',
    h1: 'Garage Door Opener Repair in Huntington Beach, CA',
    title: 'Garage Door Opener Repair Huntington Beach CA | Same-Day | Garage Guys',
    ogTitle: 'Garage Door Opener Repair Huntington Beach | Garage Guys',
    description:
      'Garage door opener repair in Huntington Beach, CA — growing demand for HB opener service. Call (949) 539-0009.',
    schemaDescription: 'Garage door opener repair in Huntington Beach, California.',
    eyebrow: 'Huntington Beach, California',
    lead:
      'Huntington Beach opener repair — sensors, smart Wi-Fi units, and worn drive gears fixed same day.',
    sectionTitle: 'Huntington Beach Opener Repair',
    paragraphs: [
      'Opener repair demand in Huntington Beach keeps rising as coastal homes upgrade to smart belt-drive units. We configure myQ and similar apps, extend antennas when Wi-Fi is weak, and fix mechanical issues in the same visit.',
      'Morning sun glare across the garage mouth blinds safety sensors — a top cause of random reversals in HB. We shade, realign, and swap to sun-resistant sensor housings when needed.',
      'Corrosion on chain and rail brackets near open garage doors causes binding that feels like motor failure. We clean, lubricate correctly, and replace rusted hardware.',
      'Heavy insulated doors after spring fatigue burn out capacitors — we test microfarad values and replace boards only when justified.',
      'Also: <a href="/garage-door-repair/huntington-beach-ca/">garage door repair HB</a>, <a href="/garage-door-opener-repair/orange-county/">Orange County</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Smart opener setup',
      'Sun-glare sensor fixes',
      'Coastal hardware service',
      'Capacitor and gear diagnostics',
      'Same-day HB appointments',
    ],
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      { href: '/garage-door-repair/huntington-beach-ca/', label: 'Garage Door Repair Huntington Beach' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'HB Opener Repair',
    ctaText: 'Call for opener repair in Huntington Beach.',
    areaServed: { type: 'City', name: 'Huntington Beach' },
  },
];

for (const page of pages) {
  const dir = path.join(root, page.path);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), renderPage(page), 'utf8');
  console.log('wrote', page.path);
}

console.log(`Generated ${pages.length} SEO landing pages.`);
