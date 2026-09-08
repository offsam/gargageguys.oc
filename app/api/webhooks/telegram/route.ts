import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { escapeHtml, sendTelegram } from "@/lib/notify/channels";
import {
  isTelegramChampionChatAllowed,
  isTelegramWebhookAuthorized,
  telegramWebhookSecret,
} from "@/lib/telegram/auth";
import { ingestChampionTelegramJobs } from "@/lib/telegram/champion-ingest";
import { championTelegramHelpText } from "@/lib/telegram/champion-parse";
import { looksLikeStockOrderText, stockOrderHelpText } from "@/lib/telegram/stock-order-parse";
import {
  dryRunStockOrderFromTelegramPhoto,
  dryRunStockOrderFromText,
  formatStockOrderDryRunReply,
} from "@/lib/telegram/stock-order-pipe";

/**
 * Telegram Bot API webhook — Champion job → Sheet + Stock order photo dry-run.
 * Register with POST /api/webhooks/telegram/setup (CRON_SECRET).
 * Fail-closed: missing TELEGRAM_WEBHOOK_SECRET → 503.
 */

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: "/api/webhooks/telegram",
    hint: "POST Telegram updates here after setWebhook",
    modes: ["champion-sheet", "stock-order-dry-run"],
  });
}

type TelegramChat = { id: number; type?: string };
type TelegramUser = { id: number; username?: string; first_name?: string };
type TelegramPhotoSize = {
  file_id: string;
  file_unique_id?: string;
  width?: number;
  height?: number;
  file_size?: number;
};
type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
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

function largestPhotoFileId(photos: TelegramPhotoSize[] | undefined): string | null {
  if (!photos?.length) return null;
  const sorted = [...photos].sort(
    (a, b) => (b.file_size || b.width || 0) - (a.file_size || a.width || 0),
  );
  return sorted[0]?.file_id || null;
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
  const photoFileId = largestPhotoFileId(msg.photo);

  if (!text && !photoFileId) {
    return NextResponse.json({ ok: true, ignored: "empty" });
  }

  if (!isTelegramChampionChatAllowed(chatId)) {
    if (/^\/start\b/i.test(text) || /^\/help\b/i.test(text)) {
      await reply(
        chatId,
        `This chat is not authorized.\n\nYour chat id: <code>${escapeHtml(String(chatId))}</code>\nAdd it to TELEGRAM_ALLOWED_CHAT_IDS.`,
      );
    }
    return NextResponse.json({ ok: true, ignored: "chat not allowed" });
  }

  if (/^\/start\b/i.test(text) || /^\/help\b/i.test(text)) {
    await reply(
      chatId,
      [
        escapeHtml(championTelegramHelpText()),
        "",
        escapeHtml(stockOrderHelpText()),
      ].join("\n"),
    );
    return NextResponse.json({ ok: true, help: true });
  }

  if (text.startsWith("/") && !photoFileId) {
    return NextResponse.json({ ok: true, ignored: "command" });
  }

  // --- Stock order dry-run (photo or Order: text) ---
  const wantStock =
    Boolean(photoFileId) || looksLikeStockOrderText(text);
  if (wantStock) {
    try {
      const result = photoFileId
        ? await dryRunStockOrderFromTelegramPhoto({
            fileId: photoFileId,
            caption: text,
          })
        : await dryRunStockOrderFromText(text);

      await reply(chatId, formatStockOrderDryRunReply(result));
      return NextResponse.json({
        ok: result.ok,
        mode: "stock-order-dry-run",
        applied: false,
        source: result.source,
        ocrProvider: result.ocrProvider || null,
        lineCount: result.matched.length,
        error: result.error || null,
      });
    } catch (err) {
      console.error("[telegram-webhook] stock-order", err);
      await reply(
        chatId,
        `Stock order dry-run failed: ${escapeHtml(err instanceof Error ? err.message : "unknown")}`,
      );
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Stock order failed" },
        { status: 500 },
      );
    }
  }

  if (!text) {
    return NextResponse.json({ ok: true, ignored: "empty text" });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await reply(chatId, "Sheet ingest is temporarily unavailable (database).");
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const results = await ingestChampionTelegramJobs({
      text,
      chatId: String(chatId),
      messageId: msg.message_id,
      fromUsername: msg.from?.username || msg.from?.first_name || "",
    });

    const okResults = results.filter((r) => r.ok);
    const failResults = results.filter((r) => !r.ok);

    if (okResults.length === 0) {
      const err = failResults[0] && !failResults[0].ok ? failResults[0].error : "Parse failed";
      await reply(
        chatId,
        [
          `<b>Could not add Champion job</b>`,
          escapeHtml(err),
          "",
          escapeHtml(championTelegramHelpText()),
        ].join("\n"),
      );
      return NextResponse.json({ ok: false, error: err });
    }

    const lines: string[] = [
      okResults.length === 1
        ? okResults[0]!.ok && okResults[0].duplicate
          ? `<b>Already on Sheet</b>`
          : `<b>Champion job → Sheet (Sam)</b>`
        : `<b>${okResults.length} Champion jobs → Sheet (Sam)</b>`,
      "",
    ];

    for (const result of results) {
      if (!result.ok) {
        lines.push(`• <b>Failed:</b> ${escapeHtml(result.error)}`);
        continue;
      }
      const timeBit = result.parsed.timeAuto
        ? `${result.windowLabel} (auto)`
        : result.windowLabel || result.parsed.timeRaw || result.sheetTime;
      lines.push(
        `• <b>${escapeHtml(result.jobNumber || "—")}</b> ${escapeHtml(result.parsed.clientName)} — ${escapeHtml(timeBit)}`,
      );
      lines.push(`  ${escapeHtml(result.parsed.clientAddress)}`);
    }

    await reply(chatId, lines.join("\n"));

    return NextResponse.json({
      ok: true,
      count: okResults.length,
      failed: failResults.length,
      jobs: okResults.map((r) =>
        r.ok
          ? {
              leadId: r.leadId,
              jobNumber: r.jobNumber,
              duplicate: Boolean(r.duplicate),
            }
          : null,
      ),
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
