"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  debugGoogleAdsAction,
  debugMetaAdsTokenAction,
  importMetaLeadAction,
  loadMetaCampaignLeadsAction,
  syncGoogleAdsAction,
  syncMetaAdsAction,
} from "@/app/actions/ads";
import type { MetaCampaignMetrics, MetaLeadRow } from "@/lib/ads/meta";
import type { GoogleAdsCampaignMetrics } from "@/lib/ads/google";

type EnrichedLead = MetaLeadRow & {
  inCrm: boolean;
  crmLeadId?: string;
  crmStage?: string;
};

type CampaignLeadsState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  leads: EnrichedLead[];
};

function moneyExact(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function AdsBoard({
  periodStart,
  periodEnd,
  accountId,
  syncedAt,
  accountSpend,
  accountLeads,
  accountCpl,
  accountClicks,
  accountImpressions,
  campaigns,
  google,
}: {
  periodStart: string;
  periodEnd: string;
  accountId?: string | null;
  syncedAt?: string | null;
  accountSpend: number | null;
  accountLeads: number | null;
  accountCpl: number | null;
  accountClicks: number | null;
  accountImpressions: number | null;
  campaigns: MetaCampaignMetrics[];
  google?: {
    periodStart?: string;
    periodEnd?: string;
    accountId?: string | null;
    syncedAt?: string | null;
    spend: number | null;
    leads: number | null;
    cpl: number | null;
    clicks: number | null;
    impressions: number | null;
    campaigns: GoogleAdsCampaignMetrics[];
    lsaLeadCount?: number;
    hasApiKey: boolean;
    canQuery: boolean;
    missing: string[];
  };
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, CampaignLeadsState>>({});
  const [syncMsg, setSyncMsg] = useState("");
  const [pendingSync, startSync] = useTransition();
  const [pendingLeads, startLeads] = useTransition();
  const [importingId, setImportingId] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState("");
  const [pendingDebug, startDebug] = useTransition();
  const [googleMsg, setGoogleMsg] = useState("");
  const [pendingGoogle, startGoogle] = useTransition();

  function ensureLeads(campaignId: string) {
    const existing = cache[campaignId];
    if (existing?.status === "ready" || existing?.status === "loading") return;

    setCache((prev) => ({
      ...prev,
      [campaignId]: { status: "loading", leads: prev[campaignId]?.leads || [] },
    }));

    startLeads(async () => {
      const res = await loadMetaCampaignLeadsAction(campaignId);
      if (!res.ok) {
        setCache((prev) => ({
          ...prev,
          [campaignId]: {
            status: "error",
            error: res.error || "Failed",
            leads: [],
          },
        }));
        return;
      }
      setCache((prev) => ({
        ...prev,
        [campaignId]: {
          status: "ready",
          leads: (res.leads || []) as EnrichedLead[],
        },
      }));
    });
  }

  function toggleCampaign(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    ensureLeads(id);
  }

  const expanded = campaigns.find((c) => c.id === expandedId) || null;

  return (
    <div className="ads-board">
      <h2 style={{ marginTop: 0 }}>Google Ads / Local Services</h2>
      <div className="ads-sync-row">
        <button
          type="button"
          className="bos-btn"
          disabled={pendingGoogle}
          onClick={() => {
            setGoogleMsg("");
            startGoogle(async () => {
              const res = await syncGoogleAdsAction();
              if (!res.ok) {
                setGoogleMsg(res.error || "Failed");
                return;
              }
              setGoogleMsg(
                `Google synced · ${res.campaigns ?? 0} campaigns · leads ${res.leads ?? 0}` +
                  (res.ingested ? ` · ${res.ingested} new → CRM` : ""),
              );
              window.location.reload();
            });
          }}
        >
          {pendingGoogle ? "Syncing…" : "Sync Google Ads now"}
        </button>
        <button
          type="button"
          className="bos-btn bos-btn--ghost"
          disabled={pendingGoogle}
          onClick={() => {
            setGoogleMsg("");
            startGoogle(async () => {
              const res = await debugGoogleAdsAction();
              if (!res.ok) {
                setGoogleMsg(res.error || "Debug failed");
                return;
              }
              setGoogleMsg(
                [
                  `API key: ${res.hasApiKey ? "YES" : "NO"}`,
                  `developer token: ${res.hasDeveloperToken ? "YES" : "NO"}`,
                  `customer ID: ${res.hasCustomerId ? res.customerId : "NO"}`,
                  `OAuth: ${res.hasRefreshToken ? "YES" : "NO"}`,
                  res.missing.length ? `missing: ${res.missing.join(", ")}` : "ready",
                ].join(" · "),
              );
            });
          }}
        >
          Check Google setup
        </button>
        <a className="bos-btn bos-btn--ghost" href="/api/auth/google-ads">
          Connect Google Ads
        </a>
        {googleMsg ? <span className="field-muted">{googleMsg}</span> : null}
      </div>
      <p className="field-muted">
        Put the Cloud API key in Vercel as <code>GOOGLE_CLOUD_API_KEY</code>. Lead forms POST to{" "}
        <code>/api/ads/google-leads</code> (Waiting + Telegram). Local Services catch-up runs on
        Sync.
        {google?.syncedAt ? ` Last Google sync ${new Date(google.syncedAt).toLocaleString()}.` : ""}
      </p>
      {google && !google.hasApiKey ? (
        <div className="bos-card">GOOGLE_CLOUD_API_KEY is not set in Vercel yet.</div>
      ) : null}
      {google?.hasApiKey && !google.canQuery ? (
        <div className="bos-card">
          API key is in. Still needed: {(google.missing || []).filter((m) => m !== "GOOGLE_CLOUD_API_KEY").join(", ") || "OAuth + Ads customer ID + developer token"}.
        </div>
      ) : null}
      {google?.canQuery || google?.spend != null ? (
        <div className="bos-grid" style={{ marginBottom: "1.25rem" }}>
          <div className="bos-card">
            <h3>Google spend</h3>
            <div className="value">{money(google.spend)}</div>
          </div>
          <div className="bos-card">
            <h3>Google leads</h3>
            <div className="value">{google.leads ?? "—"}</div>
          </div>
          <div className="bos-card">
            <h3>Google CPL</h3>
            <div className="value">{moneyExact(google.cpl)}</div>
          </div>
          <div className="bos-card">
            <h3>LSA leads</h3>
            <div className="value">{google.lsaLeadCount ?? "—"}</div>
          </div>
        </div>
      ) : null}

      <h2>Meta Ads</h2>
      <div className="ads-sync-row">
        <button
          type="button"
          className="bos-btn"
          disabled={pendingSync}
          onClick={() => {
            setSyncMsg("");
            startSync(async () => {
              const res = await syncMetaAdsAction();
              if (!res.ok) {
                setSyncMsg(res.error || "Failed");
                return;
              }
              setSyncMsg(
                `Synced · ${res.campaigns ?? 0} campaigns · account leads ${res.leads ?? 0}` +
                  (res.ingested
                    ? ` · ${res.ingested} new form lead${res.ingested === 1 ? "" : "s"} → CRM`
                    : ""),
              );
              window.location.reload();
            });
          }}
        >
          {pendingSync ? "Syncing…" : "Sync Meta Ads now"}
        </button>
        <button
          type="button"
          className="bos-btn bos-btn--ghost"
          disabled={pendingDebug}
          onClick={() => {
            setDebugMsg("");
            startDebug(async () => {
              const res = await debugMetaAdsTokenAction();
              if (!res.ok) {
                setDebugMsg(res.error || "Debug failed");
                return;
              }
              setDebugMsg(
                [
                  `pages_manage_ads: ${res.hasPagesManageAds ? "YES" : "NO"}`,
                  `leads_retrieval: ${res.hasLeadsRetrieval ? "YES" : "NO"}`,
                  `ads_read: ${res.hasAdsRead ? "YES" : "NO"}`,
                  `page token: ${res.pageTokenOk ? "YES" : `NO (${res.pageError || "—"})`}`,
                  `granted: ${(res.granted || []).join(", ") || "(none)"}`,
                ].join(" · "),
              );
            });
          }}
        >
          {pendingDebug ? "Checking…" : "Check token permissions"}
        </button>
        {syncMsg ? <span className="field-muted">{syncMsg}</span> : null}
      </div>
      {debugMsg ? <div className="bos-card" style={{ marginBottom: "0.85rem" }}>{debugMsg}</div> : null}

      <div className="bos-grid">
        <div className="bos-card">
          <h3>Period</h3>
          <div className="value" style={{ fontSize: "1.05rem" }}>
            {periodStart} → {periodEnd}
          </div>
        </div>
        <div className="bos-card">
          <h3>Account spend</h3>
          <div className="value">{money(accountSpend)}</div>
        </div>
        <div className="bos-card">
          <h3>Account leads</h3>
          <div className="value">{accountLeads ?? "—"}</div>
        </div>
        <div className="bos-card">
          <h3>Account CPL</h3>
          <div className="value">{moneyExact(accountCpl)}</div>
        </div>
        <div className="bos-card">
          <h3>Clicks</h3>
          <div className="value">{accountClicks ?? "—"}</div>
        </div>
        <div className="bos-card">
          <h3>Impressions</h3>
          <div className="value">{accountImpressions ?? "—"}</div>
        </div>
      </div>

      <p className="field-muted">
        Account totals mix every campaign. Click a campaign row to expand and see real Lead Ads
        (name/phone) and whether each is already in CRM.
        {syncedAt ? ` Synced ${new Date(syncedAt).toLocaleString()}.` : ""}
        {accountId ? ` ${accountId}` : ""}
      </p>

      <h2>Campaigns</h2>
      {!campaigns.length ? (
        <div className="bos-card">No campaigns in this period. Sync Meta Ads first.</div>
      ) : (
        <div className="ads-campaign-list">
          {campaigns.map((c) => {
            const open = expandedId === c.id;
            const state = cache[c.id];
            return (
              <div key={c.id} className={`ads-campaign${open ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="ads-campaign-head"
                  onClick={() => toggleCampaign(c.id)}
                  aria-expanded={open}
                >
                  <span className="ads-campaign-chevron" aria-hidden>
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="ads-campaign-name">{c.name}</span>
                  <span className="ads-campaign-stat">{moneyExact(c.spend)}</span>
                  <span className="ads-campaign-stat">
                    {state?.status === "ready"
                      ? `${state.leads.length} forms`
                      : `${c.leads} insights`}
                  </span>
                  <span className="ads-campaign-stat">
                    {state?.status === "ready" && state.leads.length > 0
                      ? `${moneyExact(c.spend / state.leads.length)} CPL`
                      : `${moneyExact(c.cpl)} CPL`}
                  </span>
                  <span className="ads-campaign-stat muted">
                    {c.clicks} clk · {c.impressions} imp
                  </span>
                </button>

                {open ? (
                  <div className="ads-campaign-body">
                    <div className="bos-grid" style={{ marginBottom: "0.75rem" }}>
                      <div className="bos-card">
                        <h3>Spend</h3>
                        <div className="value">{money(c.spend)}</div>
                      </div>
                      <div className="bos-card">
                        <h3>Insights leads</h3>
                        <div className="value">{c.leads}</div>
                      </div>
                      <div className="bos-card">
                        <h3>Form leads</h3>
                        <div className="value">
                          {state?.status === "ready" ? state.leads.length : pendingLeads ? "…" : "—"}
                        </div>
                      </div>
                      <div className="bos-card">
                        <h3>CPL (forms)</h3>
                        <div className="value">
                          {state?.status === "ready" && state.leads.length > 0
                            ? moneyExact(c.spend / state.leads.length)
                            : moneyExact(c.cpl)}
                        </div>
                      </div>
                    </div>

                    <p className="field-muted" style={{ marginTop: 0 }}>
                      Meta Ads Manager &quot;leads&quot; (insights) often counts more than Instant Form
                      rows (messages, website events, etc.). The list below is the real form
                      submissions.
                      {c.leadActions && Object.keys(c.leadActions).length
                        ? ` Insights breakdown: ${Object.entries(c.leadActions)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(", ")}.`
                        : ""}
                    </p>

                    {state?.status === "loading" || (pendingLeads && !state) ? (
                      <p className="field-muted">Loading lead details from Meta…</p>
                    ) : null}

                    {state?.status === "error" ? (
                      <div className="field-form-error">
                        {state.error}
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="bos-btn bos-btn--ghost"
                            onClick={() => {
                              setCache((prev) => {
                                const next = { ...prev };
                                delete next[c.id];
                                return next;
                              });
                              ensureLeads(c.id);
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {state?.status === "ready" && state.leads.length === 0 ? (
                      <div className="bos-card">
                        Insights shows {c.leads} lead(s), but Meta returned 0 Lead Ads form rows for
                        this campaign in the period. That usually means conversions are not Instant
                        Forms (e.g. calls/messages/pixel), or the token needs{" "}
                        <code>leads_retrieval</code>.
                      </div>
                    ) : null}

                    {state?.status === "ready" && state.leads.length > 0 ? (
                      <>
                        <div className="ads-lead-summary">
                          <strong>{state.leads.length}</strong> form leads ·{" "}
                          <strong>{state.leads.filter((l) => l.inCrm).length}</strong> already in CRM
                          ·{" "}
                          <strong>{state.leads.filter((l) => !l.inCrm).length}</strong> not in CRM
                        </div>
                        <table className="bos-table">
                          <thead>
                            <tr>
                              <th>When</th>
                              <th>Name</th>
                              <th>Phone</th>
                              <th>ZIP / note</th>
                              <th>Ad</th>
                              <th>CRM</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.leads.map((lead) => (
                              <tr key={lead.id}>
                                <td>
                                  {lead.createdTime
                                    ? new Date(lead.createdTime).toLocaleString([], {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </td>
                                <td>
                                  <strong>{lead.name}</strong>
                                  {lead.email ? (
                                    <div className="field-muted" style={{ fontSize: "0.75rem" }}>
                                      {lead.email}
                                    </div>
                                  ) : null}
                                </td>
                                <td>{lead.phone || "—"}</td>
                                <td>
                                  {[lead.zip, lead.message].filter(Boolean).join(" · ") || "—"}
                                </td>
                                <td>{lead.adName || lead.adId || "—"}</td>
                                <td>
                                  {lead.inCrm ? (
                                    <Link href="/crm" className="ads-crm-pill is-in">
                                      In CRM
                                      {lead.crmStage ? ` · ${lead.crmStage}` : ""}
                                    </Link>
                                  ) : (
                                    <span className="ads-crm-pill is-out">Not in CRM</span>
                                  )}
                                </td>
                                <td>
                                  {lead.inCrm ? (
                                    <Link href="/crm" className="bos-btn bos-btn--ghost">
                                      Open CRM
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      className="bos-btn bos-btn--ghost"
                                      disabled={!lead.phone || importingId === lead.id}
                                      onClick={() => {
                                        setImportingId(lead.id);
                                        startLeads(async () => {
                                          const res = await importMetaLeadAction(lead);
                                          setImportingId(null);
                                          if (!res.ok) {
                                            setSyncMsg(res.error || "Import failed");
                                            return;
                                          }
                                          setCache((prev) => {
                                            const cur = prev[c.id];
                                            if (!cur) return prev;
                                            return {
                                              ...prev,
                                              [c.id]: {
                                                ...cur,
                                                leads: cur.leads.map((l) =>
                                                  l.id === lead.id
                                                    ? {
                                                        ...l,
                                                        inCrm: true,
                                                        crmLeadId: res.leadId,
                                                        crmStage: "new",
                                                      }
                                                    : l,
                                                ),
                                              },
                                            };
                                          });
                                          setSyncMsg(
                                            res.duplicate
                                              ? `Already in CRM · ${lead.name}`
                                              : `Imported to CRM · ${lead.name}`,
                                          );
                                        });
                                      }}
                                    >
                                      {importingId === lead.id ? "…" : "To CRM"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {expanded ? (
        <p className="field-muted" style={{ marginTop: "0.75rem" }}>
          Opened: {expanded.name}
        </p>
      ) : null}
    </div>
  );
}
