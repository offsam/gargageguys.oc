const ALLOWED_ORIGINS = new Set([
  "https://garageguysoc.com",
  "https://www.garageguysoc.com",
  "https://pullgaragedoor.com",
  "https://www.pullgaragedoor.com",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
]);

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin) || origin.endsWith(".vercel.app")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const baseUrl = String(process.env.AI_COUNCIL_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const secret = process.env.GARAGE_GUYS_LEAD_WEBHOOK_SECRET;

  if (!baseUrl || !secret) {
    return res.status(503).json({
      error: "AI Council chat is not configured (AI_COUNCIL_BASE_URL / GARAGE_GUYS_LEAD_WEBHOOK_SECRET)",
    });
  }

  try {
    const upstream = await fetch(`${baseUrl}/api/public/garage-guys/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(req.body || {}),
    });

    const payload = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(payload);
  } catch (err) {
    console.error("[ai-chat] proxy failed:", err);
    return res.status(502).json({ error: "Could not reach AI Council chat" });
  }
};
