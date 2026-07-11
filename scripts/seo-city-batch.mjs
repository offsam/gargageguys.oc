/** Page configs for 7 new priority cities (repair + spring + opener each). */

function repairPage(slug, name, lead, sectionTitle, paragraphs, features, neighborLinks) {
  return {
    path: `garage-door-repair/${slug}`,
    h1: `Garage Door Repair in ${name}, CA`,
    title: `Garage Door Repair ${name} CA | Same-Day Service | Garage Guys`,
    ogTitle: `Garage Door Repair ${name} CA | Garage Guys`,
    description: `Same-day garage door repair in ${name}, CA — springs, cables, panels &amp; off-track doors. Free estimate. Call (949) 539-0009.`,
    schemaDescription: `Garage door repair service in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead,
    sectionTitle,
    paragraphs,
    features,
    related: [
      { href: '/garage-door-repair/orange-county/', label: 'Orange County Repair' },
      ...neighborLinks,
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: `${name} Repair Today`,
    ctaText: `Call now for same-day garage door repair in ${name}.`,
    areaServed: { type: 'City', name },
  };
}

function springPage(slug, name, lead, sectionTitle, paragraphs, features, neighborLinks) {
  return {
    path: `garage-door-spring-repair/${slug}`,
    h1: `Garage Door Spring Repair in ${name}, CA`,
    title: `Garage Door Spring Repair ${name} CA | Same-Day | Garage Guys`,
    ogTitle: `Garage Door Spring Repair ${name} | Garage Guys`,
    description: `Broken garage door spring in ${name}, CA? Same-day torsion &amp; extension replacement. Call (949) 539-0009.`,
    schemaDescription: `Garage door spring repair in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead,
    sectionTitle,
    paragraphs,
    features,
    related: [
      { href: '/garage-door-spring-repair/orange-county/', label: 'Spring Repair Orange County' },
      ...neighborLinks,
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: `${name} Spring Repair`,
    ctaText: `Broken spring in ${name}? Call for same-day replacement.`,
    areaServed: { type: 'City', name },
  };
}

function openerPage(slug, name, lead, sectionTitle, paragraphs, features, neighborLinks) {
  return {
    path: `garage-door-opener-repair/${slug}`,
    h1: `Garage Door Opener Repair in ${name}, CA`,
    title: `Garage Door Opener Repair ${name} CA | Same-Day | Garage Guys`,
    ogTitle: `Garage Door Opener Repair ${name} | Garage Guys`,
    description: `Garage door opener repair in ${name}, CA — sensors, motors, remotes &amp; smart openers. Call (949) 539-0009.`,
    schemaDescription: `Garage door opener repair in ${name}, California.`,
    eyebrow: `${name}, California`,
    lead,
    sectionTitle,
    paragraphs,
    features,
    related: [
      { href: '/garage-door-opener-repair/orange-county/', label: 'Opener Repair Orange County' },
      ...neighborLinks,
      { href: '/', label: 'Garage Guys Home' },
    ],
    ctaTitle: `${name} Opener Repair`,
    ctaText: `Call for opener repair in ${name} today.`,
    areaServed: { type: 'City', name },
  };
}

export const newCityPages = [
  // ── Yorba Linda ──
  repairPage(
    'yorba-linda-ca',
    'Yorba Linda',
    'Yorba Linda estate homes and hillside garages need careful balancing — we repair doors, springs, and openers same day.',
    'Yorba Linda Garage Door Service',
    [
      'Yorba Linda properties often feature oversized three-car garages and custom wood or steel doors that weigh more than standard tract-home slabs. Garage Guys inspects spring tension, cable diameter, and opener force before quoting — critical on heavy doors in Black Gold and Hidden Hills.',
      'Horse properties and long driveways mean technicians need clear access instructions; we confirm gate codes and parking when you book. Off-track events on sloped approaches are common when a vehicle catches the bottom edge.',
      'We carry high-cycle spring options for doors that cycle multiple times daily between home, barn, and shop areas. Panel damage from golf carts or delivery trucks can often be section-replaced without a full door swap.',
      'See <a href="/garage-door-repair/orange-county/">Orange County repair</a>, <a href="/garage-door-repair/fullerton-ca/">Fullerton</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Heavy and custom door repair', 'High-cycle spring upgrades', 'Off-track realignment', 'Opener force calibration', 'Same-day Yorba Linda service'],
    [{ href: '/garage-door-repair/fullerton-ca/', label: 'Garage Door Repair Fullerton' }],
  ),
  springPage(
    'yorba-linda-ca',
    'Yorba Linda',
    'Broken spring on a heavy Yorba Linda garage door? We size and install matched torsion springs safely — same day.',
    'Yorba Linda Spring Replacement',
    [
      'Yorba Linda torsion springs on wide or heavy doors require accurate wire-size and length matching — undersized springs fail again within months. Garage Guys weighs the door and checks drum capacity before winding.',
      'Dual spring systems should be replaced in pairs when one breaks; uneven tension warps the top section and strains the opener. We verify shaft bearings are not scored from prior failures.',
      'Hillside temperature swings expand and contract hardware — we lubricate appropriately and confirm the door holds at mid-travel after service.',
      'Also: <a href="/garage-door-repair/yorba-linda-ca/">garage door repair Yorba Linda</a>, <a href="/garage-door-spring-repair/orange-county/">OC springs</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    ['Heavy-door spring sizing', 'Dual torsion replacement', 'Bearing inspection', 'Opener recalibration', '7-day scheduling'],
    [{ href: '/garage-door-spring-repair/fullerton-ca/', label: 'Spring Repair Fullerton' }],
  ),
  openerPage(
    'yorba-linda-ca',
    'Yorba Linda',
    'Quiet belt-drive openers are common in Yorba Linda — we repair sensors, gears, and Wi-Fi pairing same day.',
    'Yorba Linda Opener Repair',
    [
      'Yorba Linda homeowners often choose premium belt-drive or wall-mount openers for quiet operation near bedrooms. When travel limits drift, doors stop short or reverse — we recalibrate and test full cycles.',
      'Smart openers lose app connection after router upgrades; we re-pair devices and check antenna placement in garages with foil-backed insulation that blocks signal.',
      'On heavy doors, opener strain usually means springs weakened first — we balance before replacing motors unnecessarily.',
      'Links: <a href="/garage-door-repair/yorba-linda-ca/">repair Yorba Linda</a>, <a href="/garage-door-opener-repair/orange-county/">OC openers</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Belt-drive service', 'Smart opener setup', 'Travel limit adjustment', 'Spring balance check', 'Same-day appointments'],
    [{ href: '/garage-door-opener-repair/fullerton-ca/', label: 'Opener Repair Fullerton' }],
  ),

  // ── Fullerton ──
  repairPage(
    'fullerton-ca',
    'Fullerton',
    'Fullerton garage door repair from historic bungalows to remodeled homes — same-day service with upfront quotes.',
    'Fullerton Door Repair',
    [
      'Fullerton mixes century-old garages near downtown with updated homes around Sunny Hills and Amerige Heights. Garage Guys services sectional doors, older tilt-ups, and converted carriage-style openings.',
      'College-area rentals see high turnover and neglected maintenance — we document pre-existing damage and quote clearly for landlords and tenants alike.',
      'Common calls include frayed cables on aging hardware, bent bottom tracks from curb impacts, and openers that lost programming after power outages.',
      'County: <a href="/garage-door-repair/orange-county/">OC repair</a>. Neighbors: <a href="/garage-door-repair/yorba-linda-ca/">Yorba Linda</a>, <a href="/garage-door-repair/anaheim-ca/">Anaheim</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Older door expertise', 'Rental property service', 'Cable and track repair', 'Opener reprogramming', 'Same-day Fullerton slots'],
    [{ href: '/garage-door-repair/anaheim-ca/', label: 'Garage Door Repair Anaheim' }],
  ),
  springPage(
    'fullerton-ca',
    'Fullerton',
    'Fullerton spring repair for extension and torsion systems — safe replacement, same-day availability.',
    'Fullerton Spring Service',
    [
      'Many older Fullerton garages still use extension springs along horizontal tracks — stretched or rusted pairs are a safety hazard. We install matched sets with new safety cables when required.',
      'Remodeled homes often upgraded to torsion springs without replacing worn cables; we inspect the full lifting system during every spring call.',
      'A door that crashes down after one spring breaks needs immediate service — keep people clear until tension is restored professionally.',
      'See <a href="/garage-door-repair/fullerton-ca/">garage door repair Fullerton</a>, <a href="/garage-door-spring-repair/orange-county/">Orange County</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    ['Extension spring replacement', 'Torsion conversions support', 'Safety cable install', 'Balance testing', '7-day availability'],
    [{ href: '/garage-door-spring-repair/anaheim-ca/', label: 'Spring Repair Anaheim' }],
  ),
  openerPage(
    'fullerton-ca',
    'Fullerton',
    'Fullerton opener repair — chain drives, wall buttons, and safety sensors diagnosed on-site.',
    'Fullerton Opener Repair',
    [
      'Fullerton sees plenty of legacy chain-drive openers in established neighborhoods — worn gears strip until the motor runs with no movement. We replace gear kits and verify rail alignment.',
      'Detached garages behind alley access need reliable wall controls; we troubleshoot wiring and replace faulty buttons instead of guessing.',
      'Photo-eye sun glare on west-facing garages causes nuisance reversals — we reposition and shield sensors properly.',
      'More: <a href="/garage-door-repair/fullerton-ca/">repair Fullerton</a>, <a href="/garage-door-opener-repair/orange-county/">OC opener repair</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Gear kit replacement', 'Wall control wiring', 'Sensor realignment', 'Rail and trolley service', 'Same-day repair'],
    [{ href: '/garage-door-opener-repair/anaheim-ca/', label: 'Opener Repair Anaheim' }],
  ),

  // ── Garden Grove ──
  repairPage(
    'garden-grove-ca',
    'Garden Grove',
    'Garden Grove garage door repair for homes, condos, and busy family garages — same-day when routes allow.',
    'Garden Grove Repair',
    [
      'Garden Grove\'s dense neighborhoods mean tight driveways and shared walls — we protect vehicles and landscaping while working on off-track or cable emergencies.',
      'Multi-generational homes often see heavy daily garage use; rollers, hinges, and springs wear faster. We stock standard 16-foot hardware for quick turnaround.',
      'From West Grove to the eastern tracts, we handle panel dents, noisy operation, and doors that will not seal at the floor due to compressed weatherstripping.',
      'Related: <a href="/garage-door-repair/orange-county/">Orange County</a>, <a href="/garage-door-repair/fountain-valley-ca/">Fountain Valley</a>, <a href="/garage-door-repair/anaheim-ca/">Anaheim</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Tight-driveway service', 'Roller and hinge replacement', 'Weather seal repair', 'Off-track correction', 'Same-day scheduling'],
    [{ href: '/garage-door-repair/fountain-valley-ca/', label: 'Garage Door Repair Fountain Valley' }],
  ),
  springPage(
    'garden-grove-ca',
    'Garden Grove',
    'Garden Grove spring replacement — torsion and extension springs installed and balanced same day.',
    'Garden Grove Spring Repair',
    [
      'High cycle counts in Garden Grove family garages fatigue springs predictably after 7–10 years. We recommend appropriate cycle ratings when you use the door as the main entry.',
      'Broken springs often coincide with frayed cables — replacing both prevents a second emergency visit within weeks.',
      'Low-headroom garages in older Garden Grove tracts may need specialized hardware; we measure before ordering parts.',
      'Links: <a href="/garage-door-repair/garden-grove-ca/">repair Garden Grove</a>, <a href="/garage-door-spring-repair/orange-county/">OC springs</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    ['Cycle-rated springs', 'Cable replacement', 'Low-headroom solutions', 'Opener force reset', '7-day service'],
    [{ href: '/garage-door-spring-repair/fountain-valley-ca/', label: 'Spring Repair Fountain Valley' }],
  ),
  openerPage(
    'garden-grove-ca',
    'Garden Grove',
    'Garden Grove opener not working? Motors, remotes, and sensors fixed — often in one trip.',
    'Garden Grove Opener Service',
    [
      'Garden Grove opener calls frequently involve remotes that need reprogramming after battery failure or cleared memory. We sync remotes, keypads, and wall controls in one visit.',
      'Condos and townhomes may share firewall-mounted controls — we trace low-voltage wiring to find intermittent faults.',
      'When the opener hums, we inspect gears and door balance before recommending a new motor unit.',
      'See <a href="/garage-door-repair/garden-grove-ca/">garage door repair</a>, <a href="/garage-door-opener-repair/orange-county/">Orange County openers</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Remote programming', 'Keypad setup', 'Gear replacement', 'Sensor alignment', 'Same-day Garden Grove'],
    [{ href: '/garage-door-opener-repair/fountain-valley-ca/', label: 'Opener Repair Fountain Valley' }],
  ),

  // ── Fountain Valley ──
  repairPage(
    'fountain-valley-ca',
    'Fountain Valley',
    'Central OC location — fast Fountain Valley garage door repair for springs, cables, panels, and openers.',
    'Fountain Valley Repair',
    [
      'Fountain Valley sits between beach cities and inland OC — our routes pass through daily, enabling quick same-day windows for stuck doors and broken springs.',
      'Single-story ranch homes dominate many blocks; standard parts fit most doors, keeping repairs affordable and fast.',
      'We see frequent roller wear from sandy grit tracked in from nearby recreation areas — cleaning tracks is part of many service calls.',
      'Also: <a href="/garage-door-repair/orange-county/">OC repair</a>, <a href="/garage-door-repair/huntington-beach-ca/">Huntington Beach</a>, <a href="/garage-door-repair/costa-mesa-ca/">Costa Mesa</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Fast central OC dispatch', 'Roller and track service', 'Panel repair', 'Emergency off-track', 'Free estimates'],
    [{ href: '/garage-door-repair/huntington-beach-ca/', label: 'Garage Door Repair Huntington Beach' }],
  ),
  springPage(
    'fountain-valley-ca',
    'Fountain Valley',
    'Fountain Valley broken spring? Same-day torsion and extension replacement with full balance test.',
    'Fountain Valley Spring Repair',
    [
      'Fountain Valley homeowners often notice a broken spring when the opener stalls mid-lift — continuing to force it strips gears. We replace springs and inspect the opener in the same appointment.',
      'Matched two-spring replacement keeps the door level; we wind both sides to manufacturer torque specs.',
      'After service we verify manual release works smoothly for future power outages.',
      'Related: <a href="/garage-door-repair/fountain-valley-ca/">repair Fountain Valley</a>, <a href="/garage-door-spring-repair/orange-county/">Orange County</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    ['Dual spring replacement', 'Opener stall diagnosis', 'Manual release check', 'Same-day slots', 'Labor warranty'],
    [{ href: '/garage-door-spring-repair/huntington-beach-ca/', label: 'Spring Repair Huntington Beach' }],
  ),
  openerPage(
    'fountain-valley-ca',
    'Fountain Valley',
    'Fountain Valley opener repair — chain, belt, and smart units serviced same day.',
    'Fountain Valley Opener Repair',
    [
      'Fountain Valley garages commonly use reliable chain-drive openers; we replace worn sprockets and adjust chain slack to stop bouncing during travel.',
      'Safety sensors mounted too low get kicked — we reinstall at proper height with rigid brackets.',
      'Wi-Fi openers get signal checks; we suggest simple antenna extensions when garage routers sit far away.',
      'More: <a href="/garage-door-repair/fountain-valley-ca/">repair</a>, <a href="/garage-door-opener-repair/orange-county/">OC openers</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Chain tension service', 'Sensor bracket upgrades', 'Wi-Fi troubleshooting', 'Gear kits on truck', '7-day repair'],
    [{ href: '/garage-door-opener-repair/huntington-beach-ca/', label: 'Opener Repair Huntington Beach' }],
  ),

  // ── Lake Forest ──
  repairPage(
    'lake-forest-ca',
    'Lake Forest',
    'Lake Forest planned-community garage doors — repair, balance, and same-day parts replacement.',
    'Lake Forest Garage Repair',
    [
      'Lake Forest master-planned neighborhoods use consistent door sizes — we stock matching springs and rollers for fast first-visit completion.',
      'Foothill Ranch and Baker Ranch homes see temperature-related track expansion; doors may bind seasonally until aligned and lubricated correctly.',
      'HOA communities appreciate neat work and debris cleanup — we leave the driveway clear after cable or spring service.',
      'See <a href="/garage-door-repair/orange-county/">Orange County</a>, <a href="/garage-door-repair/mission-viejo-ca/">Mission Viejo</a>, <a href="/garage-door-repair/irvine-ca/">Irvine</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Planned-community service', 'Seasonal track adjustment', 'HOA-friendly work', 'Spring and cable repair', 'Same-day Lake Forest'],
    [{ href: '/garage-door-repair/mission-viejo-ca/', label: 'Garage Door Repair Mission Viejo' }],
  ),
  springPage(
    'lake-forest-ca',
    'Lake Forest',
    'Lake Forest spring repair for standard and oversized residential doors — safe winding, same day.',
    'Lake Forest Spring Service',
    [
      'Lake Forest three-car garages often use dual torsion springs; when one breaks, replace both to avoid uneven lift that crooks the top panel.',
      'We measure door weight after removing tension — the only accurate way to spec new springs on insulated doors.',
      'Opener force gets recalibrated after every spring change so motors are not overworked.',
      'Links: <a href="/garage-door-repair/lake-forest-ca/">repair Lake Forest</a>, <a href="/garage-door-spring-repair/orange-county/">OC springs</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    ['Dual torsion systems', 'Insulated door weighing', 'Opener recalibration', 'High-cycle options', '7-day availability'],
    [{ href: '/garage-door-spring-repair/mission-viejo-ca/', label: 'Spring Repair Mission Viejo' }],
  ),
  openerPage(
    'lake-forest-ca',
    'Lake Forest',
    'Lake Forest opener diagnostics — remotes, sensors, and drive systems repaired fast.',
    'Lake Forest Opener Repair',
    [
      'Lake Forest families depend on garage entry daily; we prioritize calls where vehicles are trapped inside.',
      'Belt-drive units in newer tracts hum loudly when rails loosen from ceiling — we reinforce mounting and adjust limits.',
      'Battery backup openers need periodic testing; we verify hold-up force during each service.',
      'Lake Forest routes run daily through Foothill Ranch — afternoon same-day slots are often available when you call before 2 PM.',
      'Also: <a href="/garage-door-repair/lake-forest-ca/">garage door repair</a>, <a href="/garage-door-opener-repair/orange-county/">Orange County</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Trapped-vehicle priority', 'Belt-drive rail securing', 'Backup battery test', 'Remote programming', 'Same-day service'],
    [{ href: '/garage-door-opener-repair/mission-viejo-ca/', label: 'Opener Repair Mission Viejo' }],
  ),

  // ── Laguna Niguel ──
  repairPage(
    'laguna-niguel-ca',
    'Laguna Niguel',
    'Laguna Niguel hillside and canyon homes — garage door repair with careful heavy-door service.',
    'Laguna Niguel Repair',
    [
      'Laguna Niguel\'s rolling terrain means heavier doors and steeper track angles than flatland OC cities. Garage Guys checks spring sizing and hinge stress on every hillside call.',
      'Ocean-influenced air accelerates corrosion on bottom brackets and end bearings — we replace rusted hardware before it damages tracks.',
      'Gated communities require vendor check-in; share HOA details when booking so entry is smooth.',
      'Related: <a href="/garage-door-repair/orange-county/">OC repair</a>, <a href="/garage-door-repair/mission-viejo-ca/">Mission Viejo</a>, <a href="/garage-door-repair/newport-beach-ca/">Newport Beach</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Hillside door balancing', 'Corrosion hardware swap', 'Gated community service', 'Panel and track repair', 'Same-day appointments'],
    [{ href: '/garage-door-repair/mission-viejo-ca/', label: 'Garage Door Repair Mission Viejo' }],
  ),
  springPage(
    'laguna-niguel-ca',
    'Laguna Niguel',
    'Laguna Niguel spring replacement — sized for heavy doors on slope lots, same-day service.',
    'Laguna Niguel Spring Repair',
    [
      'Springs on Laguna Niguel slope lots work harder; undersized coils fatigue early. We install springs rated for actual door weight, not guesswork.',
      'Salt air pits torsion shafts — we clean or replace bearings so new springs are not damaged immediately.',
      'After winding, we confirm the door stays at half-open and that the opener no longer strains on the first foot of travel.',
      'See <a href="/garage-door-repair/laguna-niguel-ca/">repair Laguna Niguel</a>, <a href="/garage-door-spring-repair/orange-county/">Orange County</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    ['Heavy-door spring sizing', 'Shaft bearing service', 'Coastal corrosion checks', 'Balance verification', '7-day scheduling'],
    [{ href: '/garage-door-spring-repair/mission-viejo-ca/', label: 'Spring Repair Mission Viejo' }],
  ),
  openerPage(
    'laguna-niguel-ca',
    'Laguna Niguel',
    'Laguna Niguel smart opener repair — Wi-Fi, sensors, and premium belt drives serviced locally.',
    'Laguna Niguel Opener Repair',
    [
      'Laguna Niguel upgrades often include quiet belt-drive and wall-mount openers; we service LiftMaster, Chamberlain, Genie, and other major brands.',
      'Canyon winds can misalign photo-eyes — we use rigid mounting and test with the door at full sun exposure times when possible.',
      'If the app shows the door open but it is closed, limit switches or sensor wiring need professional diagnosis — not another remote battery.',
      'More: <a href="/garage-door-repair/laguna-niguel-ca/">repair</a>, <a href="/garage-door-opener-repair/orange-county/">OC openers</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Premium opener brands', 'Rigid sensor mounts', 'Limit switch diagnosis', 'App re-pairing help', 'Same-day Laguna Niguel'],
    [{ href: '/garage-door-opener-repair/mission-viejo-ca/', label: 'Opener Repair Mission Viejo' }],
  ),

  // ── Orange ──
  repairPage(
    'orange-ca',
    'Orange',
    'Garage door repair in Orange, CA — historic homes, Chapman area rentals, and modern tracts alike.',
    'Orange Garage Door Repair',
    [
      'Orange features some of OC\'s oldest residential stock near Old Towne — tilt-up doors, short headroom, and legacy hardware still appear alongside modern sectional doors in newer developments.',
      'Student rentals around Chapman University need fast turnaround between leases; we document condition and quote clearly for property owners.',
      'Orange Plaza area garages battle root damage to concrete thresholds — we adjust bottom seals and track alignment when slabs shift slightly.',
      'County: <a href="/garage-door-repair/orange-county/">OC repair</a>. Nearby: <a href="/garage-door-repair/santa-ana-ca/">Santa Ana</a>, <a href="/garage-door-repair/anaheim-ca/">Anaheim</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Historic garage expertise', 'Rental turnover service', 'Threshold and seal adjustment', 'Off-track emergencies', 'Same-day Orange CA'],
    [{ href: '/garage-door-repair/santa-ana-ca/', label: 'Garage Door Repair Santa Ana' }],
  ),
  springPage(
    'orange-ca',
    'Orange',
    'Orange CA spring repair — extension and torsion systems replaced with proper safety checks.',
    'Orange Spring Replacement',
    [
      'Older Orange garages may still run extension springs with aging pulleys — we replace the full system when pulleys show wear or asymmetry.',
      'Torsion upgrades on remodeled homes require correct shaft length and cable drum pairing; mismatches cause noisy operation and short spring life.',
      'Never cut corners on spring tension — an imbalanced door is a safety risk to kids and pets passing underneath daily.',
      'Links: <a href="/garage-door-repair/orange-ca/">garage door repair Orange</a>, <a href="/garage-door-spring-repair/orange-county/">Orange County</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">home</a>.',
    ],
    ['Extension spring systems', 'Torsion shaft matching', 'Pulley replacement', 'Safety testing', '7-day availability'],
    [{ href: '/garage-door-spring-repair/santa-ana-ca/', label: 'Spring Repair Santa Ana' }],
  ),
  openerPage(
    'orange-ca',
    'Orange',
    'Orange opener repair for older chain drives and newer smart systems — same-day diagnostics.',
    'Orange Opener Service',
    [
      'Orange\'s mix of housing ages means opener repairs range from vintage chain units to new battery-backup models — we stock parts for common failures on both.',
      'Alley-access garages in central Orange need reliable wall controls; we replace cracked buttons and fix loose terminal connections.',
      'When landlords report "opener works sometimes," we trace intermittent voltage drops and loose rail brackets before recommending replacement.',
      'See <a href="/garage-door-repair/orange-ca/">repair Orange</a>, <a href="/garage-door-opener-repair/orange-county/">OC opener repair</a>. <a href="tel:+19495390009">(949) 539-0009</a> · <a href="/">Garage Guys</a>.',
    ],
    ['Legacy and modern openers', 'Wall control repair', 'Intermittent fault tracing', 'Landlord-friendly quotes', 'Same-day Orange'],
    [{ href: '/garage-door-opener-repair/santa-ana-ca/', label: 'Opener Repair Santa Ana' }],
  ),
];
