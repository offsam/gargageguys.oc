const RESEND_URL = "https://api.resend.com/emails";

export function isInvoiceEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendHtmlEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "Email is not configured. Add RESEND_API_KEY, or use Open in Mail.",
    };
  }

  const from =
    process.env.INVOICE_FROM_EMAIL?.trim() || "Garage Guys <beth.t@example.com>";

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo || undefined,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, error: body?.message || `Email failed (${res.status})` };
  }

  return { ok: true };
}
