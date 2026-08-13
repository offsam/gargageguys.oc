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
    if (dateInput && !preferred) dateInput.value = '';
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

  /** All optional booking details go into message/notes for AI Council + Telegram. */
  function buildNotesMessage(data) {
    const lines = ['BOOKING REQUEST (Google Local /book/)'];
    if (data.service) lines.push(`Service: ${data.service}`);
    if (data.timing) lines.push(`Timing: ${data.timing}`);
    if (data.timeWindow) lines.push(`Time window: ${data.timeWindow}`);
    if (data.notes) lines.push(`Customer notes: ${data.notes}`);
    if (lines.length === 1) lines.push('No extra details provided');
    return lines.join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const zip = form.zip.value.trim();

    if (!name || !phone || !zip) {
      showError('Name, phone, and ZIP are required.');
      return;
    }

    const when = form.querySelector('input[name="when"]:checked')?.value || 'asap';
    const preferredDate = form.preferredDate ? form.preferredDate.value.trim() : '';
    const service = form.service.value.trim();
    const timeWindow = form.timeWindow.value.trim();
    const notes = form.message.value.trim();

    let timing = '';
    if (when === 'preferred') {
      timing = preferredDate ? `Preferred day: ${preferredDate}` : 'Preferred day (not specified)';
    } else if (when === 'asap') {
      timing = 'ASAP / Same day';
    }

    // Everything except name/phone/zip lives in message for AI Council notes
    const payload = {
      name,
      phone,
      zip,
      message: buildNotesMessage({ service, timing, timeWindow, notes }),
      leadType: 'booking_request',
      preferredDate: when === 'preferred' ? preferredDate : '',
      timeWindow,
      dealTitle: service || 'Booking request',
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
