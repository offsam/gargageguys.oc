"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { refreshSessionAction } from "@/app/actions/auth";

/**
 * Keeps the Field tech session alive on mobile:
 * - refreshes the JWT when the phone wakes / tab becomes visible
 * - refreshes periodically while Field is open
 * Without this, Safari often lets the access token expire while the app
 * is backgrounded, and the next navigation looks like a logout.
 */
export function FieldSessionKeeper() {
  const busy = useRef(false);

  useEffect(() => {
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const keepAlive = async () => {
      if (busy.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      busy.current = true;
      try {
        const { data } = await client.auth.getSession();
        if (!data.session) return;

        const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
        const msLeft = expiresAt - Date.now();
        if (!expiresAt || msLeft < 15 * 60 * 1000) {
          await client.auth.refreshSession();
        }
        // Rewrite durable cookies on the server so the next navigation stays signed in.
        await refreshSessionAction();
      } catch {
        /* network blip — next focus/tick retries */
      } finally {
        busy.current = false;
      }
    };

    void keepAlive();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void keepAlive();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", keepAlive);
    window.addEventListener("focus", keepAlive);

    const interval = window.setInterval(() => {
      void keepAlive();
    }, 12 * 60 * 1000);

    const { data: sub } = client.auth.onAuthStateChange(() => {
      /* browser client already persists cookies on TOKEN_REFRESHED */
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", keepAlive);
      window.removeEventListener("focus", keepAlive);
      window.clearInterval(interval);
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
