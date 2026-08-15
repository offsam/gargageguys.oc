#!/usr/bin/env node
/**
 * Lightweight repo smoke checks — no network, no secrets.
 * Catches missing scripts / routes that would break CI or agent deploys.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fails = [];

function ok(cond, msg) {
  if (!cond) fails.push(msg);
}

function mustExist(rel) {
  ok(existsSync(join(root, rel)), `missing required path: ${rel}`);
}

mustExist("package.json");
mustExist("middleware.ts");
mustExist("next.config.ts");
mustExist("app/login/page.tsx");
mustExist("app/owner/page.tsx");
mustExist("app/crm/page.tsx");
mustExist("app/sheet/page.tsx");
mustExist("app/finance/page.tsx");
mustExist("app/field/page.tsx");
mustExist("app/ads/page.tsx");
mustExist("app/reviews/page.tsx");
mustExist("app/api/callback/route.ts");
mustExist("app/api/ads/google-leads/route.ts");
mustExist("lib/security/cron-auth.ts");
mustExist("lib/auth/require.ts");
mustExist("supabase/migrations/202608150001_role_aware_rls.sql");
mustExist("scripts/smoke_bos_independence.mjs");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
  const m = String(cmd).match(/(?:node|tsx)\s+(\S+\.(?:mjs|js|ts))/);
  if (!m) continue;
  const scriptPath = m[1];
  ok(existsSync(join(root, scriptPath)), `npm run ${name} points to missing ${scriptPath}`);
}

const middleware = readFileSync(join(root, "middleware.ts"), "utf8");
ok(middleware.includes("updateSession"), "middleware must validate session via updateSession");
ok(!middleware.includes('c.name.includes("sb-")'), "middleware must not trust cookie-name presence alone");

const cronAuth = readFileSync(join(root, "lib/security/cron-auth.ts"), "utf8");
ok(!cronAuth.includes('x-vercel-cron") === "1"'), "cron auth must not treat x-vercel-cron as secret");

const googleLeads = readFileSync(join(root, "app/api/ads/google-leads/route.ts"), "utf8");
ok(
  googleLeads.includes("GOOGLE_ADS_LEAD_WEBHOOK_KEY is not configured") ||
    googleLeads.includes("!cfg.webhookKey"),
  "google leads webhook must fail-closed without key",
);

if (fails.length) {
  console.error("SMOKE FAILED:");
  for (const f of fails) console.error(` - ${f}`);
  process.exit(1);
}

console.log("SMOKE OK — critical BOS paths and security guards present");
