import { formatJobNumber, money, type JobInvoice } from "@/lib/field/job-invoice-types";
import { COMPANY } from "@/lib/finance/company";
import { InvoiceToolbar } from "@/components/bos/InvoiceSendButton";

function formatLongDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isPaid(status: JobInvoice["status"]) {
  return status === "complete" || status === "signed" || status === "payment_confirmed";
}

export function InvoiceDocument({
  invoice,
  canSend,
  defaultEmail = "",
}: {
  invoice: JobInvoice;
  canSend: boolean;
  defaultEmail?: string;
}) {
  const jobNo = formatJobNumber(invoice.job_number);
  const workDate = formatLongDate(invoice.completed_at || invoice.signed_at || invoice.created_at);
  const paid = isPaid(invoice.status);
  const address = [invoice.client_address, invoice.client_zip].filter(Boolean).join(", ");
  const services = invoice.lines.filter((l) => l.kind !== "part");
  const parts = invoice.lines.filter((l) => l.kind === "part");
  const ordered = [...services, ...parts];
  const discountTotal = ordered.reduce(
    (sum, line) => sum + (Number(line.discountCents) || 0),
    0,
  );

  return (
    <div className="inv-doc-page">
      <InvoiceToolbar
        token={invoice.public_token}
        canSend={canSend}
        defaultEmail={defaultEmail}
        jobNumber={jobNo}
      />
      <article className="inv-doc-sheet">
        <header className="inv-doc-letterhead">
          <div>
            <p className="inv-doc-mark">GG</p>
            <div>
              <p className="inv-doc-brand">{COMPANY.name}</p>
              <p className="inv-doc-tag">{COMPANY.tagline}</p>
              <p className="inv-doc-contact">
                {COMPANY.area}
                <br />
                {COMPANY.city}
                <br />
                {COMPANY.phone}
                <br />
                {COMPANY.website}
              </p>
            </div>
          </div>
          <div className="inv-doc-titleblock">
            <p className="inv-doc-kicker">Invoice</p>
            <p className="inv-doc-number">{jobNo}</p>
            <dl>
              <div>
                <dt>Work date</dt>
                <dd>{workDate}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{invoice.payment_type || "—"}</dd>
              </div>
            </dl>
            {paid ? <p className="inv-doc-paid">Paid in full</p> : null}
          </div>
        </header>

        <div className="inv-doc-rule" />

        <section className="inv-doc-parties">
          <div>
            <h2>Bill to</h2>
            <p className="inv-doc-name">{invoice.client_name || "Customer"}</p>
            {invoice.client_phone ? <p>{invoice.client_phone}</p> : null}
            {address ? <p>{address}</p> : null}
          </div>
          <div>
            <h2>Job location</h2>
            <p>{address || "—"}</p>
          </div>
        </section>

        <table className="inv-doc-items">
          <thead>
            <tr>
              <th>Description</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {ordered.length === 0 ? (
              <tr>
                <td colSpan={5}>No line items</td>
              </tr>
            ) : (
              ordered.map((line) => {
                const discount = Number(line.discountCents) || 0;
                const listCents = Number(line.listCents) || line.unitCents;
                return (
                <tr key={line.id}>
                  <td>
                    {line.name}
                    {discount > 0 ? (
                      <div className="inv-doc-discount">
                        Client discount −{money(discount)} (was {money(listCents)} each)
                      </div>
                    ) : null}
                  </td>
                  <td>{line.kind === "part" ? "Part" : "Labor"}</td>
                  <td>{line.qty}</td>
                  <td>{money(line.unitCents)}</td>
                  <td>{money(line.totalCents)}</td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>

        <div className="inv-doc-totals">
          <table>
            <tbody>
              <tr>
                <th>Subtotal</th>
                <td>{money(invoice.subtotal_cents || invoice.total_cents)}</td>
              </tr>
              {discountTotal > 0 ? (
                <tr>
                  <th>Client discount</th>
                  <td>−{money(discountTotal)}</td>
                </tr>
              ) : null}
              <tr className="inv-doc-grand">
                <th>Total</th>
                <td>{money(invoice.total_cents)}</td>
              </tr>
              {paid ? (
                <tr>
                  <th>Balance due</th>
                  <td>$0.00</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {invoice.signature_data ? (
          <section className="inv-doc-sign">
            <div>
              <p>Customer acknowledgment</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={invoice.signature_data} alt="Customer signature" />
              <span>
                Signed
                {invoice.signed_at ? ` ${formatLongDate(invoice.signed_at)}` : ""}
              </span>
            </div>
          </section>
        ) : null}

        <footer className="inv-doc-footer">
          <p>Thank you for your business.</p>
          <p>
            Questions about this invoice: {COMPANY.phone} · {COMPANY.website}
          </p>
        </footer>
      </article>
    </div>
  );
}
