import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleAdsOAuthCode } from "@/lib/ads/google";

export const dynamic = "force-dynamic";

function redirectUri(request: NextRequest) {
  const envUri = process.env.GOOGLE_ADS_REDIRECT_URI?.trim();
  if (envUri) return envUri;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/auth/google-ads/callback`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("gads_oauth_state")?.value;
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`OAuth error: ${error}`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!code) return new NextResponse("Missing OAuth code", { status: 400 });
  if (!state || !cookieState || state !== cookieState) {
    return new NextResponse("Invalid OAuth state", { status: 400 });
  }

  try {
    const tokens = await exchangeGoogleAdsOAuthCode(code, redirectUri(request));
    const refresh =
      tokens.refresh_token ||
      "(no refresh_token — revoke app access in Google Account and retry)";
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Google Ads connected</title>
<style>body{font-family:ui-sans-serif,system-ui;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.5}
code,pre{background:#f4f4f5;padding:2px 6px;border-radius:6px}pre{padding:12px;overflow:auto}</style>
</head><body>
<h1>Google Ads / Local Services connected</h1>
<p>Copy this refresh token into Vercel as <code>GOOGLE_ADS_REFRESH_TOKEN</code>, then redeploy.</p>
<pre>${refresh.replace(/</g, "&lt;")}</pre>
<p>Also set <code>GOOGLE_ADS_CUSTOMER_ID</code> and <code>GOOGLE_ADS_DEVELOPER_TOKEN</code>.</p>
</body></html>`;
    const response = new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    response.cookies.set("gads_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : String(err), { status: 500 });
  }
}
