import type { CookieOptionsWithName } from "@supabase/ssr";

/** Keep technicians signed in across days on phones (Safari/Chrome). */
export const AUTH_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * Shared cookie options for all Supabase SSR clients.
 * maxAge is re-applied by @supabase/ssr on every write; keep secure on HTTPS.
 */
export function authCookieOptions(): CookieOptionsWithName {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: AUTH_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}
