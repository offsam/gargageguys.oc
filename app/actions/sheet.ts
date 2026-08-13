"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type SheetSaveInput = {
  id: string;
  leadSource: string;
  leadCost: string;
  date: string;
  clientName: string;
  jobType: string;
  parts: string;
  paymentType: string;
  checkNumber: string;
  jobCost: string;
  bankFee: string;
  partsCost: string;
  techSalary: string;
};

function sheetMeta(input: SheetSaveInput) {
  return {
    leadSource: input.leadSource,
    leadCost: input.leadCost,
    sheetDate: input.date,
    clientName: input.clientName,
    jobType: input.jobType,
    parts: input.parts,
    paymentType: input.paymentType,
    checkNumber: input.checkNumber,
    jobCost: input.jobCost,
    bankFee: input.bankFee,
    partsCost: input.partsCost,
    techSalary: input.techSalary,
  };
}

function isTempId(id: string) {
  return id.startsWith("new-");
}

export async function saveSheetRowAction(
  input: SheetSaveInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Not signed in" };

  const hasContent = [
    input.leadSource,
    input.leadCost,
    input.clientName,
    input.jobType,
    input.parts,
    input.paymentType,
    input.checkNumber,
    input.jobCost,
    input.bankFee,
    input.partsCost,
    input.techSalary,
  ].some((v) => String(v || "").trim());

  if (!hasContent && isTempId(input.id)) {
    return { ok: true, id: input.id };
  }

  try {
    const admin = getSupabaseAdmin();
    const meta = sheetMeta(input);

    if (isTempId(input.id)) {
      const { data, error } = await admin
        .from("leads")
        .insert({
          name: input.clientName || null,
          source: input.leadSource || "sheet",
          lead_type: input.jobType || "sheet_row",
          message: input.jobType || input.parts || null,
          deal_title: input.jobType || null,
          deal_price: input.jobCost || null,
          stage: "new",
          metadata: meta,
        })
        .select("id")
        .single();

      if (error) return { ok: false, error: error.message };
      revalidatePath("/sheet");
      return { ok: true, id: data.id };
    }

    const { data: existing } = await admin
      .from("leads")
      .select("id, metadata")
      .eq("id", input.id)
      .maybeSingle();

    if (!existing) return { ok: false, error: "Row not found" };

    const prev =
      existing.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const { error } = await admin
      .from("leads")
      .update({
        name: input.clientName || null,
        source: input.leadSource || "sheet",
        lead_type: input.jobType || null,
        deal_title: input.jobType || null,
        deal_price: input.jobCost || null,
        message: input.jobType || input.parts || null,
        metadata: { ...prev, ...meta },
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/sheet");
    return { ok: true, id: input.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}
