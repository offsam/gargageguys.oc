import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ReviewSource = "google" | "thumbtack";

export type ReviewRow = {
  id?: string;
  source: ReviewSource;
  external_id: string;
  author_name?: string | null;
  rating?: number | null;
  text?: string | null;
  posted_at?: string | null;
  owner_reply?: string | null;
  raw?: Record<string, unknown>;
  synced_at?: string;
};

export type ReviewSnapshot = {
  source: ReviewSource;
  rating: number | null;
  review_count: number;
  raw?: Record<string, unknown>;
  synced_at?: string;
};

const FALLBACK = {
  google: { rating: 5.0, review_count: 7 },
  thumbtack: { rating: 5.0, review_count: 74 },
} as const;

export async function upsertReviews(rows: ReviewRow[]) {
  if (!rows.length) return [];
  const supabase = getSupabaseAdmin();
  const syncedAt = new Date().toISOString();
  const payload = rows.map((row) => ({
    source: row.source,
    external_id: row.external_id,
    author_name: row.author_name ?? null,
    rating: row.rating ?? null,
    text: row.text ?? null,
    posted_at: row.posted_at ?? null,
    owner_reply: row.owner_reply ?? null,
    raw: row.raw || {},
    synced_at: syncedAt,
    updated_at: syncedAt,
  }));

  const { data, error } = await supabase
    .from("reviews")
    .upsert(payload, { onConflict: "source,external_id" })
    .select("id, source, external_id");
  if (error) throw error;
  return data || [];
}

export async function upsertReviewSnapshot(snapshot: ReviewSnapshot) {
  const supabase = getSupabaseAdmin();
  const syncedAt = snapshot.synced_at || new Date().toISOString();
  const { data, error } = await supabase
    .from("review_snapshots")
    .upsert(
      {
        source: snapshot.source,
        rating: snapshot.rating,
        review_count: snapshot.review_count,
        raw: snapshot.raw || {},
        synced_at: syncedAt,
        updated_at: syncedAt,
      },
      { onConflict: "source" },
    )
    .select("source, rating, review_count, synced_at")
    .single();
  if (error) throw error;
  return data;
}

export async function listReviews(source?: ReviewSource, limit = 50) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("reviews")
    .select(
      "id, source, external_id, author_name, rating, text, posted_at, owner_reply, synced_at",
    )
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (source) query = query.eq("source", source);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listReviewSnapshots() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("review_snapshots")
    .select("source, rating, review_count, synced_at, raw");
  if (error) throw error;
  return data || [];
}

export async function getPublicReviewPayload(source?: ReviewSource) {
  try {
    const [snapshots, reviews] = await Promise.all([
      listReviewSnapshots(),
      listReviews(source, source ? 20 : 40),
    ]);

    const aggregates: Record<string, { rating: number; count: number }> = {
      google: { ...FALLBACK.google, count: FALLBACK.google.review_count },
      thumbtack: {
        ...FALLBACK.thumbtack,
        count: FALLBACK.thumbtack.review_count,
      },
    };

    for (const snap of snapshots) {
      aggregates[snap.source] = {
        rating: Number(snap.rating ?? FALLBACK[snap.source as ReviewSource].rating),
        count: Number(
          snap.review_count ?? FALLBACK[snap.source as ReviewSource].review_count,
        ),
      };
    }

    return {
      aggregates: {
        google: aggregates.google,
        thumbtack: aggregates.thumbtack,
      },
      reviews: source ? reviews.filter((r) => r.source === source) : reviews,
      source: "supabase",
    };
  } catch {
    return {
      aggregates: {
        google: { rating: FALLBACK.google.rating, count: FALLBACK.google.review_count },
        thumbtack: {
          rating: FALLBACK.thumbtack.rating,
          count: FALLBACK.thumbtack.review_count,
        },
      },
      reviews: [],
      source: "fallback",
    };
  }
}

export async function createInboxForNewReviews(
  rows: Array<{ source: ReviewSource; external_id: string; author_name?: string | null; text?: string | null }>,
) {
  if (!rows.length) return 0;
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("reviews")
    .select("source, external_id")
    .in(
      "external_id",
      rows.map((r) => r.external_id),
    );

  const existingKeys = new Set(
    (existing || []).map((r) => `${r.source}:${r.external_id}`),
  );
  const fresh = rows.filter((r) => !existingKeys.has(`${r.source}:${r.external_id}`));
  if (!fresh.length) return 0;

  const inboxRows = fresh.map((r) => ({
    item_type: "review",
    status: "new" as const,
    title: `New ${r.source} review${r.author_name ? ` from ${r.author_name}` : ""}`,
    body: (r.text || "").slice(0, 500),
    source: r.source,
    payload: { source: r.source, external_id: r.external_id },
  }));

  const { error } = await supabase.from("inbox_items").insert(inboxRows);
  if (error) throw error;
  return inboxRows.length;
}
