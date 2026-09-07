import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { telegramWebhookSecret } from "@/lib/telegram/auth";

function siteBase() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "https://garageguysoc.com"
  ).replace(/\/$/, "");
}

/**
 * Register Telegram webhook for Champion → Sheet ingest.
 * Auth: Authorization: Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = telegramWebhookSecret();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 503 });
  }
  if (!secret) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  const url = `${siteBase()}/api/webhooks/telegram`;
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message", "edited_message", "channel_post"],
      drop_pending_updates: false,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: unknown;
  };

  if (!res.ok || !data.ok) {
    return NextResponse.json(
      {
        error: data.description || "setWebhook failed",
        telegram: data,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    url,
    result: data.result,
    hint: "Allowed chats: TELEGRAM_CHAT_ID + TELEGRAM_ALLOWED_CHAT_IDS",
  });
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 503 });
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, webhook: data });
}
