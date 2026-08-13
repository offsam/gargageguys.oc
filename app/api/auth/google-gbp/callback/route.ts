import { NextRequest, NextResponse } from "next/server";
import { exchangeGbpOAuthCode } from "@/lib/reviews/gbp";

function redirectUri(request: NextRequest) {
  const envUri = process.env.GOOGLE_GBP_REDIRECT_URI?.trim();
  if (envUri) return envUri;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/auth/google-gbp/callback`;
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
    const refresh = tokens.refresh_token || "(no refresh_token returned — revoke app access and retry with prompt=consent)";
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>GBP OAuth connected</title>
<style>body{font-family:ui-sans-serif,system-ui;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.5}
code,pre{background:#f4f4f5;padding:2px 6px;border-radius:6px}pre{padding:12px;overflow:auto}</style>
</head><body>
<h1>Google Business Profile connected</h1>
<p>Copy this refresh token into Vercel env as <code>GOOGLE_GBP_REFRESH_TOKEN</code>, then redeploy.</p>
<pre>${refresh.replace(/</g, "&lt;")}</pre>
<p>Also set <code>GOOGLE_GBP_ACCOUNT_ID</code> and <code>GOOGLE_GBP_LOCATION_ID</code>, then run <code>/api/google-reviews-sync</code>.</p>
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
