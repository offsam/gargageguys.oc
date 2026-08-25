/** Sheet / CRM lead cost we always apply. Thumbtack's own bill is stored separately. */
export const THUMBTACK_SHEET_LEAD_COST = "50.00";

export type JsonObject = Record<string, unknown>;

export type ThumbtackLeadEvent = {
  kind: "lead";
  leadId: string;
  name: string;
  phone: string;
  zip: string;
  address: string;
  message: string;
  leadType: string;
  category: string;
  leadPrice: string;
};

export type ThumbtackMessageEvent = {
  kind: "message";
  leadId: string;
  messageId: string;
  text: string;
};

export type ThumbtackReviewEvent = {
  kind: "review";
  reviewId: string;
  leadId: string;
  rating: number | null;
  author: string;
  text: string;
  postedAt: string | null;
};

export type ThumbtackLeadUpdateEvent = {
  kind: "lead_update";
  leadId: string;
  leadPrice: string;
  chargeState: string;
};

export type ThumbtackUnknownEvent = { kind: "unknown" };

export type ThumbtackWebhookEvent =
  | ThumbtackLeadEvent
  | ThumbtackMessageEvent
  | ThumbtackReviewEvent
  | ThumbtackLeadUpdateEvent
  | ThumbtackUnknownEvent;

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function str(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function eventTypeOf(body: JsonObject): string {
  return str(body.eventType || body.event_type || body.type || body.reviewEventType).toLowerCase();
}

function unwrap(body: JsonObject): JsonObject {
  const nested =
    asObject(body.data) ||
    asObject(body.event) ||
    asObject(body.payload) ||
    asObject(body.negotiation) ||
    asObject(body.lead);
  if (!nested) return body;
  const eventType = str(body.eventType || body.event_type || body.type);
  return eventType ? { ...nested, eventType } : nested;
}

function epochToIso(raw: unknown): string | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function detailsLines(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  const lines: string[] = [];
  for (const item of details) {
    const row = asObject(item);
    if (!row) continue;
    const question = str(row.question);
    const answer = str(row.answer);
    if (question && answer) lines.push(`${question}: ${answer}`);
    else if (answer) lines.push(answer);
  }
  return lines;
}

function locationAddress(location: JsonObject | null): { zip: string; address: string } {
  if (!location) return { zip: "", address: "" };
  const zip = str(location.zipCode || location.zip_code || location.zip);
  const parts = [
    str(location.address1 || location.address_1 || location.street),
    str(location.address2 || location.address_2),
    [str(location.city), str(location.state)].filter(Boolean).join(", "),
    zip,
  ].filter(Boolean);
  return { zip, address: parts.join(", ") };
}

function parseLead(body: JsonObject): ThumbtackLeadEvent | null {
  const customer = asObject(body.customer);
  const request = asObject(body.request);
  const categoryObj = asObject(body.category);
  const leadId = str(
    body.leadID || body.leadId || body.negotiationID || body.negotiationId || request?.requestID,
  );
  const eventType = eventTypeOf(body);
  const looksLikeLead =
    Boolean(customer || request) ||
    eventType.includes("negotiation") ||
    eventType.includes("lead");
  if (!looksLikeLead || !leadId) return null;
  if (asObject(body.message) && !customer && !request) return null;

  const loc =
    asObject(request?.location) || asObject(customer?.location) || asObject(body.location);
  const { zip, address } = locationAddress(loc);
  const category = str(request?.category || request?.title || categoryObj?.name || body.category);
  const description = str(request?.description || body.description);
  const schedule = str(request?.schedule);
  const details = detailsLines(request?.details || body.details);
  const messageParts = [
    category && category !== description ? category : "",
    description,
    schedule ? `Schedule: ${schedule}` : "",
    ...details,
  ].filter(Boolean);

  return {
    kind: "lead",
    leadId,
    name: str(customer?.name || customer?.displayName || customer?.display_name) || "Thumbtack lead",
    phone: str(customer?.phone || customer?.phoneNumber || customer?.phone_number),
    zip,
    address,
    message: messageParts.join("\n"),
    leadType: str(body.leadType || body.lead_type || "CONTACT"),
    category,
    leadPrice: str(body.leadPrice || body.lead_price || body.price),
  };
}

function parseMessage(body: JsonObject): ThumbtackMessageEvent | null {
  const message = asObject(body.message);
  const eventType = eventTypeOf(body);
  if (!message && !eventType.includes("message")) return null;
  const src = message || body;
  const leadId = str(body.leadID || body.leadId || body.negotiationID || body.negotiationId);
  const messageId = str(src.messageID || src.messageId || src.id);
  const text = str(src.text || src.body);
  if (!leadId || (!messageId && !text)) return null;
  if (asObject(body.customer) && asObject(body.request)) return null;
  return {
    kind: "message",
    leadId,
    messageId: messageId || `tt-msg-${leadId}-${text.slice(0, 24)}`,
    text,
  };
}

function parseReview(body: JsonObject): ThumbtackReviewEvent | null {
  const review = asObject(body.review);
  const eventType = eventTypeOf(body);
  if (!review && !eventType.includes("review")) return null;
  const src = review || body;
  const reviewId = str(src.reviewID || src.reviewId || src.id);
  if (!reviewId) return null;
  const ratingRaw = Number(src.rating);
  return {
    kind: "review",
    reviewId,
    leadId: str(src.leadID || src.leadId || body.leadID),
    rating: Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null,
    author: str(src.reviewerNickname || src.reviewerName || src.author_name || src.author),
    text: str(src.text),
    postedAt: epochToIso(src.createTime || src.createTimestamp) || str(src.createTime) || null,
  };
}

function parseLeadUpdate(body: JsonObject): ThumbtackLeadUpdateEvent | null {
  const leadId = str(body.leadID || body.leadId || body.negotiationID);
  if (!leadId) return null;
  if (asObject(body.customer) || asObject(body.request) || asObject(body.message) || asObject(body.review)) {
    return null;
  }
  if (body.leadPrice === undefined && body.lead_price === undefined && body.chargeState === undefined) {
    return null;
  }
  return {
    kind: "lead_update",
    leadId,
    leadPrice: str(body.leadPrice || body.lead_price),
    chargeState: str(body.chargeState || body.charge_state),
  };
}

export function classifyThumbtackWebhook(input: unknown): ThumbtackWebhookEvent {
  const root = asObject(input);
  if (!root) return { kind: "unknown" };
  const body = unwrap(root);

  const review = parseReview(body);
  if (review) return review;

  const message = parseMessage(body);
  if (message) return message;

  const lead = parseLead(body);
  if (lead) return lead;

  const update = parseLeadUpdate(body);
  if (update) return update;

  return { kind: "unknown" };
}
