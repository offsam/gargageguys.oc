import { leadCostForSource } from "@/lib/sheet/money";

export function canonicalLeadSource(
  source?: string,
  hints?: { campaignName?: string | null; adName?: string | null },
): string {
  const raw = String(source || "").trim();
  const blob = `${raw} ${hints?.campaignName || ""} ${hints?.adName || ""}`.toLowerCase();

  if (blob.includes("thumbtack")) return "Thumbtack";
  if (blob.includes("yelp")) return "Yelp";
  if (blob.includes("instagram") || /(^|[^a-z])ig([^a-z]|$)/.test(blob)) return "Instagram";
  if (blob.includes("facebook") || blob.includes("meta") || /(^|[^a-z])fb([^a-z]|$)/.test(blob)) {
    return "Facebook";
  }
  if (blob.includes("google")) return "Google";
  if (blob.includes("referral")) return "Referral";
  if (
    !raw ||
    blob.includes("garageguys") ||
    blob.includes("website") ||
    blob.includes("pullgarage")
  ) {
    return "Website";
  }
  return raw.slice(0, 80);
}

/** Keep an explicit cost if the caller set one; otherwise use the source default. */
export function sheetLeadCostFor(
  source: string,
  existing?: string | null,
): string {
  const explicit = String(existing || "").trim();
  if (explicit) return explicit;
  return leadCostForSource(source) || "";
}
