import { NextRequest, NextResponse } from "next/server";
import { getGbpOAuthAuthUrl } from "@/lib/reviews/gbp";
import crypto from "crypto";

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
