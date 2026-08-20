import { escapeHtml, sendTelegram } from "@/lib/notify/channels";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type TechJobNotifyInput = {
  technicianId: string;
  clientName: string;
  address?: string | null;
  zip?: string | null;
  phone?: string | null;
  date?: string | null;
  timeLabel?: string | null;
  service?: string | null;
  jobNumber?: string | null;
};

export async function telegramChatIdForUser(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.auth.admin.getUserById(userId);
  const raw = (data.user?.app_metadata as { telegram_chat_id?: unknown } | undefined)
    ?.telegram_chat_id;
  if (typeof raw !== "string") return null;
  const chatId = raw.trim();
  return chatId || null;
}

function formatWhen(date?: string | null, timeLabel?: string | null): string {
  const d = String(date || "").trim();
  const t = String(timeLabel || "").trim();
  if (d && t) return `${d} · ${t}`;
  if (d) return d;
  if (t) return t;
  return "TBD";
}

export function buildTechJobTelegramMessage(input: TechJobNotifyInput): string {
  const lines = [
    "<b>New job assigned</b>",
    "",
    `<b>Client:</b> ${escapeHtml(input.clientName || "Client")}`,
  ];
  if (input.jobNumber) lines.push(`<b>Job #:</b> ${escapeHtml(input.jobNumber)}`);
  lines.push(`<b>When:</b> ${escapeHtml(formatWhen(input.date, input.timeLabel))}`);
  const place = [input.address, input.zip].filter(Boolean).join(", ");
  if (place) lines.push(`<b>Address:</b> ${escapeHtml(place)}`);
  if (input.phone) lines.push(`<b>Phone:</b> ${escapeHtml(input.phone)}`);
  if (input.service) lines.push(`<b>Service:</b> ${escapeHtml(input.service)}`);
  lines.push("", "Open Field in BOS for details.");
  return lines.join("\n");
}

/** Notify the technician’s Telegram when a job is assigned. No-op if chat id missing. */
export async function notifyTechnicianJobAssigned(
  input: TechJobNotifyInput,
): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!input.technicianId) return { ok: false, skipped: true };
  try {
    const chatId = await telegramChatIdForUser(input.technicianId);
    if (!chatId) {
      console.warn(
        "[telegram] tech has no telegram_chat_id",
        input.technicianId,
        input.clientName,
      );
      return { ok: false, skipped: true };
    }
    const ok = await sendTelegram(buildTechJobTelegramMessage(input), { chatId });
    return { ok };
  } catch (err) {
    console.error("[telegram] tech notify failed", err);
    return { ok: false };
  }
}
