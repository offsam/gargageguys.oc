import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { CHAMPION_PAPER_COUNTS } from "@/lib/stock/champion-paper-count";
import { replacePartnerStockCounts } from "@/lib/stock/ops";
import { loadStockState, partnerMasterQty } from "@/lib/stock/store";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const admin = getSupabaseAdmin();
  const { data: partners, error } = await admin.from("partners").select("id, name, has_own_stock");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const champion = (partners || []).find((p) => /champion/i.test(String(p.name || "")));
  if (!champion?.id) {
    return NextResponse.json({ error: "Champion partner not found" }, { status: 404 });
  }

  await admin
    .from("partners")
    .update({ has_own_stock: true, updated_at: new Date().toISOString() })
    .eq("id", champion.id);

  const result = await replacePartnerStockCounts({
    partnerId: champion.id,
    counts: CHAMPION_PAPER_COUNTS,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const state = await loadStockState({ skipRepair: true });
  const checks = ["Chamberlain B3010", "207*27 (red)", "218*28 (black)", "Bottom seal (blk 4\")", "LM 380UT remote"].map(
    (name) => {
      const item = state.items.find((i) => i.name === name);
      return {
        name,
        qty: item ? partnerMasterQty(state, item.id, champion.id) : null,
      };
    },
  );

  return NextResponse.json({
    ok: true,
    partner: champion.name,
    set: result.set,
    created: result.created,
    checks,
  });
}
