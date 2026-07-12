const ALLOWED_ORIGINS = new Set([
  'https://garageguysoc.com',
  'https://www.garageguysoc.com',
  'https://pullgaragedoor.com',
  'https://www.pullgaragedoor.com',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
]);

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function clean(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegram(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return false;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    console.error(await res.text());
    return false;
  }

  return true;
}

async function sendTwilioSms(body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const to = process.env.NOTIFY_PHONE_NUMBER || '+19495390009';
  if (!sid || !token || !from) return false;

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!twilioRes.ok) {
    console.error(await twilioRes.text());
    return false;
  }

  return true;
}

async function sendAiCouncil(lead) {
  const baseUrl = String(process.env.AI_COUNCIL_BASE_URL || '').trim().replace(/\/$/, '');
  const secret = process.env.GARAGE_GUYS_LEAD_WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    console.warn('AI Council lead webhook skipped: AI_COUNCIL_BASE_URL or GARAGE_GUYS_LEAD_WEBHOOK_SECRET missing');
    return { attempted: false, ok: false };
  }

  const res = await fetch(`${baseUrl}/api/public/garage-guys/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(lead),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('AI Council lead webhook failed:', res.status, detail);
    return { attempted: true, ok: false, status: res.status, detail };
  }

  return { attempted: true, ok: true };
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasTelegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
  const hasAiCouncil = Boolean(
    String(process.env.AI_COUNCIL_BASE_URL || '').trim() &&
    process.env.GARAGE_GUYS_LEAD_WEBHOOK_SECRET
  );

  if (!hasTelegram && !hasTwilio && !hasAiCouncil) {
    return res.status(503).json({ error: 'Notifications not configured' });
  }

  const { name, phone, zip, message, _gotcha, leadType, dealId, dealTitle, dealPrice } = req.body || {};

  if (_gotcha) {
    return res.status(200).json({ ok: true });
  }

  const safeName = clean(name, 80);
  const safePhone = clean(phone, 30);
  const safeZip = clean(zip, 10);
  const safeMessage = clean(message, 500) || 'Callback requested from website';
  const safeLeadType = clean(leadType, 40) || 'callback';
  const safeDealId = clean(dealId, 40);
  const safeDealTitle = clean(dealTitle, 120);
  const safeDealPrice = clean(dealPrice, 12);
  const isOpenerOrder = safeLeadType === 'opener_install_order';

  if (!safeName || !safePhone || !safeZip) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const leadPayload = {
    name: safeName,
    phone: safePhone,
    zip: safeZip,
    message: safeMessage,
    source: 'garageguysoc.com',
    leadType: safeLeadType,
  };

  if (isOpenerOrder) {
    leadPayload.dealId = safeDealId;
    leadPayload.dealTitle = safeDealTitle;
    leadPayload.dealPrice = safeDealPrice;
  }

  const headline = isOpenerOrder ? 'Garage Guys — opener install order' : 'Garage Guys — callback request';

  const plainText = [
    headline,
    ...(isOpenerOrder && safeDealTitle ? [`Package: ${safeDealTitle}`] : []),
    ...(isOpenerOrder && safeDealPrice ? [`Deal price: $${safeDealPrice}`] : []),
    ...(isOpenerOrder && safeDealId ? [`Deal ID: ${safeDealId}`] : []),
    `Name: ${safeName}`,
    `Phone: ${safePhone}`,
    `ZIP: ${safeZip}`,
    `Details: ${safeMessage}`,
  ].join('\n');

  const telegramText = [
    `<b>${isOpenerOrder ? 'Garage Guys — opener install order' : 'Garage Guys — new callback'}</b>`,
    '',
    ...(isOpenerOrder && safeDealTitle ? [`<b>Package:</b> ${escapeHtml(safeDealTitle)}`] : []),
    ...(isOpenerOrder && safeDealPrice ? [`<b>Deal price:</b> $${escapeHtml(safeDealPrice)}`] : []),
    ...(isOpenerOrder && safeDealId ? [`<b>Deal ID:</b> ${escapeHtml(safeDealId)}`] : []),
    `<b>Name:</b> ${escapeHtml(safeName)}`,
    `<b>Phone:</b> ${escapeHtml(safePhone)}`,
    `<b>ZIP:</b> ${escapeHtml(safeZip)}`,
    `<b>Details:</b> ${escapeHtml(safeMessage)}`,
  ].join('\n');

  let notified = false;

  if (hasTelegram) {
    const telegramOk = await sendTelegram(telegramText);
    if (!telegramOk) {
      return res.status(502).json({ error: 'Failed to send notification' });
    }
    notified = true;
  }

  if (hasTwilio) {
    const twilioOk = await sendTwilioSms(plainText);
    if (twilioOk) notified = true;
  }

  const aiCouncil = await sendAiCouncil(leadPayload);

  if (hasAiCouncil) {
    if (!aiCouncil.ok) {
      console.error('AI Council ingest failed for callback submit', aiCouncil);
      return res.status(502).json({
        error: 'Could not register your request. Please call (949) 539-0009.',
        aiCouncil: false,
      });
    }

    return res.status(200).json({ ok: true, aiCouncil: true });
  }

  if (!notified) {
    return res.status(503).json({ error: 'Notifications not configured' });
  }

  return res.status(200).json({ ok: true, aiCouncil: false });
};
