import Link from "next/link";
import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ensureStockSeeded,
  masterQty,
  techQty,
  warehouseQty,
  type StockState,
} from "@/lib/stock/store";
import {
  issueToTechAction,
  receiveStockAction,
  saveItemCostAction,
} from "@/app/actions/stock";

type View = "master" | "warehouse" | "tech";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function categories(state: StockState) {
  return [...new Set(state.items.map((i) => i.category))];
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tech?: string; cat?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const admin = getSupabaseAdmin();
  const { data: techs } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "technician")
    .order("created_at", { ascending: true });

  const technicians = techs || [];
  const seedTechId = technicians[0]?.id;
  if (!seedTechId) {
    return (
      <BosShell user={user} active="/stock" title="Stock" subtitle="Parts inventory">
        <div className="bos-card">
          Create a technician in Employees first — inventory seeds onto their van.
        </div>
      </BosShell>
    );
  }

  const state = await ensureStockSeeded(seedTechId);
  const showPrices = user.role === "owner";
  const isTechOnly = user.role === "technician";

  const view: View = isTechOnly
    ? "tech"
    : params.view === "warehouse"
      ? "warehouse"
      : params.view === "tech"
        ? "tech"
        : "master";

  const selectedTechId = isTechOnly
    ? user.id
    : params.tech && technicians.some((t) => t.id === params.tech)
      ? params.tech
      : seedTechId;

  const selectedTech = technicians.find((t) => t.id === selectedTechId);
  const cat = params.cat || "all";
  const cats = categories(state);

  const rows = state.items
    .filter((item) => cat === "all" || item.category === cat)
    .map((item) => {
      const master = masterQty(state, item.id);
      const warehouse = warehouseQty(state, item.id);
      const van = techQty(state, item.id, selectedTechId);
      const qty = view === "master" ? master : view === "warehouse" ? warehouse : van;
      return { item, master, warehouse, van, qty };
    })
    .filter((row) => (isTechOnly ? true : true));

  const title =
    view === "master"
      ? "Master Stock"
      : view === "warehouse"
        ? "Warehouse"
        : `Van · ${selectedTech?.full_name || selectedTech?.email || "Tech"}`;

  return (
    <BosShell
      user={user}
      active="/stock"
      title="Stock"
      subtitle={
        isTechOnly
          ? "Your van inventory (no prices)"
          : "Master = warehouse + all vans · prices for owner"
      }
    >
      {!isTechOnly ? (
        <div className="sheet-toolbar bos-card" style={{ gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(
              [
                ["master", "Master"],
                ["warehouse", "Warehouse"],
                ["tech", "Technicians"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={`/stock?view=${key}${key === "tech" ? `&tech=${selectedTechId}` : ""}${cat !== "all" ? `&cat=${encodeURIComponent(cat)}` : ""}`}
                className={`bos-badge ${view === key ? "scheduled" : "new"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          {view === "tech" ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {technicians.map((t) => (
                <Link
                  key={t.id}
                  href={`/stock?view=tech&tech=${t.id}${cat !== "all" ? `&cat=${encodeURIComponent(cat)}` : ""}`}
                  className={`bos-badge ${t.id === selectedTechId ? "qualified" : "new"}`}
                >
                  {t.full_name || t.email}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="sheet-toolbar bos-card" style={{ marginTop: 12 }}>
        <div>
          <strong>{title}</strong>
          <p>
            {rows.length} items · seeded on van of{" "}
            {technicians[0]?.full_name || technicians[0]?.email}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Link
            href={`/stock?view=${view}${view === "tech" ? `&tech=${selectedTechId}` : ""}`}
            className={`bos-badge ${cat === "all" ? "scheduled" : "new"}`}
          >
            All
          </Link>
          {cats.map((c) => (
            <Link
              key={c}
              href={`/stock?view=${view}${view === "tech" ? `&tech=${selectedTechId}` : ""}&cat=${encodeURIComponent(c)}`}
              className={`bos-badge ${cat === c ? "scheduled" : "new"}`}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      <table className="bos-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            {view === "master" ? (
              <>
                <th>Master</th>
                <th>Warehouse</th>
                <th>Van</th>
              </>
            ) : (
              <th>Qty</th>
            )}
            {showPrices ? <th>Unit cost</th> : null}
            {!isTechOnly ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, master, warehouse, van, qty }) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
                {item.subcategory ? (
                  <div style={{ color: "var(--bos-muted)", fontSize: "0.8rem" }}>
                    {item.subcategory}
                  </div>
                ) : null}
              </td>
              <td>{item.category}</td>
              {view === "master" ? (
                <>
                  <td>{master}</td>
                  <td>{warehouse}</td>
                  <td>{van}</td>
                </>
              ) : (
                <td>
                  <span className={`bos-badge ${qty === 0 ? "qualified" : "scheduled"}`}>
                    {qty}
                  </span>
                </td>
              )}
              {showPrices ? (
                <td>
                  <form action={saveItemCostAction} style={{ display: "flex", gap: 4 }}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input
                      name="unitCost"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={(item.unitCostCents / 100).toFixed(2)}
                      style={{ width: 88 }}
                    />
                    <button type="submit">Save</button>
                  </form>
                </td>
              ) : null}
              {!isTechOnly ? (
                <td>
                  <div style={{ display: "grid", gap: 6 }}>
                    <form action={receiveStockAction} style={{ display: "flex", gap: 4 }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="destination" value="warehouse" />
                      <input name="qty" type="number" min="1" defaultValue={1} style={{ width: 56 }} />
                      <button type="submit">+ Warehouse</button>
                    </form>
                    <form action={receiveStockAction} style={{ display: "flex", gap: 4 }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="destination" value="tech" />
                      <input type="hidden" name="technicianId" value={selectedTechId} />
                      <input name="qty" type="number" min="1" defaultValue={1} style={{ width: 56 }} />
                      <button type="submit">+ Van</button>
                    </form>
                    <form action={issueToTechAction} style={{ display: "flex", gap: 4 }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="technicianId" value={selectedTechId} />
                      <input name="qty" type="number" min="1" defaultValue={1} style={{ width: 56 }} />
                      <button type="submit">Issue → van</button>
                    </form>
                    {showPrices && item.unitCostCents > 0 ? (
                      <div style={{ fontSize: "0.75rem", color: "var(--bos-muted)" }}>
                        Ext {money(item.unitCostCents * master)}
                      </div>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </BosShell>
  );
}
