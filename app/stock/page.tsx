import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { FieldShell } from "@/components/bos/FieldShell";
import { StockBoard } from "@/components/bos/StockBoard";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ensureStockSeeded,
  masterQty,
  techQty,
  warehouseQty,
} from "@/lib/stock/store";
import { getFieldAttentionCount } from "@/lib/field/load-attention";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string }>;
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

  const state = await ensureStockSeeded(seedTechId);
  const showPrices = user.role === "owner";
  const isTechOnly = user.role === "technician";
  const canManage = !isTechOnly;

  const rows = state.items.map((item) => {
    const vans: Record<string, number> = {};
    for (const t of technicians) {
      vans[t.id] = techQty(state, item.id, t.id);
    }
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      sku: item.sku,
      master: masterQty(state, item.id),
      warehouse: warehouseQty(state, item.id),
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
    <BosShell user={user} active="/stock" title="Stock">
      {board}
    </BosShell>
  );
}
