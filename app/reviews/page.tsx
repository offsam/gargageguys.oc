import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ReviewsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "office") redirect("/owner");

  const supabase = await createSupabaseServerClient();
  const [{ data: reviewSnapshots }, { data: reviews }] = await Promise.all([
    supabase.from("review_snapshots").select("*").order("source"),
    supabase
      .from("reviews")
      .select("id, source, author_name, rating, text, posted_at, owner_reply, synced_at")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(80),
  ]);

  const googleSnap = reviewSnapshots?.find((r) => r.source === "google");
  const thumbtackSnap = reviewSnapshots?.find((r) => r.source === "thumbtack");

  return (
    <BosShell
      user={user}
      active="/reviews"
      title="Reviews"
      subtitle="Google & Thumbtack reputation"
    >
      <div className="bos-grid">
        <div className="bos-card">
          <h3>Google reviews</h3>
          <div className="value">
            {googleSnap ? `${googleSnap.rating ?? "—"}★ · ${googleSnap.review_count}` : "—"}
          </div>
        </div>
        <div className="bos-card">
          <h3>Thumbtack reviews</h3>
          <div className="value">
            {thumbtackSnap
              ? `${thumbtackSnap.rating ?? "—"}★ · ${thumbtackSnap.review_count}`
              : "—"}
          </div>
        </div>
        <div className="bos-card">
          <h3>Reviews synced</h3>
          <div className="value">{reviews?.length ?? 0}</div>
        </div>
      </div>

      <h2>Recent reviews</h2>
      {!reviews?.length ? (
        <div className="bos-card">
          No reviews in DB yet. Run <code>/api/google-reviews-sync</code>.
        </div>
      ) : (
        <table className="bos-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Author</th>
              <th>Rating</th>
              <th>Text</th>
              <th>Posted</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((row) => (
              <tr key={row.id}>
                <td>{row.source}</td>
                <td>{row.author_name || "—"}</td>
                <td>{row.rating ?? "—"}</td>
                <td>{(row.text || "").slice(0, 160)}</td>
                <td>{row.posted_at ? new Date(row.posted_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </BosShell>
  );
}
