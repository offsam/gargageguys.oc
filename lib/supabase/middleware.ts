import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { safeInternalPath } from "@/lib/security/safe-redirect";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

/**
 * Refresh auth cookies and validate the user JWT (not just cookie presence).
 */
export async function updateSession(request: NextRequest): Promise<{
  supabaseResponse: NextResponse;
  user: User | null;
}> {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return { supabaseResponse, user: null };
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}

export function redirectToLogin(request: NextRequest, pathname: string) {
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("next", safeInternalPath(pathname, "/"));
  return NextResponse.redirect(login);
}
