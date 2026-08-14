import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { FieldShell } from "@/components/bos/FieldShell";
import { StockBoard } from "@/components/bos/StockBoard";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listPartnersAction } from "@/app/actions/partners";
import { assignCurrentStockToChampionAction } from "@/app/actions/stock";
import {
  ensureStockSeeded,
  loadStockState,
  masterQty,
  partnerQty,
  techQty,
  warehouseQty,
} from "@/lib/stock/store";
import { getFieldAttentionCount } from "@/lib/field/load-attention";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string; owner?: string }>;
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
  const attentionCount =
    user.role === "technician" ? await getFieldAttentionCount(user.id) : 0;

  if (!seedTechId) {
    const empty = (
      <div className="bos-card">
        Create a technician in Employees first — inventory seeds onto their van.
      </div>
    );
    if (user.role === "technician") {
      return (
        <FieldShell
          user={user}
          title="Stock"
          active="stock"
          attentionCount={attentionCount}
        >
          {empty}
        </FieldShell>
      );
    }
    return (
      <BosShell user={user} active="/stock" title="Stock" subtitle="Parts inventory">
        {empty}
      </BosShell>
    );
  }

  const selectedTechId =
    user.role === "technician"
      ? user.id
      : params.tech && technicians.some((t) => t.id === params.tech)
        ? params.tech
        : seedTechId;

  await ensureStockSeeded(seedTechId);

  let moveNotice = "";
  if (user.role === "owner") {
    const moved = await assignCurrentStockToChampionAction();
    if (!moved.ok && moved.error) {
      moveNotice = moved.error;
    } else if (moved.movedQty > 0) {
      moveNotice = `Moved ${moved.movedQty} units (${moved.movedItems} parts) to ${moved.partnerName || "Champion"}. Garage Guys is empty — fill it when you are ready.`;
    }
  }

  const [partners, state] = await Promise.all([listPartnersAction(), loadStockState()]);
  const showPrices = user.role === "owner";
  const isTechOnly = user.role === "technician";
  const canManage = !isTechOnly;

  const partnerWarehouses = partners
    .filter((p) => p.active && p.has_own_stock && !p.id.startsWith("seed-"))
    .map((p) => ({ id: p.id, name: p.name }));
  const stockOwners = [{ id: "gg", name: "Garage Guys" }, ...partnerWarehouses];
  const ggTotal = state.items.reduce((sum, item) => sum + masterQty(state, item.id), 0);
  const championOwner = partnerWarehouses.find((p) => /champion/i.test(p.name));
  const defaultOwner =
    ggTotal === 0 && championOwner ? championOwner.id : "gg";
  const stockOwner =
    params.owner && stockOwners.some((o) => o.id === params.owner) ? params.owner : defaultOwner;

  const rows = state.items.map((item) => {
    const vans: Record<string, number> = {};
    for (const t of technicians) {
      vans[t.id] = techQty(state, item.id, t.id);
    }
    const partnerCount = stockOwner !== "gg" ? partnerQty(state, item.id, stockOwner) : 0;
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      sku: item.sku,
      master: stockOwner === "gg" ? masterQty(state, item.id) : partnerCount,
      warehouse: stockOwner === "gg" ? warehouseQty(state, item.id) : partnerCount,
      van: vans[selectedTechId] ?? 0,
      vans,
      unitCostCents: item.unitCostCents,
    };
  });

  const board = (
    <StockBoard
      rows={rows}
      technicians={technicians.map((t) => ({
        id: t.id,
        label: t.full_name || t.email,
      }))}
      selectedTechId={selectedTechId}
      showPrices={showPrices}
      canManage={canManage}
      isTechOnly={isTechOnly}
      stockOwners={stockOwners}
      stockOwner={stockOwner}
      partnerWarehouseCount={partnerWarehouses.length}
      notice={moveNotice}
    />
  );

  if (isTechOnly) {
    return (
      <FieldShell
        user={user}
        title="Stock"
        subtitle="Your van · no prices"
        active="stock"
        attentionCount={attentionCount}
      >
        {board}
      </FieldShell>
    );
  }

  return (
    <BosShell
      user={user}
      active="/stock"
      title="Stock"
      subtitle={
        stockOwner === "gg"
          ? "Garage Guys warehouse and vans"
          : `${stockOwners.find((o) => o.id === stockOwner)?.name || "Partner"} stock`
      }
    >
      {board}
    </BosShell>
  );
}
