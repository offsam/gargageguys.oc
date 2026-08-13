import { redirect, notFound } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateJobStatusAction } from "@/app/actions/dispatch";
import { installPartsOnJobAction } from "@/app/actions/stock";
import { ensureStockSeeded, techQty } from "@/lib/stock/store";
import Link from "next/link";

export default async function FieldJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  if (user.role === "technician" && job.technician_id && job.technician_id !== user.id) {
    redirect("/field");
  }

  const techId =
    user.role === "technician" ? user.id : job.technician_id || user.id;
  const state = await ensureStockSeeded(techId);
  const vanItems = state.items
    .map((item) => ({ item, qty: techQty(state, item.id, techId) }))
    .filter((row) => row.qty > 0);

  const usedOnJob = state.movements.filter(
    (m) => m.kind === "install_on_job" && m.jobId === job.id,
  );

  return (
    <BosShell user={user} active="/field" title={job.title} subtitle="Job detail">
      <p>
        <Link href="/field">← All jobs</Link>
      </p>
      <div className="bos-card">
        <p>
          <strong>Status:</strong> {job.status}
        </p>
        <p>
          <strong>ZIP:</strong> {job.zip || "—"}
        </p>
        <p>
          <strong>Address:</strong> {job.address || "—"}
        </p>
        <p>
          <strong>Notes:</strong> {job.notes || "—"}
        </p>
        <form action={updateJobStatusAction} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input type="hidden" name="jobId" value={job.id} />
          <select name="status" defaultValue={job.status}>
            {["assigned", "en_route", "on_site", "done", "cancelled"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="submit">Update status</button>
        </form>
      </div>

      <h2 style={{ marginTop: 24 }}>Parts used</h2>
      <p style={{ color: "var(--bos-muted)" }}>
        Deducts from this tech&apos;s van (and Master). Warehouse unchanged.
      </p>
      <div className="bos-card">
        <form action={installPartsOnJobAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="technicianId" value={techId} />
          <select name="itemId" required style={{ minWidth: 220 }}>
            <option value="">Select part…</option>
            {vanItems.map(({ item, qty }) => (
              <option key={item.id} value={item.id}>
                {item.name} ({qty} on van)
              </option>
            ))}
          </select>
          <input name="qty" type="number" min={1} defaultValue={1} style={{ width: 72 }} />
          <button type="submit">Use on job</button>
        </form>
        {vanItems.length === 0 ? (
          <p style={{ marginTop: 10, color: "var(--bos-muted)" }}>
            Van has no positive stock.{" "}
            <Link href="/stock?view=tech">Check Stock</Link>
          </p>
        ) : null}
      </div>

      {usedOnJob.length > 0 ? (
        <table className="bos-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>When</th>
              <th>Part</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {usedOnJob.map((m) => {
              const item = state.items.find((i) => i.id === m.itemId);
              return (
                <tr key={m.id}>
                  <td>{new Date(m.createdAt).toLocaleString()}</td>
                  <td>{item?.name || m.itemId}</td>
                  <td>{m.qty}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </BosShell>
  );
}
