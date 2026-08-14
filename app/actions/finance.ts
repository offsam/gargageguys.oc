"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getJobInvoiceByToken } from "@/lib/field/job-invoice";
import { sendHtmlEmail } from "@/lib/email/send";
import { buildInvoiceEmail } from "@/lib/email/invoice-html";
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

export async function sendInvoiceEmailAction(input: {
  token: string;
  to: string;
  note?: string;
}) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const to = String(input.to || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false as const, error: "Enter a valid email address" };
  }

  const invoice = await getJobInvoiceByToken(String(input.token || ""));
  if (!invoice) return { ok: false as const, error: "Invoice not found" };

  const built = buildInvoiceEmail(invoice, input.note);
  const sent = await sendHtmlEmail({
    ...built,
    to,
    replyTo: session.email || undefined,
  });
  if (!sent.ok) return { ok: false as const, error: sent.error };

  if (invoice.finance_invoice_id) {
    const supabase = await createSupabaseServerClient();
    const { data: current } = await supabase
      .from("invoices")
      .select("status")
      .eq("id", invoice.finance_invoice_id)
      .maybeSingle();
    if (current?.status === "draft") {
      await supabase
        .from("invoices")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", invoice.finance_invoice_id);
      revalidatePath("/finance");
    }
  }

  return { ok: true as const };
}
