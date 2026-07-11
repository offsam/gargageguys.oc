/** Symptom/problem SEO pages — no city slug; target national queries with OC service area. */

const OC = { type: 'AdministrativeArea', name: 'Orange County, California' };

function problemPage(config) {
  return {
    areaServed: OC,
    ...config,
  };
}

export const problemPages = [
  problemPage({
    path: 'garage-door-wont-open',
    h1: 'Garage Door Won\'t Open?',
    title: 'Garage Door Won\'t Open | Same-Day Fix Orange County | Garage Guys',
    ogTitle: 'Garage Door Won\'t Open | Orange County | Garage Guys',
    description:
      'Garage door won\'t open? Same-day diagnosis in Orange County — springs, opener, sensors &amp; more. Free estimate. Call (949) 539-0009.',
    schemaDescription:
      'Garage door won\'t open troubleshooting and same-day repair across Orange County, California.',
    eyebrow: 'Orange County, California',
    lead:
      'Press the button and nothing happens — or the motor runs but the door barely moves? Garage Guys fixes doors that won\'t open across Orange County, same day.',
    sectionTitle: 'Why Your Garage Door Won\'t Open',
    paragraphs: [
      'A garage door that refuses to open usually traces to one of a few causes: broken torsion or extension springs, a stripped opener gear, misaligned safety sensors, or a door that is physically binding in the tracks. The opener is designed to assist a balanced door — it is not meant to dead-lift a failed spring.',
      'Start safely: disconnect the opener using the manual release only if you can lift the door without excessive force. If the door is extremely heavy or hung unevenly, stop — that indicates a broken spring or cable and requires professional service.',
      'Garage Guys tests springs, cables, drums, rollers, track alignment, and opener force settings in one visit. We quote before repair and stock common parts on the truck for Orange County routes.',
      'Serving Irvine, Anaheim, Santa Ana, Huntington Beach, Newport Beach, Costa Mesa, Mission Viejo, Fullerton, Garden Grove, Lake Forest, and surrounding OC communities.',
      'If the opener light flashes a error code, tell us the blink pattern when you call — it speeds up diagnosis on arrival.',
      'Related: <a href="/broken-garage-door-spring/">broken garage door spring</a>, <a href="/garage-door-off-track/">door off track</a>, <a href="/garage-door-repair/orange-county/">garage door repair OC</a>. Call <a href="tel:+19495390009">(949) 539-0009</a> or <a href="/">Garage Guys home</a>.',
    ],
    features: [
      'Spring and opener diagnostics',
      'Sensor realignment',
      'Same-day Orange County service',
      'Free estimate before work',
      '7 days a week',
    ],
    related: [
      { href: '/broken-garage-door-spring/', label: 'Broken Garage Door Spring' },
      { href: '/garage-door-off-track/', label: 'Garage Door Off Track' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Door Won\'t Open?',
    ctaText: 'Call now — same-day garage door repair in Orange County.',
  }),

  problemPage({
    path: 'garage-door-off-track',
    h1: 'Garage Door Off Track Repair',
    title: 'Garage Door Off Track | Same-Day Realignment OC | Garage Guys',
    ogTitle: 'Garage Door Off Track Repair | Orange County',
    description:
      'Garage door off track in Orange County? Safe realignment, roller &amp; track repair. Same-day service. Call (949) 539-0009.',
    schemaDescription:
      'Garage door off-track realignment and track repair across Orange County, California.',
    eyebrow: 'Orange County, California',
    lead:
      'Door crooked, scraping, or jammed halfway? An off-track garage door is unsafe — Garage Guys realigns and repairs tracks across Orange County.',
    sectionTitle: 'Off-Track Door Repair in OC',
    paragraphs: [
      'A garage door goes off track when rollers pop out of the rail, a cable breaks on one side, or the bottom section hits an obstacle like a car bumper. Continuing to run the opener forces metal into metal and can bend tracks or tear cables.',
      'Do not try to power the opener through an off-track condition. If the door is hanging by a single cable, keep people and vehicles clear until a technician secures it.',
      'Garage Guys loosens track bolts, resets rollers into the rail, replaces bent sections when needed, and verifies cable tension is even on both sides. We inspect why it derailed — worn rollers and loose brackets are frequent root causes.',
      'Same-day off-track service is available across Orange County including Irvine, Anaheim, Huntington Beach, Newport Beach, Tustin-area routes, and the Inland Empire when scheduling allows.',
      'We carry straight track sections and heavy-duty rollers on the truck for common residential door widths.',
      'See also <a href="/garage-door-cable-repair/">garage door cable repair</a>, <a href="/emergency-garage-door-repair/orange-county/">emergency repair OC</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Safe derailment recovery',
      'Track straightening and replacement',
      'Roller and bracket upgrades',
      'Cable tension balancing',
      'Same-day OC appointments',
    ],
    related: [
      { href: '/garage-door-cable-repair/', label: 'Garage Door Cable Repair' },
      { href: '/emergency-garage-door-repair/orange-county/', label: 'Emergency Repair OC' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Door Off Track?',
    ctaText: 'Call for same-day off-track repair in Orange County.',
  }),

  problemPage({
    path: 'broken-garage-door-spring',
    h1: 'Broken Garage Door Spring Repair',
    title: 'Broken Garage Door Spring | Same-Day Replacement OC | Garage Guys',
    ogTitle: 'Broken Garage Door Spring Repair | Orange County',
    description:
      'Broken garage door spring in Orange County? Same-day torsion &amp; extension spring replacement. Call (949) 539-0009 for a free estimate.',
    schemaDescription:
      'Broken garage door spring repair and replacement across Orange County, California.',
    eyebrow: 'Orange County, California',
    lead:
      'Heard a loud bang from the garage? Door too heavy to lift? A broken spring is the most common cause — we replace them safely across Orange County.',
    sectionTitle: 'Broken Spring? Here\'s What to Do',
    paragraphs: [
      'Garage door springs counterbalance the full weight of the door — often 150 to 250 pounds. When a torsion spring breaks you may see a visible gap in the coil; extension springs can snap along the horizontal track. Either way, the opener cannot safely raise the door.',
      'Do not attempt DIY spring replacement. Winding torsion springs requires proper bars, sizing, and training — stored energy can cause serious injury.',
      'Garage Guys measures door weight and height, installs matched springs, balances the door, and recalibrates opener limits. Most spring replacements in Orange County finish in under two hours with parts on the truck.',
      'If one of two torsion springs broke, we recommend replacing both so tension stays even and the door does not drift crooked.',
      'Typical Orange County spring jobs take one to two hours including balance testing — you get the total price before we begin winding.',
      'Pricing guide: <a href="/garage-door-spring-repair-cost/">garage door spring repair cost</a>. County service: <a href="/garage-door-spring-repair/orange-county/">spring repair OC</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    features: [
      'Torsion and extension springs',
      'Dual-spring replacement',
      'Door balance testing',
      'Opener recalibration',
      'Same-day Orange County',
    ],
    related: [
      { href: '/garage-door-torsion-spring-repair/', label: 'Torsion Spring Repair' },
      { href: '/garage-door-spring-repair-cost/', label: 'Spring Repair Cost' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Broken Spring?',
    ctaText: 'Do not force the door — call for same-day spring repair.',
  }),

  problemPage({
    path: 'garage-door-cable-repair',
    h1: 'Garage Door Cable Repair',
    title: 'Garage Door Cable Broken or Frayed | Repair OC | Garage Guys',
    ogTitle: 'Garage Door Cable Repair | Orange County',
    description:
      'Garage door cable broken or frayed in Orange County? Same-day cable replacement &amp; drum service. Call (949) 539-0009.',
    schemaDescription:
      'Garage door lift cable repair and replacement across Orange County, California.',
    eyebrow: 'Orange County, California',
    lead:
      'Frayed cables or a door rising crooked? Lift cables carry enormous tension — Garage Guys replaces them safely across Orange County.',
    sectionTitle: 'Cable Repair & Replacement',
    paragraphs: [
      'Garage door lift cables wind onto drums at each end of the torsion shaft. When a cable frays or snaps, one corner of the door may rise while the other lags — or the door can drop violently if tension releases unevenly.',
      'Cable failure often follows a broken spring or off-track event. We inspect drums, bearings, bottom brackets, and spring tension together because replacing a cable alone on a misbalanced door invites another failure.',
      'Garage Guys uses correct cable diameter and length for your drum size, secures bottom fixtures, and winds springs to spec after cable work. Same-day appointments available throughout Orange County.',
      'Coastal cities like Huntington Beach and Newport Beach see accelerated corrosion at cable loops — we recommend replacement at first sign of rust pitting, not after complete failure.',
      'Cable work is always paired with a balance test — a level door at rest confirms even drum winding and correct spring tension.',
      'Related: <a href="/garage-door-off-track/">off track repair</a>, <a href="/broken-garage-door-spring/">broken spring</a>, <a href="/garage-door-repair/orange-county/">garage door repair OC</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Frayed cable replacement',
      'Drum and bearing inspection',
      'Bottom bracket service',
      'Post-repair balance test',
      '7-day OC scheduling',
    ],
    related: [
      { href: '/garage-door-off-track/', label: 'Garage Door Off Track' },
      { href: '/broken-garage-door-spring/', label: 'Broken Garage Door Spring' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Cable Broken?',
    ctaText: 'Call for same-day cable repair in Orange County.',
  }),

  problemPage({
    path: 'garage-door-wont-close',
    h1: 'Garage Door Won\'t Close?',
    title: 'Garage Door Won\'t Close | Sensor &amp; Opener Fix OC | Garage Guys',
    ogTitle: 'Garage Door Won\'t Close | Orange County | Garage Guys',
    description:
      'Garage door won\'t close all the way? Sensor, limit &amp; track fixes in Orange County. Same-day. Call (949) 539-0009.',
    schemaDescription:
      'Garage door won\'t close troubleshooting and repair across Orange County, California.',
    eyebrow: 'Orange County, California',
    lead:
      'Door starts down then reverses — or stops a foot from the floor? Garage Guys fixes doors that won\'t close across Orange County.',
    sectionTitle: 'Why a Garage Door Won\'t Close',
    paragraphs: [
      'When a garage door refuses to close, safety sensors are the first suspect: photo-eyes mounted six inches off the floor must align and show steady indicator lights. Sun glare, cobwebs, or a kicked bracket are everyday causes in Orange County garages.',
      'Travel limit settings on the opener may be set too short after a previous adjustment — the motor thinks it hit the floor when it has not. Conversely, binding in the track from a bent section or worn roller can trigger force reversal.',
      'Garage Guys realigns sensors, cleans lenses, adjusts limits to manufacturer spec, and fixes mechanical binding when present. We never bypass safety devices — that puts people and property at risk.',
      'If the door closes manually but not with the opener, gear wear or a heavy unbalanced door may be overloading the motor — we check springs as part of every opener call.',
      'Also see <a href="/garage-door-wont-open/">garage door won\'t open</a>, <a href="/garage-door-opener-repair/orange-county/">opener repair OC</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Photo-eye realignment',
      'Travel limit adjustment',
      'Track binding correction',
      'Spring balance check',
      'Same-day Orange County',
    ],
    related: [
      { href: '/garage-door-wont-open/', label: 'Garage Door Won\'t Open' },
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair OC' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Door Won\'t Close?',
    ctaText: 'Call now — same-day fix in Orange County.',
  }),

  problemPage({
    path: 'garage-door-torsion-spring-repair',
    h1: 'Garage Door Torsion Spring Repair',
    title: 'Garage Door Torsion Spring Repair | Orange County | Garage Guys',
    ogTitle: 'Torsion Spring Repair | Orange County | Garage Guys',
    description:
      'Garage door torsion spring repair in Orange County — safe winding, sizing &amp; replacement. Same-day. (949) 539-0009.',
    schemaDescription:
      'Garage door torsion spring repair and replacement across Orange County, California.',
    eyebrow: 'Orange County, California',
    lead:
      'Torsion springs sit above the door on a steel shaft — when they break, the door is dead weight. Garage Guys repairs and replaces torsion springs across Orange County.',
    sectionTitle: 'Torsion Spring Service in OC',
    paragraphs: [
      'Torsion springs are the standard on most modern sectional doors in Orange County. They twist along a shaft above the header, storing energy that lifts the door evenly. Correct wire size, inside diameter, and length are critical — guessing leads to short spring life or a dangerous imbalance.',
      'Professional repair uses winding bars rated for the job, never screwdrivers or makeshift tools. We unwind remaining tension safely, slide off broken springs, inspect end bearings and center bushing, then install matched pairs when both sides are due.',
      'High-cycle spring upgrades make sense for doors that open more than four times daily — common in OC homes that use the garage as the main entrance.',
      'After winding, we verify the door stays at mid-travel when released and recalibrate opener force so the motor is not straining.',
      'Garage Guys serves all of Orange County — call for a free estimate and same-day torsion spring repair when routes are open.',
      'More: <a href="/broken-garage-door-spring/">broken garage door spring</a>, <a href="/garage-door-spring-repair-cost/">spring repair cost</a>, <a href="/garage-door-spring-repair/orange-county/">spring repair OC</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    features: [
      'Professional winding bars',
      'Matched dual-spring installs',
      'Bearing replacement',
      'High-cycle upgrades',
      'Same-day Orange County',
    ],
    related: [
      { href: '/broken-garage-door-spring/', label: 'Broken Garage Door Spring' },
      { href: '/garage-door-spring-repair-cost/', label: 'Spring Repair Cost' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Torsion Spring Repair',
    ctaText: 'Call for same-day torsion spring service in OC.',
  }),

  problemPage({
    path: 'garage-door-spring-repair-cost',
    h1: 'Garage Door Spring Repair Cost in Orange County',
    title: 'Garage Door Spring Repair Cost | Free Estimate OC | Garage Guys',
    ogTitle: 'Cost to Replace Garage Door Spring | Orange County',
    description:
      'How much does garage door spring replacement cost in Orange County? Free on-site estimate — call (949) 539-0009. Same-day service.',
    schemaDescription:
      'Garage door spring repair and replacement cost estimates in Orange County, California.',
    eyebrow: 'Orange County, California',
    lead:
      'Wondering what it costs to replace garage door springs? We quote on-site after measuring your door — no phone guesswork, no hidden fees.',
    sectionTitle: 'What Affects Spring Replacement Cost',
    paragraphs: [
      'Garage door spring repair cost depends on door size and weight, spring type (torsion vs extension), whether one or two springs are needed, and hardware condition around the spring system. A standard single-car torsion spring replacement is different from a heavy insulated double-wide door on a hillside lot.',
      'Garage Guys provides a free estimate after inspecting your door in person — we measure height, width, and weight class, then quote parts and labor before work starts. You are never obligated to proceed.',
      'Replacing only one spring on a two-spring door often costs more long-term: the older spring fails weeks later and requires a second service visit. We explain when paired replacement saves money.',
      'High-cycle springs cost more upfront but last longer on busy garages — we help you choose based on actual daily use, not upsell pressure.',
      'Ready for a number? Call <a href="tel:+19495390009">(949) 539-0009</a> for a same-day estimate in Irvine, Anaheim, Santa Ana, Huntington Beach, Newport Beach, Costa Mesa, or anywhere in Orange County. Service page: <a href="/garage-door-spring-repair/orange-county/">spring repair OC</a> · <a href="/">Garage Guys</a>.',
    ],
    features: [
      'Free on-site estimate',
      'Upfront pricing before work',
      'Torsion and extension springs',
      'Single and double-car doors',
      'Labor warranty up to 1 year',
    ],
    related: [
      { href: '/garage-door-torsion-spring-repair/', label: 'Torsion Spring Repair' },
      { href: '/broken-garage-door-spring/', label: 'Broken Garage Door Spring' },
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: 'Get Your Spring Cost Estimate',
    ctaText: 'Call now — free estimate for spring replacement in OC.',
  }),
];
