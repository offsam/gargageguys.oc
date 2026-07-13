(function () {
  const STORAGE_KEY = 'gg-home-intro-seen';
  const overlay = document.getElementById('home-intro');
  if (!overlay) return;

  const video = overlay.querySelector('.home-intro__video');
  const skipBtn = overlay.querySelector('[data-skip-intro]');

  function dismiss() {
    if (overlay.classList.contains('is-dismissed')) return;
    sessionStorage.setItem(STORAGE_KEY, '1');
    overlay.classList.add('is-dismissed');
    document.documentElement.classList.remove('home-intro-active');
    document.body.classList.remove('home-intro-active');
    if (video) {
      video.pause();
    }
    window.setTimeout(() => overlay.remove(), 480);
  }

  if (sessionStorage.getItem(STORAGE_KEY)) {
    overlay.remove();
    return;
  }

  document.documentElement.classList.add('home-intro-active');
  document.body.classList.add('home-intro-active');

  if (skipBtn) skipBtn.addEventListener('click', dismiss);
  if (video) {
    video.addEventListener('ended', dismiss);
    video.addEventListener('click', dismiss);
  }

  function tryPlay() {
    if (!video) return;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        /* Autoplay blocked — user can tap Skip or video */
      });
    }
  }

  if (document.readyState === 'complete') {
    tryPlay();
  } else {
    window.addEventListener('load', tryPlay);
  }
})();
