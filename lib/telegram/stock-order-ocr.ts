/**
 * Telegram file download + vision OCR for Stock order screenshots.
 * Dry-run pipe does not write Stock — OCR + parse + catalog match only.
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
] as const;

export async function downloadTelegramFile(fileId: string): Promise<{
  bytes: Buffer;
  mimeType: string;
  filePath: string;
}> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN missing");

  const metaRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { cache: "no-store" },
  );
  const metaJson = (await metaRes.json()) as {
    ok?: boolean;
    result?: { file_path?: string };
    description?: string;
  };
  if (!metaRes.ok || !metaJson.ok || !metaJson.result?.file_path) {
    throw new Error(metaJson.description || "Telegram getFile failed");
  }
  const filePath = metaJson.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
    cache: "no-store",
  });
  if (!fileRes.ok) throw new Error(`Telegram file download failed (${fileRes.status})`);
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  const lower = filePath.toLowerCase();
  const mimeType = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return { bytes, mimeType, filePath };
}

async function ocrWithGroq(dataUrl: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY missing");

  const prompt = [
    "Extract ALL visible text from this stock order screenshot exactly.",
    "Preserve line breaks. Keep quantities like x1 / x2 and po# lines.",
    "Do not invent items. Return plain text only, no markdown.",
  ].join(" ");

  let lastError: unknown;
  for (const model of GROQ_VISION_MODELS) {
    try {
      const res = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Groq vision ${model}: ${await res.text()}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = String(json.choices?.[0]?.message?.content || "").trim();
      if (text) return text;
      throw new Error("empty OCR");
    } catch (err) {
      lastError = err;
      console.warn("[stock-order-ocr] groq vision failed", model, err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Groq vision OCR failed");
}

async function ocrWithOpenAI(dataUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this stock order image. Keep line breaks and xQty / po# exactly. Plain text only.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI vision: ${await res.text()}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = String(json.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("OpenAI OCR empty");
  return text;
}

export async function ocrStockOrderImage(bytes: Buffer, mimeType: string): Promise<{
  text: string;
  provider: "groq" | "openai";
}> {
  const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
  const errors: string[] = [];

  if (process.env.GROQ_API_KEY?.trim()) {
    try {
      return { text: await ocrWithGroq(dataUrl), provider: "groq" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Groq: ${msg}`);
      console.warn("[stock-order-ocr] groq failed, trying openai", err);
    }
  } else {
    errors.push("Groq: GROQ_API_KEY not set");
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      return { text: await ocrWithOpenAI(dataUrl), provider: "openai" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`OpenAI: ${msg}`);
      console.warn("[stock-order-ocr] openai failed", err);
    }
  } else {
    errors.push("OpenAI: OPENAI_API_KEY not set");
  }

  throw new Error(`Vision OCR failed (${errors.join(" · ")})`);
}
