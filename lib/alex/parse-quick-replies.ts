import type { AlexQuickReply } from "./types";

const NOT_SURE_PATTERN = /\b(not sure|unsure|don't know|do not know|not certain)\b/i;

function parseQuickReplyEntry(raw: unknown): AlexQuickReply | null {
  if (typeof raw === "string") {
    const label = raw.trim();
    if (!label) return null;
    return { label, value: label };
  }

  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!label) return null;
  const value =
    typeof record.value === "string" && record.value.trim()
      ? record.value.trim()
      : label;
  return { label, value };
}

/** Parse and normalize tap-to-reply chips (max 5, auto-append Not sure when missing). */
export function parseWebsiteAiQuickReplies(raw: unknown): AlexQuickReply[] {
  if (!Array.isArray(raw)) return [];

  const replies: AlexQuickReply[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    const parsed = parseQuickReplyEntry(entry);
    if (!parsed) continue;
    const key = parsed.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    replies.push(parsed);
    if (replies.length >= 5) break;
  }

  if (replies.length === 0) return [];

  const hasNotSure = replies.some((reply) => NOT_SURE_PATTERN.test(reply.label));
  if (!hasNotSure && replies.length >= 2) {
    replies.push({ label: "Not sure", value: "I'm not sure" });
  }

  return replies.slice(0, 5);
}
