import { COMPANY, invoicePublicUrl } from "@/lib/finance/company";
import { formatJobNumber, money, type JobInvoice } from "@/lib/field/job-invoice-types";

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function workDateLabel(invoice: JobInvoice) {
  const raw = invoice.completed_at || invoice.signed_at || invoice.created_at;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function buildInvoiceEmail(invoice: JobInvoice, note?: string) {
  const jobNo = formatJobNumber(invoice.job_number);
  const url = invoicePublicUrl(invoice.public_token);
  const paid = invoice.status === "complete" || invoice.status === "signed";
  const address = [invoice.client_address, invoice.client_zip].filter(Boolean).join(", ");
  const discountTotal = invoice.lines.reduce(
    (sum, line) => sum + (Number(line.discountCents) || 0),
    0,
  );
  const rows = invoice.lines
    .map((line) => {
      const discount = Number(line.discountCents) || 0;
      const listCents = Number(line.listCents) || line.unitCents;
      const discountNote =
        discount > 0
          ? `<br/><span style="color:#067647;font-size:11px;">Client discount −${money(discount)} (was ${money(listCents)})</span>`
          : "";
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${esc(line.name)}${discountNote}<br/><span style="color:#6b7280;font-size:11px;">${line.kind === "part" ? "Part" : "Labor"}</span></td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">${line.qty}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${money(line.unitCents)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:700;">${money(line.totalCents)}</td>
        </tr>`;
    })
    .join("");

  const noteHtml = note?.trim()
    ? `<p style="margin:0 0 16px;font-size:14px;color:#111827;">${esc(note.trim()).replace(/\n/g, "<br/>")}</p>`
    : "";

  const html = `
  <div style="background:#e5e7eb;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #d1d5db;padding:28px 28px 22px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
        <tr>
          <td>
            <div style="font-size:11px;letter-spacing:.14em;color:#1e3a5f;font-weight:700;font-family:Arial,sans-serif;">GARAGE GUYS</div>
            <div style="font-size:13px;color:#4b5563;margin-top:4px;">${COMPANY.tagline}<br/>${COMPANY.area} · ${COMPANY.phone}</div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="font-size:22px;letter-spacing:.12em;color:#1e3a5f;font-weight:700;font-family:Arial,sans-serif;">INVOICE</div>
            <div style="font-size:13px;color:#111827;margin-top:6px;">${esc(jobNo)}<br/>${workDateLabel(invoice)}</div>
            ${paid ? `<div style="margin-top:8px;display:inline-block;border:2px solid #067647;color:#067647;font-size:11px;letter-spacing:.12em;padding:3px 8px;font-family:Arial,sans-serif;font-weight:700;">PAID</div>` : ""}
          </td>
        </tr>
      </table>
      <div style="height:3px;background:#c9a227;margin:0 0 18px;"></div>
      ${noteHtml}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="vertical-align:top;width:50%;">
            <div style="font-size:10px;letter-spacing:.12em;color:#6b7280;font-family:Arial,sans-serif;">BILL TO</div>
            <div style="font-size:14px;color:#111827;margin-top:4px;"><strong>${esc(invoice.client_name || "Customer")}</strong><br/>${esc(invoice.client_phone || "")}<br/>${esc(address)}</div>
          </td>
          <td style="vertical-align:top;width:50%;">
            <div style="font-size:10px;letter-spacing:.12em;color:#6b7280;font-family:Arial,sans-serif;">PAYMENT</div>
            <div style="font-size:14px;color:#111827;margin-top:4px;">${esc(invoice.payment_type || "—")}<br/>Total due ${money(invoice.total_cents)}</div>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background:#1e3a5f;color:#fff;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.08em;">
          <th align="left" style="padding:8px 10px;">Description</th>
          <th align="center" style="padding:8px 10px;">Qty</th>
          <th align="right" style="padding:8px 10px;">Rate</th>
          <th align="right" style="padding:8px 10px;">Amount</th>
        </tr>
        ${rows}
      </table>
      <p style="text-align:right;margin:14px 0 0;font-size:13px;color:#067647;">${
        discountTotal > 0 ? `Client discount −${money(discountTotal)}` : ""
      }</p>
      <p style="text-align:right;margin:6px 0 0;font-size:18px;"><strong>Total ${money(invoice.total_cents)}</strong></p>
      <p style="margin:22px 0 0;font-size:13px;color:#4b5563;">
        View / print this invoice: <a href="${esc(url)}">${esc(url)}</a>
      </p>
      <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">
        ${COMPANY.name} · ${COMPANY.city} · ${COMPANY.phone} · ${COMPANY.website}
      </p>
    </div>
  </div>`;

  const text = [
    `${COMPANY.name} invoice ${jobNo}`,
    `Work date: ${workDateLabel(invoice)}`,
    `Bill to: ${invoice.client_name || "Customer"}`,
    invoice.client_phone || "",
    address,
    `Total: ${money(invoice.total_cents)}`,
    invoice.payment_type ? `Payment: ${invoice.payment_type}` : "",
    note?.trim() || "",
    `View invoice: ${url}`,
    `${COMPANY.phone} · ${COMPANY.website}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Invoice ${jobNo} from ${COMPANY.name}`,
    html,
    text,
  };
}
