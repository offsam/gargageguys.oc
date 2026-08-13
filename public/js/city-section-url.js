(() => {
  const routesEl = document.getElementById('city-section-routes');
  if (!routesEl) return;

  let config;
  try {
    config = JSON.parse(routesEl.textContent);
  } catch {
    return;
  }

  const { routes, initialSection } = config;
  const sections = [
    document.getElementById('home'),
    ...document.querySelectorAll('.city-service-block[id]'),
  ].filter(Boolean);
  if (!sections.length || !routes) return;

  const navOffset = () => {
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10);
    return (Number.isFinite(navH) ? navH : 72) + 24;
  };

  let activeSection = resolveSectionId();
  let observerPaused = false;
  let scrollLockUntil = 0;
  const visible = new Map();

  function resolveSectionId() {
    const hash = location.hash.replace(/^#/, '');
    if (hash && routes[hash]) return hash;
    if (initialSection && routes[initialSection]) return initialSection;
    const path = location.pathname.replace(/\/$/, '');
    for (const route of Object.values(routes)) {
      const routePath = route.path.split('#')[0].replace(/\/$/, '');
      const routeHash = route.path.includes('#') ? route.path.split('#')[1] : '';
      if (path === routePath && (!routeHash || routeHash === hash)) {
        return route.id;
      }
    }
    if (path.includes('/service-areas/')) return 'home';
    if (path.includes('/garage-door-spring-repair/')) return 'spring';
    if (path.includes('/garage-door-opener-repair/')) return 'opener';
    if (path.includes('/garage-door-cable-repair/')) return 'cable';
    if (path.includes('/garage-door-off-track/')) return 'off-track';
    if (path.includes('/garage-door-repair/')) return 'repair';
    return routes.home ? 'home' : 'repair';
  }

  function routePath(sectionId) {
    return routes[sectionId]?.path ?? routes.home?.path ?? routes.repair.path;
  }

  function currentLocationKey() {
    return `${location.pathname}${location.hash}`;
  }

  function applyMeta(sectionId) {
    const route = routes[sectionId];
    if (!route) return;
    if (route.title) document.title = route.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && route.description) desc.setAttribute('content', route.description);
  }

  function setUrl(sectionId, { replace = false, force = false } = {}) {
    const route = routes[sectionId];
    if (!route) return;
    const target = route.path;
    if (!force && sectionId === activeSection && currentLocationKey() === target) return;

    activeSection = sectionId;
    const state = { sectionId };
    if (replace) history.replaceState(state, '', target);
    else history.pushState(state, '', target);
    applyMeta(sectionId);
  }

  function scrollToSection(sectionId, { smooth = false } = {}) {
    const el = sectionId === 'home' ? document.getElementById('home') : document.getElementById(sectionId);
    if (!el) return;
    observerPaused = true;
    scrollLockUntil = Date.now() + (smooth ? 900 : 200);
    window.dispatchEvent(new CustomEvent('city-scroll-lock', { detail: { ms: smooth ? 900 : 200 } }));
    window.scrollTo({ top: el.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
    window.setTimeout(() => {
      observerPaused = false;
    }, smooth ? 900 : 200);
  }

  function pickActiveSection() {
    const homeEl = document.getElementById('home');
    if (homeEl) {
      const homeRect = homeEl.getBoundingClientRect();
      if (homeRect.bottom > window.innerHeight * 0.55 && window.scrollY < homeEl.offsetHeight * 0.45) {
        return 'home';
      }
    } else if (window.scrollY < 120) {
      return routes.home ? 'home' : 'repair';
    }

    let bestId = null;
    let bestRatio = 0;
    for (const [id, ratio] of visible) {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestId = id;
      }
    }
    return bestRatio >= 0.2 ? bestId : activeSection;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (observerPaused || Date.now() < scrollLockUntil) return;

      for (const entry of entries) {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      }

      const next = pickActiveSection();
      if (next && next !== activeSection) setUrl(next);
    },
    {
      root: null,
      rootMargin: `-${navOffset()}px 0px -50% 0px`,
      threshold: [0, 0.15, 0.3, 0.5, 0.75, 1],
    },
  );

  sections.forEach((section) => observer.observe(section));

  document.querySelectorAll('.city-service-link[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
      observerPaused = true;
      scrollLockUntil = Date.now() + 1000;
      window.dispatchEvent(new CustomEvent('city-scroll-lock', { detail: { ms: 1000 } }));
      window.setTimeout(() => {
        observerPaused = false;
      }, 1000);
    });
  });

  window.addEventListener('popstate', (event) => {
    const sectionId = event.state?.sectionId || resolveSectionId();
    activeSection = sectionId;
    scrollToSection(sectionId);
    applyMeta(sectionId);
  });

  const startSection = resolveSectionId();
  activeSection = startSection;
  applyMeta(startSection);
  history.replaceState({ sectionId: startSection }, '', routePath(startSection));

  if (startSection !== 'home') {
    window.requestAnimationFrame(() => {
      scrollToSection(startSection);
    });
  }
})();
