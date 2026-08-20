import { createBrowserClient } from "@supabase/ssr";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createBrowserClient(url, key, {
    cookieOptions: authCookieOptions(),
    isSingleton: true,
  });
}
