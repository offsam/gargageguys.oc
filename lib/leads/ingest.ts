import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { LeadStage } from "@/lib/supabase/types";

export type IngestLeadInput = {
  name: string;
  phone: string;
  zip: string;
  message?: string;
  source?: string;
  leadType?: string;
  dealTitle?: string;
  dealPrice?: string;
  dealId?: string;
  stage?: LeadStage;
  problem?: string;
  metadata?: Record<string, unknown>;
};

export async function ingestLead(input: IngestLeadInput) {
  const supabase = getSupabaseAdmin();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const zip = input.zip.trim();

  let customerId: string | null = null;
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing?.id) {
    customerId = existing.id;
    await supabase
      .from("customers")
      .update({ name, zip, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ name, phone, zip })
      .select("id")
      .single();
    if (error) throw error;
    customerId = created.id;
  }

  const metadata = {
    ...(input.metadata || {}),
    ...(input.dealId ? { dealId: input.dealId } : {}),
  };

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      customer_id: customerId,
      name,
      phone,
      zip,
      message: input.message || null,
      problem: input.problem || input.message || null,
      source: input.source || "website",
      lead_type: input.leadType || "callback",
      stage: input.stage || "new",
      deal_title: input.dealTitle || null,
      deal_price: input.dealPrice || null,
      metadata,
    })
    .select("id")
    .single();

  if (leadError) throw leadError;

  const title = `Lead: ${name} (${zip})`;
  const { data: inbox, error: inboxError } = await supabase
    .from("inbox_items")
    .insert({
      lead_id: lead.id,
      item_type: "lead",
      title,
      body: input.message || null,
      source: input.source || "website",
      payload: { ...input, leadId: lead.id },
      status: "new",
    })
    .select("id")
    .single();

  if (inboxError) throw inboxError;

  return { leadId: lead.id, inboxItemId: inbox.id, customerId };
}
