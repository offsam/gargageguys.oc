"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Event-driven page refresh: Supabase Realtime on leads/jobs, plus one
 * refresh when the tab becomes visible or the socket reconnects.
 * No interval polling.
 */
export function useBosLiveRefresh(tables: Array<"leads" | "jobs"> = ["leads"]) {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const tableKey = tables.join("|");

  useEffect(() => {
    const watched = tableKey.split("|").filter(Boolean) as Array<"leads" | "jobs">;
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current < 500) return;
      lastRefresh.current = now;
      router.refresh();
    };

    let everSubscribed = false;
    let channel = client.channel(`bos-live-${tableKey}`);
    for (const table of watched) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        refresh,
      );
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (everSubscribed) refresh();
        everSubscribed = true;
      }
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void client.removeChannel(channel);
    };
  }, [router, tableKey]);
}
