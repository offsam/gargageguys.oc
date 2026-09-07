"use client";

const STORAGE_KEY = "gg.ads.hiddenMetaCampaignIds";

export function readHiddenMetaCampaignIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

export function writeHiddenMetaCampaignIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const unique = [...new Set(ids.map(String).filter(Boolean))];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
}

export function hideMetaCampaignId(id: string): string[] {
  const next = [...new Set([...readHiddenMetaCampaignIds(), id])];
  writeHiddenMetaCampaignIds(next);
  return next;
}

export function unhideMetaCampaignId(id: string): string[] {
  const next = readHiddenMetaCampaignIds().filter((x) => x !== id);
  writeHiddenMetaCampaignIds(next);
  return next;
}

export function clearHiddenMetaCampaignIds() {
  writeHiddenMetaCampaignIds([]);
}
