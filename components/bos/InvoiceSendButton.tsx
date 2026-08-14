"use client";

import { useState, useTransition } from "react";
import { Mail, Printer } from "lucide-react";
import { sendInvoiceEmailAction } from "@/app/actions/finance";
import { COMPANY } from "@/lib/finance/company";

function mailtoHref(to: string, jobNumber: string, token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : COMPANY.websiteUrl;
  const url = `${origin}/i/${token}`;
  const subject = `Invoice ${jobNumber} from ${COMPANY.name}`;
  const body = `Hi,\n\nPlease find your ${COMPANY.name} invoice ${jobNumber} here:\n${url}\n\nThank you,\n${COMPANY.name}\n${COMPANY.phone}`;
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

export function InvoiceSendButton({
  token,
  defaultEmail = "",
  jobNumber,
  compact = false,
}: {
  token: string;
  defaultEmail?: string;
  jobNumber: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await sendInvoiceEmailAction({
        token,
        to: email,
        note,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Sent to ${email.trim()}`);
    });
  }

  return (
    <div className="inv-send" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={compact ? "inv-icon-btn" : "inv-toolbar-btn"}
        onClick={() => {
          setOpen((v) => !v);
          setError("");
          setMessage("");
        }}
        title="Email invoice"
        aria-label="Email invoice"
      >
        <Mail size={16} strokeWidth={2.25} />
        {compact ? null : <span>Email</span>}
      </button>
      {open ? (
        <form className="inv-send-pop" onSubmit={send}>
          <label>
            Send invoice to
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@email.com"
              autoFocus
            />
          </label>
          <label>
            Note (optional)
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thank you for choosing Garage Guys."
            />
          </label>
          {error ? <p className="inv-send-error">{error}</p> : null}
          {message ? <p className="inv-send-ok">{message}</p> : null}
          <div className="inv-send-actions">
            <button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send"}
            </button>
            <a className="inv-send-mailto" href={mailtoHref(email, jobNumber, token)}>
              Open in Mail
            </a>
            <button type="button" className="inv-send-cancel" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function InvoiceToolbar({
  token,
  canSend,
  defaultEmail,
  jobNumber,
}: {
  token: string;
  canSend: boolean;
  defaultEmail?: string;
  jobNumber: string;
}) {
  return (
    <div className="inv-doc-toolbar">
      <button type="button" className="inv-toolbar-btn" onClick={() => window.print()}>
        <Printer size={16} strokeWidth={2.25} />
        Print / PDF
      </button>
      {canSend ? (
        <InvoiceSendButton token={token} defaultEmail={defaultEmail} jobNumber={jobNumber} />
      ) : null}
    </div>
  );
}
