import { revalidatePath } from "next/cache";
import { zonedWallTimeToUtc } from "@/lib/datetime";
import type { FieldJob } from "@/lib/field/days";
import { ensureLeadWorkOrder } from "@/lib/field/job-invoice";
import { formatJobNumber } from "@/lib/field/job-invoice-types";
import { notifyTechnicianJobAssigned } from "@/lib/notify/tech-job";
import {
  findWindowForSheetTime,
  nextArrivalWindow,
  resolveOpenArrivalWindow,
  sheetTimeForWindow,
  type ScheduleWindow,
} from "@/lib/schedule/windows";
import { syncSheetLeadToFieldJob } from "@/lib/sheet/sync-job-from-sheet";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  championSheetDateForParse,
  parseChampionTelegramMessage,
  splitChampionTelegramJobs,
  type ChampionTelegramParsed,
} from "@/lib/telegram/champion-parse";

const FALLBACK_PARTNER = "Champion Garage Doors Service";
const DEFAULT_TECH = "Sam";

export type ChampionTelegramIngestResult =
  | {
      ok: true;
      leadId: string;
      jobNumber: string;
      partnerName: string;
      technician: string;
      sheetDate: string;
      sheetTime: string;
      windowLabel: string;
      parsed: ChampionTelegramParsed;
      duplicate?: boolean;
    }
  | { ok: false; error: string; parsed?: ChampionTelegramParsed };

async function resolveChampionPartnerName(): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data: partners } = await admin
    .from("partners")
    .select("id, name")
    .ilike("name", "%champion%")
    .limit(1);
  return partners?.[0]?.name || FALLBACK_PARTNER;
}

export async function resolveChampionTechnician(): Promise<{
  id: string;
  name: string;
} | null> {
  const want = (process.env.TELEGRAM_CHAMPION_TECH_NAME || DEFAULT_TECH).trim().toLowerCase();
  if (!want) return null;
  const admin = getSupabaseAdmin();
  const { data: techs } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "technician");
  const list = techs || [];
  const exact = list.find((t) => (t.full_name || "").trim().toLowerCase() === want);
  if (exact) return { id: exact.id, name: exact.full_name || DEFAULT_TECH };
  const firstName = list.find((t) => {
    const full = (t.full_name || "").trim().toLowerCase();
    return full.split(/\s+/)[0] === want;
  });
  if (firstName) return { id: firstName.id, name: firstName.full_name || DEFAULT_TECH };
  return null;
}

export async function findLeadIdByTelegramMessage(
  chatId: string,
  messageId: number,
  jobIndex = 0,
): Promise<string | null> {
  if (!chatId || !messageId) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("leads")
    .select("id")
    .contains("metadata", {
      telegramChatId: String(chatId),
      telegramMessageId: messageId,
      telegramJobIndex: jobIndex,
    })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function loadTechJobsAround(techId: string, dayKey: string): Promise<FieldJob[]> {
  const admin = getSupabaseAdmin();
  const [y, mo, d] = dayKey.split("-").map(Number);
  const start = zonedWallTimeToUtc(y, mo, d, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
  const { data } = await admin
    .from("jobs")
    .select(
      "id, title, status, zip, address, notes, scheduled_start, scheduled_end, technician_id",
    )
    .eq("technician_id", techId)
    .neq("status", "cancelled")
    .gte("scheduled_start", start.toISOString())
    .lt("scheduled_start", end.toISOString());
  return (data || []) as FieldJob[];
}

function preferredWindowForParsed(
  parsed: ChampionTelegramParsed,
  now: Date,
): { window: ScheduleWindow; dayKey: string } {
  const dayKey = championSheetDateForParse(parsed, now);
  const fromSheet = findWindowForSheetTime(parsed.sheetTime);
  if (fromSheet) return { window: fromSheet, dayKey };
  const next = nextArrivalWindow(now, 60);
  return { window: next.window, dayKey: next.dayKey };
}

function reserveSlotJob(
  techId: string,
  dayKey: string,
  window: ScheduleWindow,
  index: number,
): FieldJob {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const start = zonedWallTimeToUtc(y, mo, d, window.startHour, 0, 0);
  return {
    id: `reserve-${index}-${dayKey}-${window.id}`,
    title: "Reserved",
    status: "assigned",
    zip: null,
    address: null,
    notes: null,
    scheduled_start: start.toISOString(),
    scheduled_end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    technician_id: techId,
  };
}

async function ingestOneChampionJob(input: {
  text: string;
  chatId: string;
  messageId: number;
  jobIndex: number;
  fromUsername?: string;
  now?: Date;
  reservedSlots?: FieldJob[];
}): Promise<ChampionTelegramIngestResult> {
  const now = input.now || new Date();
  const parsed = parseChampionTelegramMessage(input.text, now);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const admin = getSupabaseAdmin();
  const existingId = await findLeadIdByTelegramMessage(
    input.chatId,
    input.messageId,
    input.jobIndex,
  );
  const tech = await resolveChampionTechnician();
  const technicianName = tech?.name || process.env.TELEGRAM_CHAMPION_TECH_NAME || DEFAULT_TECH;

  const preferred = preferredWindowForParsed(parsed, now);
  let sheetDate = preferred.dayKey;
  let sheetTime = sheetTimeForWindow(preferred.window);
  let windowLabel = preferred.window.label;

  if (tech?.id) {
    const dbJobs = await loadTechJobsAround(tech.id, preferred.dayKey);
    const open = resolveOpenArrivalWindow({
      jobs: [...dbJobs, ...(input.reservedSlots || [])],
      techId: tech.id,
      dayKey: preferred.dayKey,
      preferred: preferred.window,
    });
    sheetDate = open.dayKey;
    sheetTime = open.sheetTime;
    windowLabel = open.window.label;
    input.reservedSlots?.push(
      reserveSlotJob(tech.id, open.dayKey, open.window, input.jobIndex),
    );
  }

  const parsedWithSlot: ChampionTelegramParsed = {
    ...parsed,
    sheetTime,
    windowLabel,
    timeAuto: parsed.timeAuto || sheetTime !== parsed.sheetTime,
  };

  if (existingId) {
    let jobNumber = "";
    try {
      const wo = await ensureLeadWorkOrder({ leadId: existingId });
      jobNumber = formatJobNumber(wo.jobNumber);
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      leadId: existingId,
      jobNumber,
      partnerName: await resolveChampionPartnerName(),
      technician: technicianName,
      sheetDate,
      sheetTime,
      windowLabel,
      parsed: parsedWithSlot,
      duplicate: true,
    };
  }

  const partnerName = await resolveChampionPartnerName();
  const meta = {
    workSource: "Partner",
    partnerName,
    leadSource: "",
    leadCost: "",
    sheetDate,
    sheetTime,
    clientName: parsed.clientName,
    clientAddress: parsed.clientAddress,
    jobStatus: "Scheduled",
    jobType: parsed.description.slice(0, 120),
    service: "",
    parts: "",
    paymentType: "",
    checkNumber: "",
    jobCost: "",
    bankFee: "",
    partsCost: "",
    technician: technicianName,
    techSalary: "",
    description: parsed.description,
    zip: parsed.zip,
    telegramChatId: String(input.chatId),
    telegramMessageId: input.messageId,
    telegramJobIndex: input.jobIndex,
    telegramFrom: input.fromUsername || "",
    telegramText: input.text.trim(),
    telegramIngest: "champion",
    timeAuto: parsedWithSlot.timeAuto,
    windowLabel,
    jobCostHint: parsed.jobCostHint,
  };

  const insertPayload = {
    name: parsed.clientName,
    phone: null as string | null,
    zip: parsed.zip || null,
    address: parsed.clientAddress,
    source: partnerName,
    lead_type: "champion_telegram",
    message: input.text.trim(),
    problem: parsed.description || null,
    deal_title: parsed.description.slice(0, 120) || null,
    deal_price: null as string | null,
    stage: "scheduled" as const,
    assigned_to: tech?.id || null,
    metadata: meta,
  };

  let { data: createdLead, error: insErr } = await admin
    .from("leads")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insErr && /address/i.test(insErr.message)) {
    const { address: _a, ...rest } = insertPayload;
    const retry = await admin.from("leads").insert(rest).select("id").single();
    createdLead = retry.data;
    insErr = retry.error;
  }

  if (insErr || !createdLead) {
    return {
      ok: false,
      error: insErr?.message || "Could not create Sheet row",
      parsed: parsedWithSlot,
    };
  }

  let jobNumber = "";
  try {
    const wo = await ensureLeadWorkOrder({ leadId: createdLead.id });
    jobNumber = formatJobNumber(wo.jobNumber);
  } catch (err) {
    console.error("[champion-telegram] job number", err);
  }

  if (tech?.id) {
    const synced = await syncSheetLeadToFieldJob({
      leadId: createdLead.id,
      date: sheetDate,
      time: sheetTime,
      technicianId: tech.id,
      technicianName,
      jobStatus: "Scheduled",
      clientName: parsed.clientName,
      clientAddress: parsed.clientAddress,
      zip: parsed.zip,
      notes: parsed.description,
    });
    if (!synced.ok) {
      console.error("[champion-telegram] field sync", synced.error);
    } else if (synced.jobId) {
      await admin
        .from("jobs")
        .update({ status: "assigned", updated_at: new Date().toISOString() })
        .eq("id", synced.jobId);
    }
    await notifyTechnicianJobAssigned({
      technicianId: tech.id,
      clientName: parsed.clientName,
      address: parsed.clientAddress,
      zip: parsed.zip,
      date: sheetDate,
      timeLabel: windowLabel || sheetTime,
      service: parsed.description.slice(0, 80) || "Champion job",
      jobNumber,
    }).catch((err) => console.error("[champion-telegram] tech notify", err));
  } else {
    console.warn("[champion-telegram] technician Sam not found in profiles");
  }

  revalidatePath("/sheet");
  revalidatePath("/crm");
  revalidatePath("/dispatch");
  revalidatePath("/field");
  revalidatePath("/schedule");

  return {
    ok: true,
    leadId: createdLead.id,
    jobNumber,
    partnerName,
    technician: technicianName,
    sheetDate,
    sheetTime,
    windowLabel,
    parsed: parsedWithSlot,
  };
}

export async function ingestChampionTelegramJob(input: {
  text: string;
  chatId: string;
  messageId: number;
  fromUsername?: string;
  now?: Date;
}): Promise<ChampionTelegramIngestResult> {
  return ingestOneChampionJob({ ...input, jobIndex: 0, reservedSlots: [] });
}

export async function ingestChampionTelegramJobs(input: {
  text: string;
  chatId: string;
  messageId: number;
  fromUsername?: string;
  now?: Date;
}): Promise<ChampionTelegramIngestResult[]> {
  const now = input.now || new Date();
  const texts = splitChampionTelegramJobs(input.text);
  const reservedSlots: FieldJob[] = [];
  const results: ChampionTelegramIngestResult[] = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(
      await ingestOneChampionJob({
        text: texts[i]!,
        chatId: input.chatId,
        messageId: input.messageId,
        jobIndex: i,
        fromUsername: input.fromUsername,
        now,
        reservedSlots,
      }),
    );
  }
  return results;
}
