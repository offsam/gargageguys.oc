import { FOOTER_DISCLAIMER, BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_E164, BUSINESS_LOCATION_DISPLAY, BUSINESS_NAME } from './seo-business.mjs';

const FAB_PHONE_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

/** Full site nav — matches homepage / root service pages. */
export function siteNav({ logoAlt = 'Garage Guys — home', active = '' } = {}) {
  const cur = (key) => (active === key ? ' aria-current="page"' : '');
  return `<nav>
  <ul class="nav-links">
    <li><a href="/"${cur('home')}>Home</a></li>
    <li><a href="/garage-door-repair/"${cur('repair')}>Garage Door Repair</a></li>
    <li><a href="/garage-door-spring-repair/"${cur('spring')}>Spring Repair</a></li>
    <li><a href="/garage-door-opener-repair/"${cur('opener')}>Opener Repair</a></li>
    <li><a href="/deals/"${cur('deals')}>Deals</a></li>
    <li><a href="/service-areas/"${cur('areas')}>Service Areas</a></li>
  </ul>
  <div class="nav-brand">
    <a href="/" class="nav-logo">
      <img src="/Pictures/Logo.png" alt="${logoAlt}">
    </a>
    <a href="/login" class="nav-staff" aria-label="Staff"></a>
  </div>
</nav>`;
}

export function navActiveFromPath(path) {
  if (path.includes('spring-repair')) return 'spring';
  if (path.includes('opener-repair')) return 'opener';
  if (path.startsWith('deals')) return 'deals';
  if (path.startsWith('service-areas')) return 'areas';
  return 'repair';
}

export function heroActionsBlock() {
  return `    <div class="service-hero__actions">
      <a href="tel:${BUSINESS_PHONE_E164}" class="btn-call-now">Call Now</a>
      <a href="tel:${BUSINESS_PHONE_E164}" class="service-hero__phone">${BUSINESS_PHONE_DISPLAY}</a>
      <button type="button" class="btn-callback-inline" data-open-callback>
        Request Callback
        <span>Free Estimate</span>
      </button>
    </div>`;
}

export function ctaBlock({ title, text }) {
  return `<section class="service-cta">
  <h2>${title}</h2>
  <p>${text}</p>
  <a href="tel:${BUSINESS_PHONE_E164}" class="btn-call-now btn-call-now--cta">Call Now</a>
  <a href="tel:${BUSINESS_PHONE_E164}" class="service-cta__phone">${BUSINESS_PHONE_DISPLAY}</a>
</section>`;
}

export function pageTail(logoAlt) {
  return `  <div class="fab-bar" id="fab-bar">
  <a href="tel:${BUSINESS_PHONE_E164}" class="fab-call" aria-label="Call ${BUSINESS_PHONE_DISPLAY}">
    <span class="fab-call-icon" aria-hidden="true">${FAB_PHONE_ICON}</span>
    <span class="fab-call-text">
      <span class="fab-call-label">Tap to call</span>
      <span class="fab-call-number">${BUSINESS_PHONE_DISPLAY}</span>
    </span>
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
    <img src="/Pictures/Logo.png" alt="${logoAlt}">
  </a>
  <div class="footer-copy">© 2026 ${BUSINESS_NAME} · ${BUSINESS_LOCATION_DISPLAY} · <a href="tel:${BUSINESS_PHONE_E164}">${BUSINESS_PHONE_DISPLAY}</a></div>
  <p class="footer-disclaimer">${FOOTER_DISCLAIMER}</p>
</footer>

<script src="/js/callback-form.js"></script>
<script src="/js/thumbtack-reviews.js" defer></script>
<link rel="stylesheet" href="/css/ai-chat.css">
<script src="/js/ai-chat.js" defer></script>
<script>window.addEventListener('load',function(){document.querySelector('.site-van-bg')?.classList.add('is-loaded')});</script>
</body>
</html>`;
}
