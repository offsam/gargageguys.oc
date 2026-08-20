import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authCookieOptions } from "@/lib/supabase/cookie-options";
import { safeInternalPath } from "@/lib/security/safe-redirect";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const next = safeInternalPath(
    request.nextUrl.searchParams.get("next") || "",
    "/login",
  );

  let response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
