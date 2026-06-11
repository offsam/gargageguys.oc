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

  if (!hasTelegram && !hasTwilio) {
    return res.status(503).json({ error: 'Notifications not configured' });
  }

  const { name, phone, zip, message, _gotcha } = req.body || {};

  if (_gotcha) {
    return res.status(200).json({ ok: true });
  }

  const safeName = clean(name, 80);
  const safePhone = clean(phone, 30);
  const safeZip = clean(zip, 10);
  const safeMessage = clean(message, 500) || 'Callback requested from website';

  if (!safeName || !safePhone || !safeZip) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const plainText = [
    'Garage Guys — callback request',
    `Name: ${safeName}`,
    `Phone: ${safePhone}`,
    `ZIP: ${safeZip}`,
    `Job: ${safeMessage}`,
  ].join('\n');

  const telegramText = [
    '<b>Garage Guys — new callback</b>',
    '',
    `<b>Name:</b> ${escapeHtml(safeName)}`,
    `<b>Phone:</b> ${escapeHtml(safePhone)}`,
    `<b>ZIP:</b> ${escapeHtml(safeZip)}`,
    `<b>Job:</b> ${escapeHtml(safeMessage)}`,
  ].join('\n');

  if (hasTelegram) {
    const telegramOk = await sendTelegram(telegramText);
    if (!telegramOk) {
      return res.status(502).json({ error: 'Failed to send notification' });
    }
  }

  if (hasTwilio) {
    await sendTwilioSms(plainText);
  }

  return res.status(200).json({ ok: true });
};
