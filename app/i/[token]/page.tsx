import { notFound } from "next/navigation";
import { getJobInvoiceByToken } from "@/lib/field/job-invoice";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { InvoiceDocument } from "@/components/bos/InvoiceDocument";
import { formatJobNumber } from "@/lib/field/job-invoice-types";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const invoice = await getJobInvoiceByToken(token);
  const job = invoice ? formatJobNumber(invoice.job_number) : "Invoice";
  return { title: `${job} · Garage Guys` };
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await getJobInvoiceByToken(token);
  if (!invoice) notFound();

  const user = await getSessionUser();
  let defaultEmail = "";
  if (user && invoice.customer_id) {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("customers")
      .select("email")
      .eq("id", invoice.customer_id)
      .maybeSingle();
    defaultEmail = data?.email?.trim() || "";
  }

  return (
    <InvoiceDocument invoice={invoice} canSend={Boolean(user)} defaultEmail={defaultEmail} />
  );
}
