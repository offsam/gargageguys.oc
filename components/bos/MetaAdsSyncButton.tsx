"use client";

import { useState, useTransition } from "react";
import { syncMetaAdsAction } from "@/app/actions/ads";

export function MetaAdsSyncButton() {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="ads-sync-row">
      <button
        type="button"
        className="bos-btn"
        disabled={pending}
        onClick={() => {
          setMsg("");
          start(async () => {
            const res = await syncMetaAdsAction();
            if (!res.ok) {
              setMsg(res.error || "Failed");
              return;
            }
            setMsg(
              `Synced · spend $${Number(res.spend || 0).toFixed(0)} · leads ${res.leads ?? 0}`,
            );
          });
        }}
      >
        {pending ? "Syncing…" : "Sync Meta Ads now"}
      </button>
      {msg ? <span className="field-muted">{msg}</span> : null}
    </div>
  );
}
