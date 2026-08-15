import { NextRequest, NextResponse } from "next/server";
import { getGoogleAdsConfig } from "@/lib/ads/google";
import { ingestGoogleLeadToCrm } from "@/lib/leads/google-ingest";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/**
 * Google Ads Lead Form webhook (event-driven).
 * In the lead form set Webhook URL:
 *   https://garageguysoc.com/api/ads/google-leads
 * and the same google_key as GOOGLE_ADS_LEAD_WEBHOOK_KEY.
 */

type UserColumn = {
  column_id?: string;
  column_name?: string;
  string_value?: string;
};

function col(fields: UserColumn[], names: string[]) {
  const want = names.map((n) => n.toLowerCase().replace(/\s+/g, "_"));
  for (const f of fields) {
    const id = String(f.column_id || f.column_name || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!want.includes(id) && !want.some((n) => id.includes(n))) continue;
    const v = String(f.string_value || "").trim();
    if (v) return v;
  }
  return "";
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: "/api/ads/google-leads",
    hint: "POST Google Ads lead form payloads here",
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const cfg = getGoogleAdsConfig();
  let body: {
    lead_id?: string;
    google_key?: string;
    campaign_id?: string;
    campaign_name?: string;
    form_id?: string;
    gcl_id?: string;
    is_test?: boolean;
    user_column_data?: UserColumn[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!cfg.webhookKey) {
    return NextResponse.json(
      { error: "GOOGLE_ADS_LEAD_WEBHOOK_KEY is not configured" },
      { status: 503 },
    );
  }
  if (body.google_key !== cfg.webhookKey) {
    return NextResponse.json({ error: "Invalid google_key" }, { status: 401 });
  }

  const fields = body.user_column_data || [];
  const name =
    col(fields, ["full_name", "full name", "name"]) ||
    [col(fields, ["first_name"]), col(fields, ["last_name"])].filter(Boolean).join(" ").trim() ||
    "Google lead";
  const phone = col(fields, ["phone_number", "phone", "mobile"]);
  const zip = col(fields, ["zip_code", "zip", "postal_code", "post_code"]);
  const address = col(fields, ["street_address", "address"]);
  const message = col(fields, ["message", "notes", "description", "what_do_you_need"]);
  const email = col(fields, ["email", "email_address"]);
  const leadId = String(body.lead_id || body.gcl_id || "").trim();

  if (!phone) {
    return NextResponse.json({ ok: false, error: "missing phone" }, { status: 200 });
  }
  if (!leadId) {
    return NextResponse.json({ ok: false, error: "missing lead_id" }, { status: 400 });
  }

  try {
    const lead = await ingestGoogleLeadToCrm({
      googleLeadId: `gads:${leadId}`,
      name,
      phone,
      zip,
      address,
      message,
      email,
      sourceKind: "google_ads",
      campaignId: body.campaign_id || null,
      campaignName: body.campaign_name || null,
      fields: Object.fromEntries(
        fields
          .map((f) => [String(f.column_id || f.column_name || ""), String(f.string_value || "")])
          .filter(([k, v]) => k && v),
      ),
    });
    return NextResponse.json({ ok: true, leadId: lead.leadId, duplicate: lead.duplicate });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ingest failed" },
      { status: 500 },
    );
  }
}
