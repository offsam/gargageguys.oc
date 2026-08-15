import type { NextRequest } from "next/server";

/**
 * Authorize cron / ops routes with CRON_SECRET only.
 * Do not treat x-vercel-cron as auth — that header is not a verified secret.
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${cronSecret}`;
}
