import { NextRequest, NextResponse } from "next/server";
import {
  getMetaAdsConfig,
  getMetaPageWebhookSubscriptions,
  subscribeMetaPageLeadWebhooks,
} from "@/lib/ads/meta";
import { isCronAuthorized } from "@/lib/security/cron-auth";

/**
 * Subscribe the Facebook Page to leadgen + messages webhooks for this app.
 * Auth: Authorization: Bearer CRON_SECRET
 *
 * Also ensure Meta Developer → App → Webhooks has callback:
 *   https://garageguysoc.com/api/ads/meta-leads
 * with verify token = META_WEBHOOK_VERIFY_TOKEN and fields leadgen, messages.
 */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!getMetaAdsConfig().ok) {
    return NextResponse.json({ error: "Meta Ads env not configured" }, { status: 503 });
  }
  try {
    const result = await subscribeMetaPageLeadWebhooks();
    return NextResponse.json({
      ok: true,
      ...result,
      hint: "Confirm App → Webhooks → Page points at /api/ads/meta-leads",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Subscribe failed" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!getMetaAdsConfig().ok) {
    return NextResponse.json({ error: "Meta Ads env not configured" }, { status: 503 });
  }
  try {
    const result = await getMetaPageWebhookSubscriptions();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Read failed" },
      { status: 502 },
    );
  }
}
