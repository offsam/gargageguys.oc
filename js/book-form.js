(function () {
  const CALLBACK_API_URL = '/api/callback';
  const form = document.getElementById('book-form');
  const formWrap = document.getElementById('book-form-wrap');
  const success = document.getElementById('book-success');
  const successPhone = success && success.querySelector('.book-success__phone');
  const errorEl = document.getElementById('book-error');
  const submitBtn = form && form.querySelector('.book-submit');
  const dateWrap = document.getElementById('book-date-wrap');
  const dateInput = document.getElementById('book-preferred-date');

  if (!form) return;

  function todayLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  if (dateInput) {
    dateInput.min = todayLocalISO();
  }

  function syncWhenUI() {
    const preferred = form.querySelector('input[name="when"]:checked')?.value === 'preferred';
    if (dateWrap) dateWrap.hidden = !preferred;
    if (dateInput) {
      dateInput.required = preferred;
      if (!preferred) dateInput.value = '';
    }
  }

  form.querySelectorAll('input[name="when"]').forEach((radio) => {
    radio.addEventListener('change', syncWhenUI);
  });
  syncWhenUI();

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function showSuccess(phone) {
    if (successPhone) successPhone.textContent = phone;
    if (formWrap) formWrap.hidden = true;
    if (success) success.hidden = false;
  }

  function buildMessage(data) {
    const lines = [
      `BOOKING REQUEST — ${data.service}`,
      `Timing: ${data.timing}`,
      `Time window: ${data.timeWindow}`,
    ];
    if (data.notes) lines.push(`Notes: ${data.notes}`);
    return lines.join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const when = form.querySelector('input[name="when"]:checked')?.value || 'asap';
    const preferredDate = form.preferredDate ? form.preferredDate.value.trim() : '';
    const service = form.service.value.trim();
    const timeWindow = form.timeWindow.value.trim() || 'Anytime';
    const notes = form.message.value.trim();

    if (!service) {
      showError('Please select a service.');
      return;
    }

    if (when === 'preferred' && !preferredDate) {
      showError('Please pick a preferred day, or choose ASAP.');
      return;
    }

    const timing = when === 'asap'
      ? 'ASAP / Same day'
      : `Preferred day: ${preferredDate}`;

    const payload = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      zip: form.zip.value.trim(),
      message: buildMessage({ service, timing, timeWindow, notes }),
      leadType: 'booking_request',
      dealId: 'google-book',
      dealTitle: service,
      dealPrice: '',
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
      submitBtn.textContent = 'Request Visit';
    }
  });
})();
