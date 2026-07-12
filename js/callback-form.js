(function () {
  const CALLBACK_API_URL = '/api/callback';

  const modal = document.getElementById('callback-modal');
  const form = document.getElementById('callback-form');
  const formWrap = document.getElementById('callback-form-wrap');
  const success = document.getElementById('callback-success');
  const successPhone = success && success.querySelector('.callback-success-phone');
  const errorEl = document.getElementById('callback-error');
  const submitBtn = form && form.querySelector('.callback-submit');
  if (!modal || !form) return;

  function openModal() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    form.reset();
    formWrap.hidden = false;
    success.hidden = true;
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showSuccess(phone) {
    if (successPhone) successPhone.textContent = phone;
    formWrap.hidden = true;
    success.hidden = false;
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  document.querySelectorAll('[data-open-callback]').forEach(btn => {
    btn.addEventListener('click', openModal);
  });

  document.querySelectorAll('[data-close-callback]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      zip: form.zip.value.trim(),
      message: form.message.value.trim() || 'Callback requested from website',
      _gotcha: form._gotcha.value.trim(),
    };

    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    try {
      const res = await fetch(CALLBACK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccess(payload.phone);
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.error || 'Could not send your request. Please call (949) 539-0009.');
      }
    } catch {
      showError('Connection error. Please call (949) 539-0009.');
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send My Request';
    }
  });
})();

(function () {
  const fab = document.getElementById('fab-bar');
  const modal = document.getElementById('callback-modal');
  const hero = document.querySelector('.service-hero, .hero--city, .hero');
  const isCityUnified = document.body.classList.contains('page-city-unified');
  if (!fab) return;
  if (!hero && !isCityUnified) return;

  function updateFab() {
    const modalOpen = modal && modal.classList.contains('is-open');
    let show = true;

    if (hero) {
      show = hero.getBoundingClientRect().bottom <= 0;
    } else if (isCityUnified) {
      const stats = document.querySelector('.stats-bar');
      show = stats ? stats.getBoundingClientRect().bottom <= window.innerHeight * 0.35 : true;
    }

    fab.classList.toggle('is-visible', show && !modalOpen);
  }

  window.addEventListener('scroll', updateFab, { passive: true });
  window.addEventListener('resize', updateFab);
  document.querySelectorAll('[data-open-callback], [data-close-callback]').forEach((el) => {
    el.addEventListener('click', () => setTimeout(updateFab, 50));
  });
  updateFab();
})();
