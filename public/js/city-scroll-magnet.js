(() => {
  if (!document.body.classList.contains('page-city-unified')) return;

  const THRESHOLD = 0.88;
  const screens = () => [
    ...document.querySelectorAll('.city-hero-stack, .city-service-block[id], .service-cta'),
  ];

  let locked = false;
  let lockUntil = 0;
  let scrollTimer = null;

  function pause(ms = 800) {
    locked = true;
    lockUntil = Date.now() + ms;
    window.setTimeout(() => {
      locked = false;
    }, ms);
  }

  function visibleRatio(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    return Math.max(0, visible) / vh;
  }

  function isAligned(el) {
    return Math.abs(el.getBoundingClientRect().top) < 8;
  }

  function scrollToScreen(el) {
    window.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  }

  function magnetSnap() {
    if (locked || Date.now() < lockUntil) return;

    let target = null;
    let bestRatio = 0;

    for (const el of screens()) {
      const ratio = visibleRatio(el);
      if (ratio >= THRESHOLD && ratio > bestRatio) {
        bestRatio = ratio;
        target = el;
      }
    }

    if (!target || isAligned(target)) return;

    pause(800);
    scrollToScreen(target);
  }

  window.addEventListener('scroll', () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(magnetSnap, 140);
  }, { passive: true });

  document.querySelectorAll('.city-service-link[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href')?.slice(1);
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      event.preventDefault();
      pause(900);
      scrollToScreen(el);
    });
  });

  window.addEventListener('city-scroll-lock', (event) => {
    pause(event.detail?.ms ?? 800);
  });
})();
