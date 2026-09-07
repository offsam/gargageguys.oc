import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { escapeHtml, sendTelegram } from "@/lib/notify/channels";
import {
  isTelegramChampionChatAllowed,
  isTelegramWebhookAuthorized,
  telegramWebhookSecret,
} from "@/lib/telegram/auth";
import { ingestChampionTelegramJob } from "@/lib/telegram/champion-ingest";
import { championTelegramHelpText } from "@/lib/telegram/champion-parse";

/**
 * Telegram Bot API webhook — Champion job → Sheet (Partner / Champion).
 * Register with POST /api/webhooks/telegram/setup (CRON_SECRET).
 * Fail-closed: missing TELEGRAM_WEBHOOK_SECRET → 503.
 */

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: "/api/webhooks/telegram",
    hint: "POST Telegram updates here after setWebhook",
  });
}

type TelegramChat = { id: number; type?: string };
type TelegramUser = { id: number; username?: string; first_name?: string };
type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
};

function messageFromUpdate(body: TelegramUpdate): TelegramMessage | null {
  return body.message || body.edited_message || body.channel_post || null;
}

async function reply(chatId: number | string, text: string) {
  await sendTelegram(text, { chatId: String(chatId) });
}

export async function POST(request: NextRequest) {
  if (!telegramWebhookSecret()) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (!isTelegramWebhookAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TelegramUpdate;
  try {
    body = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const msg = messageFromUpdate(body);
  if (!msg?.chat?.id) {
    return NextResponse.json({ ok: true, ignored: "no message" });
  }

  const chatId = msg.chat.id;
  const text = String(msg.text || msg.caption || "").trim();
  if (!text) {
    return NextResponse.json({ ok: true, ignored: "empty" });
  }

  if (!isTelegramChampionChatAllowed(chatId)) {
    if (/^\/start\b/i.test(text) || /^\/help\b/i.test(text)) {
      await reply(
        chatId,
        "This chat is not authorized for Champion → Sheet. Add its chat id to TELEGRAM_ALLOWED_CHAT_IDS (or use the office TELEGRAM_CHAT_ID chat).",
      );
    }
    return NextResponse.json({ ok: true, ignored: "chat not allowed" });
  }

  if (/^\/start\b/i.test(text) || /^\/help\b/i.test(text)) {
    await reply(chatId, escapeHtml(championTelegramHelpText()));
    return NextResponse.json({ ok: true, help: true });
  }

  // Ignore other slash commands.
  if (text.startsWith("/")) {
    return NextResponse.json({ ok: true, ignored: "command" });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await reply(chatId, "Sheet ingest is temporarily unavailable (database).");
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const result = await ingestChampionTelegramJob({
      text,
      chatId: String(chatId),
      messageId: msg.message_id,
      fromUsername: msg.from?.username || msg.from?.first_name || "",
    });

    if (!result.ok) {
      await reply(
        chatId,
        [
          `<b>Could not add Champion job</b>`,
          escapeHtml(result.error),
          "",
          escapeHtml(championTelegramHelpText()),
        ].join("\n"),
      );
      return NextResponse.json({ ok: false, error: result.error });
    }

    const lines = [
      result.duplicate
        ? `<b>Already on Sheet</b> (same Telegram message)`
        : `<b>Champion job added to Sheet</b>`,
      "",
      `<b>Job #:</b> ${escapeHtml(result.jobNumber || "—")}`,
      `<b>Client:</b> ${escapeHtml(result.parsed.clientName)}`,
      `<b>Address:</b> ${escapeHtml(result.parsed.clientAddress)}`,
      `<b>Time:</b> ${escapeHtml(result.parsed.timeRaw || result.parsed.sheetTime || "—")}`,
      `<b>Partner:</b> ${escapeHtml(result.partnerName)}`,
    ];
    if (result.parsed.description) {
      lines.push(`<b>Notes:</b> ${escapeHtml(result.parsed.description)}`);
    }
    await reply(chatId, lines.join("\n"));

    return NextResponse.json({
      ok: true,
      leadId: result.leadId,
      jobNumber: result.jobNumber,
      duplicate: Boolean(result.duplicate),
    });
  } catch (err) {
    console.error("[telegram-webhook]", err);
    await reply(
      chatId,
      `Error saving job: ${escapeHtml(err instanceof Error ? err.message : "unknown")}`,
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 500 },
    );
  }
}
