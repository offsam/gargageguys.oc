import { ingestLead } from "@/lib/leads/ingest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { callGroqWithFallback } from "./groq";
import { isContactReady, mergeCollected, parseAlexModelTurn } from "./parse";
import { WEBSITE_AI_EMPLOYEE_SYSTEM_PROMPT } from "./prompt";
import type {
  AlexChatMessage,
  AlexCollectedContact,
  AlexTurnResult,
} from "./types";

export class AlexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlexError";
  }
}

export async function runAlexTurn(input: {
  sessionId: string;
  messages: AlexChatMessage[];
  submittedInboxItemId?: string | null;
}): Promise<AlexTurnResult> {
  const sessionId = input.sessionId?.trim();
  if (!sessionId) throw new AlexError("sessionId is required");
  if (!input.messages.length) throw new AlexError("messages required");
  if (input.messages[input.messages.length - 1]?.role !== "user") {
    throw new AlexError("last message must be from the user");
  }

  const supabase = getSupabaseAdmin();
  const { data: existingSession } = await supabase
    .from("chat_sessions")
    .select("id, collected, lead_id")
    .eq("session_key", sessionId)
    .maybeSingle();

  const priorCollected = (existingSession?.collected || {}) as AlexCollectedContact;

  const groqMessages = [
    { role: "system" as const, content: WEBSITE_AI_EMPLOYEE_SYSTEM_PROMPT },
    {
      role: "system" as const,
      content:
        "Respond ONLY with a JSON object: { reply, quickReplies, collected, readyToSubmit }. Keep replies short.",
    },
    ...(input.submittedInboxItemId
      ? [
          {
            role: "system" as const,
            content: `Lead already submitted (${input.submittedInboxItemId}). Do not set readyToSubmit true.`,
          },
        ]
      : []),
    ...input.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const raw = await callGroqWithFallback(groqMessages);
  const turn = parseAlexModelTurn(raw);
  const collected = mergeCollected(priorCollected, turn.collected);

  let leadSubmitted = false;
  let inboxItemId: string | undefined;
  let leadId: string | undefined = existingSession?.lead_id || undefined;

  const shouldSubmit =
    turn.readyToSubmit &&
    !input.submittedInboxItemId &&
    !existingSession?.lead_id &&
    isContactReady(collected);

  if (shouldSubmit) {
    const preferredDate = collected.preferredScheduleAt
      ? String(collected.preferredScheduleAt).slice(0, 10)
      : undefined;
    const ingested = await ingestLead({
      name: collected.name!,
      phone: collected.phone!,
      zip: collected.zip!,
      message: collected.message || "Website chat lead",
      source: "Website",
      leadType: collected.wantsCallback ? "callback" : "chat",
      preferredDate,
      timeWindow: collected.schedulingMode || undefined,
      jobStatus: preferredDate ? "Scheduled" : "Waiting",
      problem: collected.message,
      metadata: {
        sessionId,
        schedulingMode: collected.schedulingMode,
        preferredScheduleAt: collected.preferredScheduleAt,
      },
    });
    leadSubmitted = true;
    inboxItemId = ingested.inboxItemId;
    leadId = ingested.leadId;
  }

  const sessionPayload = {
    session_key: sessionId,
    messages: input.messages.concat([{ role: "assistant", content: turn.reply }]),
    collected,
    lead_id: leadId || null,
    updated_at: new Date().toISOString(),
  };

  if (existingSession?.id) {
    await supabase.from("chat_sessions").update(sessionPayload).eq("id", existingSession.id);
  } else {
    await supabase.from("chat_sessions").insert(sessionPayload);
  }

  return {
    reply: turn.reply,
    quickReplies: turn.quickReplies,
    collected,
    leadSubmitted,
    inboxItemId,
    leadCreated: leadSubmitted,
  };
}
