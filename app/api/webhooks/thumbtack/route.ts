import { NextRequest, NextResponse } from "next/server";
import {
  applyThumbtackLeadUpdate,
  ingestThumbtackLeadToCrm,
  ingestThumbtackMessage,
  ingestThumbtackReview,
  recordThumbtackWebhookReceipt,
} from "@/lib/leads/thumbtack-ingest";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  isThumbtackWebhookAuthorized,
  thumbtackWebhookSecret,
} from "@/lib/thumbtack/auth";
import { classifyThumbtackWebhook } from "@/lib/thumbtack/parse";

/**
 * Thumbtack Pro webhook (Lead details, Messages, Reviews).
 * Destination URL in Thumbtack:
 *   https://garageguysoc.com/api/webhooks/thumbtack?key=THUMBTACK_WEBHOOK_SECRET
 * Fail-closed: missing secret → 503. Wrong secret → 401.
 */

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: "/api/webhooks/thumbtack",
    hint: "POST Thumbtack lead, message, and review payloads here",
  });
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleThumbtackBody(request: NextRequest) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const expected = thumbtackWebhookSecret();
  if (!expected) {
    return NextResponse.json(
      { error: "THUMBTACK_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (
    !isThumbtackWebhookAuthorized({
      searchParams: request.nextUrl.searchParams,
      authorization: request.headers.get("authorization"),
      headerSecret: request.headers.get("x-webhook-secret") || request.headers.get("x-thumbtack-secret"),
      expected,
    })
  ) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = classifyThumbtackWebhook(body);
  const payloadKeys = body && typeof body === "object" ? Object.keys(body as object).slice(0, 40) : [];

  try {
    if (event.kind === "lead") {
      const lead = await ingestThumbtackLeadToCrm(event);
      await recordThumbtackWebhookReceipt({
        kind: "lead",
        summary: event.message || event.category,
        thumbtackLeadId: event.leadId,
        name: event.name,
        phone: event.phone,
        zip: event.zip,
        crmLeadId: lead.leadId,
        payloadKeys,
      }).catch((error) => console.error("[thumbtack-webhook] receipt", error));
      return NextResponse.json({ ok: true, type: "lead", leadId: lead.leadId, duplicate: lead.duplicate });
    }
    if (event.kind === "message") {
      const result = await ingestThumbtackMessage(event);
      await recordThumbtackWebhookReceipt({
        kind: "message",
        summary: event.text,
        thumbtackLeadId: event.leadId,
        crmLeadId: result.leadId,
        payloadKeys,
      }).catch((error) => console.error("[thumbtack-webhook] receipt", error));
      if (result.skipped) {
        return NextResponse.json(
          { ok: true, type: "message", skipped: true, reason: "lead not found" },
          { status: 202 },
        );
      }
      return NextResponse.json({
        ok: true,
        type: "message",
        leadId: result.leadId,
        duplicate: result.duplicate,
      });
    }
    if (event.kind === "review") {
      const result = await ingestThumbtackReview(event);
      await recordThumbtackWebhookReceipt({
        kind: "review",
        summary: event.text || event.author,
        thumbtackLeadId: event.leadId,
        name: event.author,
        payloadKeys,
      }).catch((error) => console.error("[thumbtack-webhook] receipt", error));
      return NextResponse.json({ ok: true, type: "review", duplicate: result.duplicate });
    }
    if (event.kind === "lead_update") {
      const result = await applyThumbtackLeadUpdate(event);
      await recordThumbtackWebhookReceipt({
        kind: "lead_update",
        summary: event.leadPrice || event.chargeState,
        thumbtackLeadId: event.leadId,
        crmLeadId: result.leadId,
        payloadKeys,
      }).catch((error) => console.error("[thumbtack-webhook] receipt", error));
      if (result.skipped) {
        return NextResponse.json(
          { ok: true, type: "lead_update", skipped: true, reason: "lead not found" },
          { status: 202 },
        );
      }
      return NextResponse.json({ ok: true, type: "lead_update", leadId: result.leadId });
    }
    await recordThumbtackWebhookReceipt({
      kind: "unknown",
      summary: payloadKeys.length ? `keys: ${payloadKeys.join(", ")}` : "unparsed Thumbtack payload",
      payloadKeys,
    }).catch((error) => console.error("[thumbtack-webhook] receipt", error));
    return NextResponse.json({ ok: true, type: "unknown", skipped: true, keys: payloadKeys });
  } catch (error) {
    console.error("[thumbtack-webhook]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ingest failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return handleThumbtackBody(request);
}

export async function PUT(request: NextRequest) {
  return handleThumbtackBody(request);
}
