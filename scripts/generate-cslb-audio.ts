/**
 * Generate English MP3s for CSLB practice questions via ElevenLabs.
 *
 * Requires in .env.local (never commit the key):
 *   ELEVENLABS_API_KEY=
 *   ELEVENLABS_VOICE_ID=   (optional; defaults to a premade US voice)
 *
 *   npx tsx scripts/generate-cslb-audio.ts
 *   npx tsx scripts/generate-cslb-audio.ts --force
 */

import fs from "fs";
import path from "path";
import { CSLB_QUESTIONS } from "../lib/cslb/questions";

const OUTPUT_DIR = path.join(process.cwd(), "public/audio/cslb");
const DEFAULT_VOICE_ID = "nPczCjzI2devNBz1zQrb";
const ELEVENLABS_API = "https://api.elevenlabs.io/v1/text-to-speech";
const REQUEST_DELAY_MS = 400;
const SPEECH_SPEED = 0.93;

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function synthesizeMp3(
  text: string,
  apiKey: string,
  voiceId: string,
): Promise<Buffer> {
  const url = `${ELEVENLABS_API}/${voiceId}?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        speed: SPEECH_SPEED,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs ${response.status}: ${detail.slice(0, 300) || response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    console.error("Add ELEVENLABS_API_KEY to .env.local (do not commit the key).");
    process.exit(1);
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const force = process.argv.includes("--force");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let written = 0;
  let skipped = 0;

  for (const question of CSLB_QUESTIONS) {
    const dest = path.join(OUTPUT_DIR, `${question.id}.mp3`);
    if (!force && fs.existsSync(dest)) {
      skipped += 1;
      continue;
    }

    const buffer = await synthesizeMp3(question.textEn, apiKey, voiceId);
    fs.writeFileSync(dest, buffer);
    written += 1;
    console.log(`wrote ${question.id}.mp3`);
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`CSLB audio done. wrote=${written} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
