import { revalidatePath } from "next/cache";
import { ingestLead } from "@/lib/leads/ingest";
import { escapeHtml, sendTelegram } from "@/lib/notify/channels";
import { createInboxForNewReviews, upsertReviews } from "@/lib/reviews/store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  THUMBTACK_SHEET_LEAD_COST,
  type ThumbtackLeadEvent,
  type ThumbtackLeadUpdateEvent,
  type ThumbtackMessageEvent,
  type ThumbtackReviewEvent,
} from "@/lib/thumbtack/parse";

function siteBase() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "https://garageguysoc.com"
  ).replace(/\/$/, "");
}

function revalidateLeadPaths() {
  revalidatePath("/crm");
  revalidatePath("/dispatch");
  revalidatePath("/sheet");
  revalidatePath("/owner");
  revalidatePath("/reviews");
  revalidatePath("/ads");
}

export async function findLeadIdByThumbtackLead(thumbtackLeadId: string): Promise<string | null> {
  if (!thumbtackLeadId) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("leads")
    .select("id")
    .contains("metadata", { thumbtackLeadId })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function notifyNewThumbtackLead(input: ThumbtackLeadEvent) {
  const lines = [
    "<b>Garage Guys — new Thumbtack lead</b>",
    "",
    `<b>Name:</b> ${escapeHtml(input.name || "Unknown")}`,
    `<b>Phone:</b> ${escapeHtml(input.phone || "—")}`,
    `<b>ZIP:</b> ${escapeHtml(input.zip || "—")}`,
  ];
  if (input.address) lines.push(`<b>Address:</b> ${escapeHtml(input.address)}`);
  if (input.category) lines.push(`<b>Job:</b> ${escapeHtml(input.category)}`);
  if (input.message) lines.push(`<b>Details:</b> ${escapeHtml(input.message.slice(0, 800))}`);
  lines.push(`<b>Lead cost (Sheet):</b> $${THUMBTACK_SHEET_LEAD_COST}`);
  if (input.leadPrice) lines.push(`<b>Thumbtack billed:</b> ${escapeHtml(input.leadPrice)}`);
  lines.push("", `<a href="${siteBase()}/crm">Open CRM Waiting</a>`);
  await sendTelegram(lines.join("\n"));
}

export async function ingestThumbtackLeadToCrm(input: ThumbtackLeadEvent): Promise<{
  leadId: string;
  duplicate: boolean;
}> {
  const thumbtackLeadId = input.leadId;
  if (!thumbtackLeadId) throw new Error("Missing Thumbtack lead id");

  const existing = await findLeadIdByThumbtackLead(thumbtackLeadId);
  if (existing) return { leadId: existing, duplicate: true };

  const phone = input.phone || `tt-${thumbtackLeadId}`;
  const created = await ingestLead({
    name: input.name || "Thumbtack lead",
    phone,
    zip: input.zip || "00000",
    address: input.address || undefined,
    message: input.message || undefined,
    source: "Thumbtack",
    leadType: `thumbtack_${String(input.leadType || "lead").toLowerCase()}`,
    dealTitle: input.category || input.message.slice(0, 80) || "Thumbtack lead",
    jobStatus: "Waiting",
    metadata: {
      thumbtackLeadId,
      thumbtackLeadType: input.leadType || null,
      thumbtackLeadPrice: input.leadPrice || "",
      leadSource: "Thumbtack",
      leadCost: THUMBTACK_SHEET_LEAD_COST,
    },
  });

  try {
    await notifyNewThumbtackLead(input);
  } catch (error) {
    console.error("[thumbtack-lead] telegram failed", error);
  }

  revalidateLeadPaths();
  return { leadId: created.leadId, duplicate: false };
}

export async function ingestThumbtackMessage(
  input: ThumbtackMessageEvent,
): Promise<{ leadId: string | null; duplicate: boolean; skipped: boolean }> {
  const admin = getSupabaseAdmin();
  const { data: existingMsg } = await admin
    .from("inbox_items")
    .select("id, lead_id")
    .contains("payload", { thumbtackMessageId: input.messageId })
    .limit(1)
    .maybeSingle();
  if (existingMsg) {
    return { leadId: existingMsg.lead_id, duplicate: true, skipped: false };
  }

  const leadId = await findLeadIdByThumbtackLead(input.leadId);
  if (!leadId) return { leadId: null, duplicate: false, skipped: true };

  const { error } = await admin.from("inbox_items").insert({
    lead_id: leadId,
    item_type: "message",
    title: "Thumbtack message",
    body: input.text.slice(0, 2000) || null,
    source: "Thumbtack",
    payload: {
      thumbtackLeadId: input.leadId,
      thumbtackMessageId: input.messageId,
    },
    status: "new",
  });
  if (error) throw error;

  revalidateLeadPaths();
  return { leadId, duplicate: false, skipped: false };
}

export async function ingestThumbtackReview(input: ThumbtackReviewEvent): Promise<{
  duplicate: boolean;
}> {
  const created = await createInboxForNewReviews([
    {
      source: "thumbtack",
      external_id: input.reviewId,
      author_name: input.author || null,
      text: input.text || null,
    },
  ]);
  await upsertReviews([
    {
      source: "thumbtack",
      external_id: input.reviewId,
      author_name: input.author || null,
      rating: input.rating,
      text: input.text || null,
      posted_at: input.postedAt,
      raw: {
        thumbtackLeadId: input.leadId || null,
      },
    },
  ]);
  revalidateLeadPaths();
  return { duplicate: created === 0 };
}

export async function applyThumbtackLeadUpdate(input: ThumbtackLeadUpdateEvent): Promise<{
  leadId: string | null;
  skipped: boolean;
}> {
  const leadId = await findLeadIdByThumbtackLead(input.leadId);
  if (!leadId) return { leadId: null, skipped: true };

  const admin = getSupabaseAdmin();
  const { data: row } = await admin.from("leads").select("metadata").eq("id", leadId).maybeSingle();
  const metadata = (row?.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<
    string,
    unknown
  >;
  await admin
    .from("leads")
    .update({
      metadata: {
        ...metadata,
        thumbtackLeadPrice: input.leadPrice || metadata.thumbtackLeadPrice || "",
        thumbtackChargeState: input.chargeState || null,
      },
    })
    .eq("id", leadId);
  revalidateLeadPaths();
  return { leadId, skipped: false };
}

export type ThumbtackAdsLead = {
  id: string;
  name: string;
  phone: string;
  zip: string;
  address: string;
  job: string;
  stage: string;
  createdAt: string;
  leadCost: string;
  thumbtackLeadPrice: string;
  thumbtackLeadId: string;
};

function metaString(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export async function listThumbtackLeadsForAds(limit = 40): Promise<ThumbtackAdsLead[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("leads")
    .select("id, name, phone, zip, address, message, deal_title, stage, created_at, metadata")
    .eq("source", "Thumbtack")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data || []).map((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      name: row.name || "Thumbtack lead",
      phone: row.phone || "",
      zip: row.zip || "",
      address: row.address || metaString(meta, "clientAddress"),
      job: (row.deal_title || row.message || "").slice(0, 80),
      stage: row.stage || "",
      createdAt: row.created_at,
      leadCost: metaString(meta, "leadCost") || THUMBTACK_SHEET_LEAD_COST,
      thumbtackLeadPrice: metaString(meta, "thumbtackLeadPrice"),
      thumbtackLeadId: metaString(meta, "thumbtackLeadId"),
    };
  });
}
