const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_PRIMARY_MODEL = "llama-3.3-70b-versatile";
const GROQ_FALLBACK_POOL = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
] as const;

export type GroqMessage = { role: "system" | "user" | "assistant"; content: string };

async function callGroq(apiKey: string, model: string, messages: GroqMessage[]): Promise<string> {
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq ${model} failed: ${await response.text()}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() || "";
}

export async function callGroqWithFallback(messages: GroqMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY missing");

  let lastError: unknown;
  for (const model of [GROQ_PRIMARY_MODEL, ...GROQ_FALLBACK_POOL]) {
    try {
      return await callGroq(apiKey, model, messages);
    } catch (err) {
      lastError = err;
      console.warn("[groq] model failed", model, err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All Groq models failed");
}
