import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PHONE_FIELD_NAMES, fetchMetaLeadgenById } from "@/lib/ads/meta";
import {
  findLeadIdByMetaLeadgen,
  ingestMetaInboxMessageToCrm,
  ingestMetaLeadToCrm,
} from "@/lib/leads/meta-ingest";
import { isMetaInboxLeadFormText } from "@/lib/leads/meta-inbox-parse";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/**
 * Meta Lead Ads + Messenger/Instagram inbox forms webhook (realtime).
 * App → Webhooks: Page leadgen + messages (and Instagram messages if used).
 * Callback URL: https://garageguysoc.com/api/ads/meta-leads
 * Env: META_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET, META_ADS_ACCESS_TOKEN, META_PAGE_ID
 *
 * Backup: /api/meta-leads-catchup every 2 hours if a push is missed.
 */

type LeadField = { name?: string; values?: string[] };

function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function fieldValue(fields: LeadField[], names: string[]) {
  const lower = names.map((n) => n.toLowerCase().replace(/\s+/g, "_"));
  for (const f of fields) {
    const name = String(f.name || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!lower.includes(name) && !lower.some((n) => name.includes(n))) continue;
    const v = (f.values || []).map(String).find((x) => x.trim());
    if (v) return v.trim();
  }
  return "";
}

function fieldsMap(fields: LeadField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const name = String(f.name || "").trim();
    const v = (f.values || []).map(String).find((x) => x.trim())?.trim() || "";
    if (name && v) out[name] = v;
  }
  return out;
}

async function fetchLeadData(leadgenId: string) {
  return fetchMetaLeadgenById(leadgenId);
}

async function resolveCampaignName(campaignId: string | null | undefined): Promise<string> {
  const id = String(campaignId || "").trim();
  if (!id) return "";
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim();
  if (!token) return "";
  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${id}`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("fields", "id,name");
    const res = await fetch(url.toString(), { cache: "no-store" });
    const json = (await res.json()) as { name?: string };
    return String(json.name || "").trim();
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean };
};

async function ingestLeadgenId(leadgenId: string) {
  if (await findLeadIdByMetaLeadgen(leadgenId)) {
    return { leadgenId, ok: true as const, error: "duplicate" };
  }
  const data = await fetchLeadData(leadgenId);
  const fields = data.field_data || [];
  const name =
    fieldValue(fields, ["full_name", "full name", "name"]) ||
    [fieldValue(fields, ["first_name"]), fieldValue(fields, ["last_name"])]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Meta lead";
  const phone = fieldValue(fields, PHONE_FIELD_NAMES);
  const email = fieldValue(fields, ["email", "email_address"]);
  const zip = fieldValue(fields, ["zip_code", "zip", "post_code", "postal_code"]);
  const address = fieldValue(fields, ["street_address", "address"]);
  const message = fieldValue(fields, [
    "message",
    "notes",
    "description",
    "what_do_you_need_help_with",
    "what_do_you_need",
    "problem",
    "task",
  ]);
  const campaignName =
    String(data.campaign_name || "").trim() || (await resolveCampaignName(data.campaign_id));

  const lead = await ingestMetaLeadToCrm({
    leadgenId,
    name,
    phone,
    email,
    zip,
    address,
    message,
    formId: data.form_id || null,
    adId: data.ad_id || null,
    adsetId: data.adset_id || null,
    campaignId: data.campaign_id || null,
    campaignName: campaignName || null,
    adName: data.ad_name || null,
    createdTime: data.created_time || null,
    fields: fieldsMap(fields),
  });

  return { leadgenId, ok: true as const, leadId: lead.leadId };
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (appSecret) {
    const sig = request.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, sig, appSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{
        field?: string;
        value?: { leadgen_id?: string; page_id?: string; form_id?: string; ad_id?: string };
      }>;
      messaging?: MessagingEvent[];
    }>;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results: Array<Record<string, unknown>> = [];
  const objectKind = String(body.object || "page").toLowerCase();
  const inboxChannel =
    objectKind === "instagram" ? ("Instagram" as const) : ("Messenger" as const);

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "leadgen") continue;
      const id = change.value?.leadgen_id;
      if (!id) continue;
      try {
        results.push(await ingestLeadgenId(id));
      } catch (error) {
        const message = error instanceof Error ? error.message : "ingest failed";
        console.error("[meta-leads-webhook] leadgen failed", id, message);
        results.push({
          leadgenId: id,
          ok: false,
          error: message,
        });
      }
    }

    for (const event of entry.messaging || []) {
      const text = String(event.message?.text || "").trim();
      const mid = String(event.message?.mid || "").trim();
      if (!text || !mid || event.message?.is_echo) continue;
      if (!isMetaInboxLeadFormText(text)) continue;
      try {
        const lead = await ingestMetaInboxMessageToCrm({
          messageId: mid,
          text,
          channel: inboxChannel,
          senderId: event.sender?.id,
        });
        if (lead.skipped) {
          results.push({ messageId: mid, ok: true, skipped: true });
          continue;
        }
        results.push({
          messageId: mid,
          ok: true,
          leadId: lead.leadId,
          duplicate: lead.duplicate,
          channel: inboxChannel,
        });
      } catch (error) {
        results.push({
          messageId: mid,
          ok: false,
          error: error instanceof Error ? error.message : "inbox ingest failed",
        });
      }
    }
  }

  const retryable = results.some((r) => r.ok === false);
  // Always 200 for empty messaging pings so Meta does not disable the webhook.
  return NextResponse.json({ ok: !retryable, results }, { status: retryable ? 500 : 200 });
}
