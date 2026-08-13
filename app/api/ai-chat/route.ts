import { NextRequest, NextResponse } from "next/server";
import { AlexError, runAlexTurn } from "@/lib/alex/run-turn";
import type { AlexChatMessage } from "@/lib/alex/types";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const ALLOWED_ORIGINS = new Set([
  "https://garageguysoc.com",
  "https://www.garageguysoc.com",
  "https://pullgaragedoor.com",
  "https://www.pullgaragedoor.com",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:3010",
  "http://127.0.0.1:3010",
]);

function cors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.has(origin) || origin.endsWith(".vercel.app")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function parseMessages(raw: unknown): AlexChatMessage[] {
  if (!Array.isArray(raw)) throw new AlexError("messages must be an array");
  const messages: AlexChatMessage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const role = record.role;
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if ((role !== "user" && role !== "assistant") || !content) continue;
    messages.push({ role, content });
  }
  if (!messages.length) throw new AlexError("messages must include at least one user message");
  if (messages[messages.length - 1].role !== "user") {
    throw new AlexError("last message must be from the user");
  }
  return messages;
}

export async function OPTIONS(request: NextRequest) {
  return cors(request, new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return cors(request, NextResponse.json({ error: "CRM database is not configured" }, { status: 503 }));
  }
  if (!process.env.GROQ_API_KEY?.trim()) {
    return cors(request, NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 503 }));
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return cors(request, NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  try {
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const messages = parseMessages(body.messages);
    const submittedInboxItemId =
      typeof body.submittedInboxItemId === "string" ? body.submittedInboxItemId.trim() : null;

    const result = await runAlexTurn({
      sessionId,
      messages,
      submittedInboxItemId,
    });

    return cors(request, NextResponse.json(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    const status = err instanceof AlexError ? 400 : 500;
    console.error("[ai-chat]", err);
    return cors(request, NextResponse.json({ error: message }, { status }));
  }
}
