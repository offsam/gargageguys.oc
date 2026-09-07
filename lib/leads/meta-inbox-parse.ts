/**
 * Parse Meta Lead Form → Messenger / Instagram inbox text, e.g.:
 *
 * Hello! I filled out your form and would like to know more about your business.
 * First name: Greg boden
 * Phone number: (562) 706-3272
 * Zip code: 92630
 * What do you need help with?: Replacing an old opener
 * Email:
 */

export type MetaInboxLeadParsed = {
  ok: true;
  name: string;
  phone: string;
  zip: string;
  email: string;
  message: string;
  fields: Record<string, string>;
};

export type MetaInboxLeadFail = { ok: false; error: string };

const LABEL_ALIASES: Record<string, string> = {
  "first name": "first_name",
  firstname: "first_name",
  "last name": "last_name",
  lastname: "last_name",
  "full name": "full_name",
  name: "full_name",
  "phone number": "phone",
  phone: "phone",
  mobile: "phone",
  "zip code": "zip_code",
  zip: "zip_code",
  email: "email",
  "e-mail": "email",
  "what do you need help with?": "what_do_you_need_help_with",
  "what do you need help with": "what_do_you_need_help_with",
  "street address": "street_address",
  address: "street_address",
};

export function isMetaInboxLeadFormText(text: string): boolean {
  const t = String(text || "");
  if (!/filled out your form/i.test(t) && !/phone number\s*:/i.test(t)) return false;
  return /(?:first name|phone number|zip code)\s*:/i.test(t);
}

function normalizeLabel(label: string): string {
  const key = label.trim().toLowerCase().replace(/\s+/g, " ");
  return LABEL_ALIASES[key] || key.replace(/\s+/g, "_").replace(/\?+$/, "");
}

export function parseMetaInboxLeadFormText(text: string): MetaInboxLeadParsed | MetaInboxLeadFail {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "Empty message" };
  if (!isMetaInboxLeadFormText(raw)) {
    return { ok: false, error: "Not a Meta lead-form inbox message" };
  }

  const fields: Record<string, string> = {};
  const lines = raw.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const m = line.match(/^([^:]{2,80}):\s*(.*)$/);
    if (!m) continue;
    const label = m[1]!.trim();
    const value = m[2]!.trim();
    if (!label || /^hello[!.,\s]/i.test(label)) continue;
    const key = normalizeLabel(label);
    if (key && value) fields[key] = value;
  }

  const first = fields.first_name || "";
  const last = fields.last_name || "";
  const name =
    fields.full_name ||
    [first, last].filter(Boolean).join(" ").trim() ||
    first ||
    "";
  const phone = fields.phone || "";
  const zip = fields.zip_code || "";
  const email = fields.email || "";
  const message =
    fields.what_do_you_need_help_with ||
    fields.message ||
    fields.notes ||
    "";

  if (!name && !phone) {
    return { ok: false, error: "No name or phone in form message" };
  }

  return {
    ok: true,
    name: name || "Meta lead",
    phone,
    zip,
    email,
    message,
    fields,
  };
}
