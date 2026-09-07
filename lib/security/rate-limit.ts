import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

type Bucket = { count: number; resetAt: number };
type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

const buckets = new Map<string, Bucket>();

/**
 * In-memory fallback only — a fresh serverless instance gets a fresh Map, so
 * on its own this never actually bounds request volume in production. It
 * exists purely as a best-effort backstop for local dev or a Supabase outage.
 */
function rateLimitInMemory(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true };
}

/**
 * Rate limit shared across every serverless instance via a Postgres counter
 * (see migration 202609070002_rate_limits.sql). Falls back to the in-memory
 * limiter if Supabase isn't configured or the RPC call fails, so a DB hiccup
 * degrades to best-effort rather than taking the endpoint down.
 */
export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return rateLimitInMemory(key, { limit, windowMs });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .rpc("check_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: Math.ceil(windowMs / 1000),
      })
      .single<{ allowed: boolean; retry_after_seconds: number }>();

    if (error || !data) {
      console.error("[rate-limit] RPC failed, falling back to in-memory", error);
      return rateLimitInMemory(key, { limit, windowMs });
    }

    return data.allowed ? { ok: true } : { ok: false, retryAfterSec: data.retry_after_seconds };
  } catch (err) {
    console.error("[rate-limit] RPC threw, falling back to in-memory", err);
    return rateLimitInMemory(key, { limit, windowMs });
  }
}

export function clientIp(request: { headers: Headers }): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
