(function () {
  const CALLBACK_API_URL = '/api/callback';

  const modal = document.getElementById('callback-modal');
  const form = document.getElementById('callback-form');
  const formWrap = document.getElementById('callback-form-wrap');
  const success = document.getElementById('callback-success');
  const successPhone = success && success.querySelector('.callback-success-phone');
  const successTitle = success && success.querySelector('.callback-success-title');
  const successBody = success && success.querySelector('.callback-success-body');
  const errorEl = document.getElementById('callback-error');
  const submitBtn = form && form.querySelector('.callback-submit');
  const modalTitle = document.getElementById('callback-title');
  const modalIntro = document.getElementById('callback-intro');
  const dealSummary = document.getElementById('deal-order-summary');
  const dealSummaryTitle = document.getElementById('deal-order-summary-title');
  const dealSummaryPrice = document.getElementById('deal-order-summary-price');
  const messageField = form && form.querySelector('[name="message"]');
  const messageLabel = messageField && messageField.closest('label');

  if (!modal || !form) return;

  let activeDeal = null;

  const defaultCopy = {
    title: modal.dataset.defaultTitle || "We'll Call You Back",
    intro: modal.dataset.defaultIntro || 'Leave your name, number and ZIP — Sam usually responds within the hour.',
    submit: modal.dataset.defaultSubmit || 'Send My Request',
    messagePlaceholder: modal.dataset.defaultMessagePlaceholder || "Garage door won't open, need repair...",
    successTitle: modal.dataset.defaultSuccessTitle || "You're on the list!",
    successBody: modal.dataset.defaultSuccessBody || 'Usually within the hour — 7 days a week.',
  };

  const dealCopy = {
    title: modal.dataset.dealTitle || 'Order Opener Installation',
    intro: modal.dataset.dealIntro || 'Submit your install order — we will call to confirm your deal price and schedule.',
    submit: modal.dataset.dealSubmit || 'Submit Installation Order',
    messagePlaceholder: modal.dataset.dealMessagePlaceholder || 'Garage size, preferred day, or gate code (optional)',
    successTitle: modal.dataset.dealSuccessTitle || 'Installation order received!',
    successBody: modal.dataset.dealSuccessBody || 'We will call to confirm your opener deal and book install.',
  };

  function applyModalCopy(mode) {
    const copy = mode === 'deal' ? dealCopy : defaultCopy;
    if (modalTitle) modalTitle.textContent = copy.title;
    if (modalIntro) modalIntro.textContent = copy.intro;
    if (submitBtn) submitBtn.textContent = copy.submit;
    if (messageField) messageField.placeholder = copy.messagePlaceholder;
    if (successTitle) successTitle.textContent = copy.successTitle;
    if (successBody) successBody.textContent = copy.successBody;
  }

  function formatDealPrice(deal) {
    const prefix = deal.pricePrefix ? `${deal.pricePrefix} ` : '';
    return `${prefix}$${deal.price}`;
  }

  function setDealSummary(deal) {
    if (!dealSummary) return;
    if (!deal) {
      dealSummary.hidden = true;
      return;
    }
    dealSummary.hidden = false;
    if (dealSummaryTitle) dealSummaryTitle.textContent = deal.title;
    if (dealSummaryPrice) {
      const includes = deal.includes || 'parts + installation included';
      dealSummaryPrice.textContent = `Deal price: ${formatDealPrice(deal)} · ${includes}`;
    }
  }

  function openModal(mode, deal) {
    activeDeal = mode === 'deal' ? deal : null;
    applyModalCopy(mode);
    setDealSummary(activeDeal);

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
    activeDeal = null;
    setDealSummary(null);
    applyModalCopy('callback');
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

  function getOrderLabel(deal) {
    const labels = {
      opener_install_order: 'OPENER INSTALL ORDER',
      maintenance_order: 'MAINTENANCE ORDER',
      roller_replacement_order: 'ROLLER REPLACEMENT ORDER',
      tuneup_order: 'FULL TUNE UP ORDER',
    };
    return labels[deal.leadType] || 'SERVICE ORDER';
  }

  function buildDealMessage(deal, notes) {
    const orderLabel = getOrderLabel(deal);
    const priceNote = deal.includes || 'service included';
    const lines = [
      `${orderLabel} — ${deal.title}`,
      `Deal price: ${formatDealPrice(deal)} (${priceNote})`,
      `Deal ID: ${deal.id}`,
    ];
    const trimmed = String(notes || '').trim();
    if (trimmed) lines.push(`Notes: ${trimmed}`);
    return lines.join('\n');
  }

  document.querySelectorAll('[data-open-callback]').forEach((btn) => {
    btn.addEventListener('click', () => openModal('callback'));
  });

  document.querySelectorAll('[data-open-deal-order]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openModal('deal', {
        id: btn.dataset.dealId || 'deal',
        title: btn.dataset.dealTitle || 'Garage Door Deal',
        price: btn.dataset.dealPrice || '',
        pricePrefix: btn.dataset.dealPricePrefix || '',
        includes: btn.dataset.dealIncludes || '',
        leadType: btn.dataset.dealLeadType || 'opener_install_order',
      });
    });
  });

  document.querySelectorAll('[data-close-callback]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const notes = messageField ? messageField.value.trim() : '';
    const payload = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      zip: form.zip.value.trim(),
      message: activeDeal
        ? buildDealMessage(activeDeal, notes)
        : notes || 'Callback requested from website',
      _gotcha: form._gotcha.value.trim(),
    };

    if (activeDeal) {
      payload.leadType = activeDeal.leadType || 'opener_install_order';
      payload.dealId = activeDeal.id;
      payload.dealTitle = activeDeal.title;
      payload.dealPrice = activeDeal.pricePrefix
        ? `${activeDeal.pricePrefix} $${activeDeal.price}`.trim()
        : activeDeal.price;
    }

    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }

    const defaultSubmitLabel = activeDeal ? dealCopy.submit : defaultCopy.submit;
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
      submitBtn.textContent = defaultSubmitLabel;
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
  document.querySelectorAll('[data-open-callback], [data-open-deal-order], [data-close-callback]').forEach((el) => {
    el.addEventListener('click', () => setTimeout(updateFab, 50));
  });
  updateFab();
})();
