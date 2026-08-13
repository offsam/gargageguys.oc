import type { AlexCollectedContact, AlexModelTurn, AlexQuickReply } from "./types";
import { parseWebsiteAiQuickReplies } from "./parse-quick-replies";

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseCollected(raw: unknown): AlexCollectedContact {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  const schedulingPreference = record.schedulingPreference;
  const schedulingMode = record.schedulingMode;
  return {
    name: pickString(record.name),
    phone: pickString(record.phone),
    zip: pickString(record.zip),
    message: pickString(record.message),
    schedulingMode:
      schedulingMode === "asap" ||
      schedulingMode === "scheduled" ||
      schedulingMode === "callback"
        ? schedulingMode
        : null,
    preferredScheduleAt: pickString(record.preferredScheduleAt) ?? null,
    schedulingPreference:
      schedulingPreference === "today" ||
      schedulingPreference === "tomorrow" ||
      schedulingPreference === "specific" ||
      schedulingPreference === "callback"
        ? schedulingPreference
        : null,
    wantsCallback:
      record.wantsCallback === true ||
      schedulingPreference === "callback" ||
      schedulingMode === "callback",
  };
}

export function parseAlexModelTurn(raw: string): AlexModelTurn {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract JSON object from markdown fences / prose
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    } else {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      reply: raw.trim() || "Sorry, I had trouble processing that. Could you repeat?",
      quickReplies: [],
      collected: {},
      readyToSubmit: false,
    };
  }

  const record = parsed as Record<string, unknown>;
  const reply = pickString(record.reply) ?? "How can I help with your garage door today?";
  const quickReplies: AlexQuickReply[] = parseWebsiteAiQuickReplies(record.quickReplies);

  return {
    reply,
    quickReplies,
    collected: parseCollected(record.collected),
    readyToSubmit: record.readyToSubmit === true,
  };
}

export function mergeCollected(
  base: AlexCollectedContact,
  next: AlexCollectedContact,
): AlexCollectedContact {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ),
  };
}

export function isContactReady(collected: AlexCollectedContact): boolean {
  return Boolean(collected.name?.trim() && collected.phone?.trim() && collected.zip?.trim());
}
