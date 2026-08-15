import { NextRequest, NextResponse } from "next/server";
import { ingestLead } from "@/lib/leads/ingest";
import { escapeHtml, sendTelegram, sendTwilioSms } from "@/lib/notify/channels";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const ALLOWED_ORIGINS = new Set([
  "https://garageguysoc.com",
  "https://www.garageguysoc.com",
  "https://pullgaragedoor.com",
  "https://www.pullgaragedoor.com",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:3010",
  "http://127.0.0.1:3010",
]);

function setCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.has(origin) || origin.endsWith(".vercel.app")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function clean(value: unknown, max = 200) {
  return String(value || "").trim().slice(0, max);
}

function dealOrderHeadline(leadType: string, dealTitle: string) {
  const labels: Record<string, string> = {
    opener_install_order: "Garage Guys — opener install order",
    maintenance_order: "Garage Guys — maintenance order",
    roller_replacement_order: "Garage Guys — roller replacement order",
    tuneup_order: "Garage Guys — tune-up order",
    booking_request: "Garage Guys — booking request",
  };
  return labels[leadType] || (dealTitle ? `Garage Guys — ${dealTitle} order` : "Garage Guys — service order");
}

export async function OPTIONS(request: NextRequest) {
  return setCors(request, new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(`callback:${clientIp(request)}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return setCors(
      request,
      NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      ),
    );
  }

  const hasTelegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );
  const hasDb = isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!hasTelegram && !hasTwilio && !hasDb) {
    return setCors(
      request,
      NextResponse.json({ error: "Notifications / CRM not configured" }, { status: 503 }),
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return setCors(request, NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  if (body._gotcha) {
    return setCors(request, NextResponse.json({ ok: true }));
  }

  const safeName = clean(body.name, 80);
  const safePhone = clean(body.phone, 30);
  const safeZip = clean(body.zip, 10);
  const safeAddress = clean(body.address, 200);
  const safeMessage = clean(body.message, 800) || "Callback requested from website";
  const safeLeadType = clean(body.leadType, 40) || "callback";
  const safeDealId = clean(body.dealId, 40);
  const safeDealTitle = clean(body.dealTitle, 120);
  const safeDealPrice = clean(body.dealPrice, 16);
  const safePreferredDate = clean(body.preferredDate, 20);
  const safeTimeWindow = clean(body.timeWindow, 80);
  const isBookingRequest = safeLeadType === "booking_request";
  const isDealOrder = /_order$/.test(safeLeadType);

  if (!safeName || !safePhone || !safeZip) {
    return setCors(request, NextResponse.json({ error: "Missing required fields" }, { status: 400 }));
  }

  const headline = isBookingRequest
    ? "Garage Guys — booking request"
    : isDealOrder
      ? dealOrderHeadline(safeLeadType, safeDealTitle)
      : "Garage Guys — callback request";

  const plainText = [
    headline,
    ...(isDealOrder && safeDealTitle ? [`Package: ${safeDealTitle}`] : []),
    ...(isDealOrder && safeDealPrice ? [`Deal price: ${safeDealPrice}`] : []),
    `Name: ${safeName}`,
    `Phone: ${safePhone}`,
    `ZIP: ${safeZip}`,
    `Details: ${safeMessage}`,
  ].join("\n");

  const telegramText = [
    `<b>${escapeHtml(headline)}</b>`,
    "",
    ...(isDealOrder && safeDealTitle ? [`<b>Package:</b> ${escapeHtml(safeDealTitle)}`] : []),
    `<b>Name:</b> ${escapeHtml(safeName)}`,
    `<b>Phone:</b> ${escapeHtml(safePhone)}`,
    `<b>ZIP:</b> ${escapeHtml(safeZip)}`,
    `<b>Details:</b> ${escapeHtml(safeMessage)}`,
  ].join("\n");

  let notified = false;
  if (hasTelegram) {
    const ok = await sendTelegram(telegramText);
    if (!ok) {
      return setCors(
        request,
        NextResponse.json({ error: "Failed to send notification" }, { status: 502 }),
      );
    }
    notified = true;
  }
  if (hasTwilio) {
    const ok = await sendTwilioSms(plainText);
    if (ok) notified = true;
  }

  let crm: { leadId?: string; inboxItemId?: string } | null = null;
  if (hasDb) {
    try {
      crm = await ingestLead({
        name: safeName,
        phone: safePhone,
        zip: safeZip,
        address: safeAddress || undefined,
        message: safeMessage,
        source: "Website",
        leadType: safeLeadType,
        dealId: safeDealId || undefined,
        dealTitle: safeDealTitle || undefined,
        dealPrice: safeDealPrice || undefined,
        preferredDate: safePreferredDate || undefined,
        timeWindow: safeTimeWindow || undefined,
        jobStatus: isBookingRequest && safePreferredDate ? "Scheduled" : "Waiting",
      });
    } catch (err) {
      console.error("[callback] CRM ingest failed", err);
      return setCors(
        request,
        NextResponse.json(
          { error: "Could not register your request. Please call (949) 539-0009." },
          { status: 502 },
        ),
      );
    }
  }

  if (!notified && !crm) {
    return setCors(
      request,
      NextResponse.json({ error: "Notifications not configured" }, { status: 503 }),
    );
  }

  return setCors(request, NextResponse.json({ ok: true, crm: Boolean(crm), leadId: crm?.leadId }));
}
