import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { CHAMPION_PAPER_COUNTS } from "@/lib/stock/champion-paper-count";
import { replacePartnerStockCounts } from "@/lib/stock/ops";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadStockState, partnerMasterQty } from "@/lib/stock/store";

function loadEnvFiles() {
  for (const file of [".env.vercel.local", ".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFiles();
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`Bad NEXT_PUBLIC_SUPABASE_URL (len=${url.length})`);
  }
  const admin = getSupabaseAdmin();
  const { data: partners, error } = await admin
    .from("partners")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  const champion = (partners || []).find((p) => /champion/i.test(String(p.name || "")));
  if (!champion?.id) {
    throw new Error("Champion partner not found");
  }

  const result = await replacePartnerStockCounts({
    partnerId: champion.id,
    counts: CHAMPION_PAPER_COUNTS,
  });
  if (!result.ok) throw new Error(result.error);

  const state = await loadStockState();
  const samples = CHAMPION_PAPER_COUNTS.filter((row) => row.qty > 0).slice(0, 8).map((row) => {
    const item = state.items.find((i) => i.name === row.name);
    const have = item ? partnerMasterQty(state, item.id, champion.id) : -1;
    return `${row.name}: want ${row.qty} have ${have}`;
  });

  console.log(
    JSON.stringify(
      {
        partner: champion.name,
        partnerId: champion.id,
        set: result.set,
        created: result.created,
        samples,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
