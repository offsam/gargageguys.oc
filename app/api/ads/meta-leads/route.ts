import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { findLeadIdByMetaLeadgen, ingestMetaLeadToCrm } from "@/lib/leads/meta-ingest";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/**
 * Meta Lead Ads webhook.
 * Subscribe the Page to leadgen in App → Webhooks.
 * Env: META_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET, META_ADS_ACCESS_TOKEN
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
  const lower = names.map((n) => n.toLowerCase());
  for (const f of fields) {
    const name = String(f.name || "").toLowerCase();
    if (!lower.includes(name)) continue;
    const v = (f.values || []).map(String).find((x) => x.trim());
    if (v) return v.trim();
  }
  return "";
}

async function fetchLeadData(leadgenId: string) {
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("META_ADS_ACCESS_TOKEN missing");
  const url = new URL(`https://graph.facebook.com/v21.0/${leadgenId}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", "id,created_time,ad_id,adset_id,campaign_id,form_id,field_data");
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as {
    id?: string;
    created_time?: string;
    ad_id?: string;
    adset_id?: string;
    campaign_id?: string;
    form_id?: string;
    field_data?: LeadField[];
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Failed to load lead ${leadgenId}`);
  }
  return json;
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
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: { leadgen_id?: string; page_id?: string; form_id?: string; ad_id?: string };
      }>;
    }>;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadgenIds: string[] = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "leadgen") continue;
      const id = change.value?.leadgen_id;
      if (id) leadgenIds.push(id);
    }
  }

  const results: Array<{ leadgenId: string; ok: boolean; leadId?: string; error?: string }> = [];

  for (const leadgenId of leadgenIds) {
    try {
      if (await findLeadIdByMetaLeadgen(leadgenId)) {
        results.push({ leadgenId, ok: true, error: "duplicate" });
        continue;
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
      const phone = fieldValue(fields, ["phone_number", "phone", "mobile_number"]);
      const zip = fieldValue(fields, ["zip_code", "zip", "post_code", "postal_code"]);
      const address = fieldValue(fields, ["street_address", "address"]);
      const message = fieldValue(fields, ["message", "notes", "description", "what_do_you_need"]);

      if (!phone) {
        results.push({ leadgenId, ok: false, error: "missing phone" });
        continue;
      }

      const lead = await ingestMetaLeadToCrm({
        leadgenId,
        name,
        phone,
        zip,
        address,
        message,
        formId: data.form_id || null,
        adId: data.ad_id || null,
        adsetId: data.adset_id || null,
        campaignId: data.campaign_id || null,
        createdTime: data.created_time || null,
      });

      results.push({ leadgenId, ok: true, leadId: lead.leadId });
    } catch (error) {
      results.push({
        leadgenId,
        ok: false,
        error: error instanceof Error ? error.message : "ingest failed",
      });
    }
  }

  const retryable = results.some((r) => !r.ok && r.error !== "missing phone");
  return NextResponse.json({ ok: !retryable, results }, { status: retryable ? 500 : 200 });
}
