import { revalidatePath } from "next/cache";
import { dayKeyInBusinessTz } from "@/lib/datetime";
import { ensureLeadWorkOrder } from "@/lib/field/job-invoice";
import { formatJobNumber } from "@/lib/field/job-invoice-types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  parseChampionTelegramMessage,
  type ChampionTelegramParsed,
} from "@/lib/telegram/champion-parse";

const FALLBACK_PARTNER = "Champion Garage Doors Service";

export type ChampionTelegramIngestResult =
  | {
      ok: true;
      leadId: string;
      jobNumber: string;
      partnerName: string;
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

export async function findLeadIdByTelegramMessage(
  chatId: string,
  messageId: number,
): Promise<string | null> {
  if (!chatId || !messageId) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("leads")
    .select("id")
    .contains("metadata", {
      telegramChatId: String(chatId),
      telegramMessageId: messageId,
    })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export async function ingestChampionTelegramJob(input: {
  text: string;
  chatId: string;
  messageId: number;
  fromUsername?: string;
}): Promise<ChampionTelegramIngestResult> {
  const parsed = parseChampionTelegramMessage(input.text);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const admin = getSupabaseAdmin();
  const existingId = await findLeadIdByTelegramMessage(input.chatId, input.messageId);
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
      parsed,
      duplicate: true,
    };
  }

  const partnerName = await resolveChampionPartnerName();
  const sheetDate = dayKeyInBusinessTz(new Date());
  const meta = {
    workSource: "Partner",
    partnerName,
    leadSource: "",
    leadCost: "",
    sheetDate,
    sheetTime: parsed.sheetTime,
    clientName: parsed.clientName,
    clientAddress: parsed.clientAddress,
    jobStatus: "Waiting",
    jobType: "",
    service: "",
    parts: "",
    paymentType: "",
    checkNumber: "",
    jobCost: "",
    bankFee: "",
    partsCost: "",
    technician: "",
    techSalary: "",
    description: parsed.description,
    zip: parsed.zip,
    telegramChatId: String(input.chatId),
    telegramMessageId: input.messageId,
    telegramFrom: input.fromUsername || "",
    telegramText: input.text.trim(),
    telegramIngest: "champion",
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
    deal_title: null as string | null,
    deal_price: null as string | null,
    stage: "new",
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
      parsed,
    };
  }

  let jobNumber = "";
  try {
    const wo = await ensureLeadWorkOrder({ leadId: createdLead.id });
    jobNumber = formatJobNumber(wo.jobNumber);
  } catch (err) {
    console.error("[champion-telegram] job number", err);
  }

  revalidatePath("/sheet");
  revalidatePath("/crm");
  revalidatePath("/dispatch");

  return {
    ok: true,
    leadId: createdLead.id,
    jobNumber,
    partnerName,
    parsed,
  };
}
