import { NextRequest, NextResponse } from "next/server";
import { getGbpOAuthAuthUrl } from "@/lib/reviews/gbp";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function redirectUri(request: NextRequest) {
  const envUri = process.env.GOOGLE_GBP_REDIRECT_URI?.trim();
  if (envUri) return envUri;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/auth/google-gbp/callback`;
}

export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const url = getGbpOAuthAuthUrl(redirectUri(request), state);
    const response = NextResponse.redirect(url);
    response.cookies.set("gbp_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Google Business Profile connect</title>
<style>body{font-family:ui-sans-serif,system-ui;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.5}
code{background:#f4f4f5;padding:2px 6px;border-radius:6px}</style>
</head><body>
<h1>Google Business Profile OAuth is not ready</h1>
<p>${message.replace(/</g, "&lt;")}</p>
<p>In Vercel → Settings → Environment Variables you can reuse the Ads OAuth client:</p>
<ul>
<li><code>GOOGLE_GBP_CLIENT_ID</code> or existing <code>GOOGLE_ADS_CLIENT_ID</code></li>
<li><code>GOOGLE_GBP_CLIENT_SECRET</code> or existing <code>GOOGLE_ADS_CLIENT_SECRET</code></li>
</ul>
<p>In Google Cloud → APIs &amp; Services → Credentials → that Web client, add authorized redirect:</p>
<p><code>https://garageguysoc.com/api/auth/google-gbp/callback</code></p>
<p>Enable <strong>Google Business Profile API</strong>, redeploy, then open this URL again.</p>
</body></html>`;
    return new NextResponse(html, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
