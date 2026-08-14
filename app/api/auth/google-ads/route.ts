import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getGoogleAdsOAuthAuthUrl } from "@/lib/ads/google";

export const dynamic = "force-dynamic";

function redirectUri(request: NextRequest) {
  const envUri = process.env.GOOGLE_ADS_REDIRECT_URI?.trim();
  if (envUri) return envUri;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/auth/google-ads/callback`;
}

export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const url = getGoogleAdsOAuthAuthUrl(redirectUri(request), state);
    const response = NextResponse.redirect(url);
    response.cookies.set("gads_oauth_state", state, {
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
<html lang="en"><head><meta charset="utf-8"><title>Google Ads connect</title>
<style>body{font-family:ui-sans-serif,system-ui;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.5}</style>
</head><body>
<h1>Google Ads OAuth is not ready</h1>
<p>${message.replace(/</g, "&lt;")}</p>
<p>In Vercel → Settings → Environment Variables add:</p>
<ul>
<li><code>GOOGLE_ADS_CLIENT_ID</code> — OAuth Client ID</li>
<li><code>GOOGLE_ADS_CLIENT_SECRET</code> — OAuth Client secret</li>
</ul>
<p>Then redeploy (local files, not git Redeploy) and open this URL again.</p>
</body></html>`;
    return new NextResponse(html, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
