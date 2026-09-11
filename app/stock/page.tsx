import { BosShell } from "@/components/bos/BosShell";
import { FieldShell } from "@/components/bos/FieldShell";
import { StockBoard } from "@/components/bos/StockBoard";
import { requireRouteAccess } from "@/lib/auth/require";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listPartnersAction } from "@/app/actions/partners";
import { loadPartnerWarehouseOntoTech, ensureGgCatalogFromChampionList } from "@/lib/stock/ops";
import {
  ensureStockSeeded,
  loadStockState,
  masterQty,
  partnerMasterQty,
  partnerQty,
  techQty,
  warehouseQty,
} from "@/lib/stock/store";
import { buildStockReceiveHistory } from "@/lib/stock/receive-history";
import { getFieldAttentionCount } from "@/lib/field/load-attention";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string; owner?: string }>;
}) {
  const user = await requireRouteAccess("/stock");

  const params = await searchParams;
  const admin = getSupabaseAdmin();
  const [{ data: techs }, { data: allProfiles }, attentionCount] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "technician")
      .order("created_at", { ascending: true }),
    admin.from("profiles").select("id, full_name, email"),
    user.role === "technician" ? getFieldAttentionCount(user.id) : Promise.resolve(0),
  ]);

  const technicians = techs || [];
  const profileLabels = (allProfiles || []).map((p) => ({
    id: p.id,
    label: p.full_name || p.email || "Staff",
  }));
  const seedTechId = technicians[0]?.id;

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
  const isTechOnly = user.role === "technician";
  const canManage = !isTechOnly;

  const [partners, catalogOk] = await Promise.all([
    listPartnersAction(),
    isTechOnly
      ? Promise.resolve(true)
      : ensureGgCatalogFromChampionList()
          .then(() => true)
          .catch((err) => {
            console.error("[stock] champion→GG catalog", err);
            return false;
          }),
  ]);
  void catalogOk;
  let state = await loadStockState();
  const showPrices = user.role === "owner";

  // Paper counts land in partner warehouse; Field only shows/uses van — load them on.
  if (isTechOnly) {
    let movedAny = false;
    for (const partner of partners) {
      if (!partner.active || partner.id.startsWith("seed-") || !partner.has_own_stock) continue;
      const hasWarehouse = state.balances.some(
        (b) =>
          b.partnerId === partner.id &&
          b.locationType === "partner" &&
          (Number(b.qty) || 0) > 0,
      );
      if (!hasWarehouse) continue;
      const loaded = await loadPartnerWarehouseOntoTech({
        partnerId: partner.id,
        technicianId: user.id,
        createdBy: user.id,
      });
      if (loaded.ok && loaded.movedQty > 0) movedAny = true;
    }
    if (movedAny) state = await loadStockState();
  }

  const partnerIdsWithStock = new Set(
    state.balances.filter((b) => b.partnerId && (Number(b.qty) || 0) > 0).map((b) => b.partnerId as string),
  );
  const partnerWarehouses = partners
    .filter(
      (p) =>
        p.active &&
        !p.id.startsWith("seed-") &&
        (p.has_own_stock || partnerIdsWithStock.has(p.id)),
    )
    .map((p) => ({ id: p.id, name: p.name }));
  const stockOwners = [{ id: "gg", name: "Garage Guys" }, ...partnerWarehouses];
  const ownerTotals: Record<string, number> = {
    gg: state.items.reduce((sum, item) => sum + masterQty(state, item.id), 0),
  };
  for (const warehouse of partnerWarehouses) {
    ownerTotals[warehouse.id] = state.items.reduce(
      (sum, item) => sum + partnerMasterQty(state, item.id, warehouse.id),
      0,
    );
  }
  const championOwner = partnerWarehouses.find((p) => /champion/i.test(p.name));
  const ggVanTotal = state.items.reduce(
    (sum, item) => sum + techQty(state, item.id, selectedTechId),
    0,
  );
  const defaultOwner =
    ownerTotals.gg === 0 && championOwner
      ? championOwner.id
      : isTechOnly && ggVanTotal === 0 && championOwner
        ? championOwner.id
        : "gg";
  const stockOwner =
    params.owner && stockOwners.some((o) => o.id === params.owner)
      ? params.owner
      : defaultOwner;

  const rows = state.items.map((item) => {
    const vans: Record<string, number> = {};
    for (const t of technicians) {
      vans[t.id] =
        stockOwner === "gg"
          ? techQty(state, item.id, t.id)
          : techQty(state, item.id, t.id, stockOwner);
    }
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      sku: item.sku,
      master:
        stockOwner === "gg"
          ? masterQty(state, item.id)
          : partnerMasterQty(state, item.id, stockOwner),
      warehouse:
        stockOwner === "gg"
          ? warehouseQty(state, item.id)
          : partnerQty(state, item.id, stockOwner),
      van: vans[selectedTechId] ?? 0,
      vans,
      unitCostCents: item.unitCostCents,
    };
  });

  const techLabels = technicians.map((t) => ({
    id: t.id,
    label: t.full_name || t.email,
  }));
  const receiveHistory = buildStockReceiveHistory({
    movements: state.movements,
    items: state.items,
    technicians: profileLabels.length ? profileLabels : techLabels,
    technicianId: isTechOnly ? user.id : null,
    limitDays: 90,
  });

  const board = (
    <StockBoard
      rows={rows}
      technicians={techLabels}
      selectedTechId={selectedTechId}
      showPrices={showPrices}
      canManage={canManage}
      isTechOnly={isTechOnly}
      stockOwners={stockOwners}
      stockOwner={stockOwner}
      ownerTotals={ownerTotals}
      partnerWarehouseCount={partnerWarehouses.length}
      receiveHistory={receiveHistory}
    />
  );

  if (isTechOnly) {
    return (
      <FieldShell
        user={user}
        title="Stock"
        subtitle={
          stockOwner === "gg"
            ? "Your Garage Guys van · tap + when you receive parts"
            : `${stockOwners.find((o) => o.id === stockOwner)?.name || "Partner"} on your van · tap + when you receive parts`
        }
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
      subtitle="Parts inventory"
    >
      {board}
    </BosShell>
  );
}
