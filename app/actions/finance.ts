"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/supabase/types";

export async function createInvoiceAction(formData: FormData) {
  const customerId = String(formData.get("customerId") || "");
  const amount = Number(formData.get("amount") || 0);
  const description = String(formData.get("description") || "Service invoice");
  if (!customerId || !Number.isFinite(amount)) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("invoices").insert({
    customer_id: customerId,
    amount_cents: Math.round(amount * 100),
    description,
    status: "draft",
  });
  revalidatePath("/finance");
  revalidatePath("/owner");
}

export async function updateInvoiceStatusAction(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") || "");
  const status = String(formData.get("status") || "") as InvoiceStatus;
  if (!invoiceId || !status) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("invoices")
    .update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  revalidatePath("/finance");
  revalidatePath("/owner");
}
