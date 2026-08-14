import { notFound } from "next/navigation";
import { getJobInvoiceByToken, money, formatJobNumber } from "@/lib/field/job-invoice";

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await getJobInvoiceByToken(token);
  if (!invoice) notFound();

  return (
    <main className="inv-public">
      <header>
        <p className="inv-public-brand">Garage Guys</p>
        <h1>Service invoice</h1>
        <p className="inv-public-job">Job # {formatJobNumber(invoice.job_number)}</p>
        {invoice.completed_at ? (
          <p>
            Work date:{" "}
            <strong>
              {new Date(invoice.completed_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </strong>
          </p>
        ) : null}
        <p>
          Status: <strong>{invoice.status.replace(/_/g, " ")}</strong>
        </p>
      </header>

      <section>
        <h2>Customer</h2>
        <p>{invoice.client_name || "—"}</p>
        <p>{invoice.client_phone || "—"}</p>
        <p>
          {[invoice.client_address, invoice.client_zip].filter(Boolean).join(", ") || "—"}
        </p>
      </section>

      <section>
        <h2>Items</h2>
        <ul>
          {invoice.lines.map((line) => (
            <li key={line.id}>
              <span>
                {line.qty}× {line.name}
              </span>
              <strong>{money(line.totalCents)}</strong>
            </li>
          ))}
        </ul>
        <p className="inv-public-total">
          Total <strong>{money(invoice.total_cents)}</strong>
        </p>
        {invoice.payment_type ? <p>Payment: {invoice.payment_type}</p> : null}
      </section>

      {invoice.signature_data ? (
        <section>
          <h2>Signature</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={invoice.signature_data} alt="Customer signature" />
          {invoice.signed_at ? (
            <p>Signed {new Date(invoice.signed_at).toLocaleString()}</p>
          ) : null}
        </section>
      ) : null}

      <footer>
        <p>Garage Guys · Orange County · (949) 539-0009</p>
        <p>Email/SMS delivery coming next — this page is the shareable receipt.</p>
      </footer>
    </main>
  );
}
