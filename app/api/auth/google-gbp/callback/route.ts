import { NextRequest, NextResponse } from "next/server";
import { exchangeGbpOAuthCode, listGbpAccountsAndLocations } from "@/lib/reviews/gbp";

function redirectUri(request: NextRequest) {
  const envUri = process.env.GOOGLE_GBP_REDIRECT_URI?.trim();
  if (envUri) return envUri;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/auth/google-gbp/callback`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("gbp_oauth_state")?.value;
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`OAuth error: ${error}`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!code) {
    return new NextResponse("Missing OAuth code", { status: 400 });
  }

  if (!state || !cookieState || state !== cookieState) {
    return new NextResponse("Invalid OAuth state", { status: 400 });
  }

  try {
    const tokens = await exchangeGbpOAuthCode(code, redirectUri(request));
    const refresh =
      tokens.refresh_token ||
      "(no refresh_token returned — revoke app access and retry with prompt=consent)";
    const listed = tokens.access_token
      ? await listGbpAccountsAndLocations(tokens.access_token)
      : { locations: [], error: "OAuth response missing access_token" };

    const locationBlocks = listed.locations
      .map((loc) => {
        const label = [loc.title, loc.address].filter(Boolean).join(" — ");
        return `<div class="card">
  <p><strong>${escapeHtml(label)}</strong></p>
  <p>GOOGLE_GBP_ACCOUNT_ID</p>
  <pre>${escapeHtml(loc.accountId)}</pre>
  <p>GOOGLE_GBP_LOCATION_ID</p>
  <pre>${escapeHtml(loc.locationId)}</pre>
</div>`;
      })
      .join("\n");

    const locationsHtml = listed.locations.length
      ? `<p>Pick the Garage Guys Newport Beach row (3848 Campus Dr) and paste these two values into Vercel Production env.</p>
${locationBlocks}`
      : `<p>Could not list locations automatically${listed.error ? `: ${escapeHtml(listed.error)}` : ""}.</p>
<p>Enable <strong>My Business Account Management API</strong> and <strong>My Business Business Information API</strong> in Google Cloud, then open <code>/api/auth/google-gbp</code> again.</p>`;

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>GBP OAuth connected</title>
<style>body{font-family:ui-sans-serif,system-ui;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.5}
code,pre{background:#f4f4f5;padding:2px 6px;border-radius:6px}pre{padding:12px;overflow:auto}
.card{border:1px solid #e4e4e7;border-radius:10px;padding:12px 16px;margin:16px 0}</style>
</head><body>
<h1>Google Business Profile connected</h1>
<p>1. Copy this into Vercel as <code>GOOGLE_GBP_REFRESH_TOKEN</code>:</p>
<pre>${escapeHtml(refresh)}</pre>
<h2>Account and location IDs</h2>
${locationsHtml}
<p>2. Redeploy, then run <code>/api/google-reviews-sync</code> with the cron secret.</p>
</body></html>`;
    const response = new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    response.cookies.set("gbp_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : String(err), {
      status: 500,
    });
  }
}
