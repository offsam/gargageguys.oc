import { timingSafeEqual } from "crypto";

export function thumbtackWebhookSecret(): string {
  return process.env.THUMBTACK_WEBHOOK_SECRET?.trim() || "";
}

export function secretsEqual(left: string, right: string): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function providedWebhookSecrets(input: {
  searchParams: URLSearchParams;
  authorization: string | null;
  headerSecret: string | null;
}): string[] {
  const out: string[] = [];
  const queryKey = input.searchParams.get("key") || input.searchParams.get("token") || "";
  if (queryKey) out.push(queryKey);

  const headerSecret = String(input.headerSecret || "").trim();
  if (headerSecret) out.push(headerSecret);

  const auth = String(input.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) out.push(token);
  } else if (auth.toLowerCase().startsWith("basic ")) {
    const encoded = auth.slice(6).trim();
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const colon = decoded.indexOf(":");
      const user = colon >= 0 ? decoded.slice(0, colon) : decoded;
      const pass = colon >= 0 ? decoded.slice(colon + 1) : "";
      if (pass) out.push(pass);
      if (user && pass) out.push(`${user}:${pass}`);
    } catch {
      /* ignore malformed basic */
    }
  }

  return out;
}

export function isThumbtackWebhookAuthorized(input: {
  searchParams: URLSearchParams;
  authorization: string | null;
  headerSecret: string | null;
  expected: string;
}): boolean {
  if (!input.expected) return false;
  return providedWebhookSecrets(input).some((secret) => secretsEqual(secret, input.expected));
}
