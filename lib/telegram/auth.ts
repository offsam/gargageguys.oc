import type { NextRequest } from "next/server";

/** Fail-closed shared secret for Telegram setWebhook secret_token. */
export function telegramWebhookSecret(): string {
  return (
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

export function isTelegramWebhookAuthorized(request: NextRequest): boolean {
  const expected = telegramWebhookSecret();
  if (!expected) return false;
  const header = request.headers.get("x-telegram-bot-api-secret-token") || "";
  return header === expected;
}

/** Chats allowed to create Champion Sheet rows via the bot. */
export function telegramChampionAllowedChatIds(): Set<string> {
  const ids = new Set<string>();
  const office = process.env.TELEGRAM_CHAT_ID?.trim();
  if (office) ids.add(office);
  const extra = process.env.TELEGRAM_ALLOWED_CHAT_IDS?.trim() || "";
  for (const part of extra.split(/[,;\s]+/)) {
    const id = part.trim();
    if (id) ids.add(id);
  }
  return ids;
}

export function isTelegramChampionChatAllowed(chatId: string | number): boolean {
  const allowed = telegramChampionAllowedChatIds();
  if (allowed.size === 0) return false;
  return allowed.has(String(chatId));
}
