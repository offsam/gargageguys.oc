#!/usr/bin/env node
/**
 * Lightweight repo smoke checks — no network, no secrets.
 * Catches missing scripts / routes that would break CI or agent deploys.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INDEXNOW_KEY } from "./indexnow-key.mjs";

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
mustExist("app/stock/page.tsx");
mustExist("app/services/page.tsx");
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

mustExist("public/llms.txt");
mustExist("docs/AEO_CITATIONS_CHECKLIST.md");
mustExist("scripts/indexnow-ping.mjs");
mustExist("scripts/indexnow-key.mjs");
mustExist(`public/${INDEXNOW_KEY}.txt`);
ok(
  readFileSync(join(root, `public/${INDEXNOW_KEY}.txt`), "utf8").trim() === INDEXNOW_KEY,
  "IndexNow key file must contain the key",
);

const homepage = readFileSync(join(root, "public/index.html"), "utf8");
ok(homepage.includes('"@type": "FAQPage"'), "homepage JSON-LD must include FAQPage");
ok(homepage.includes('"@type": "HomeRepairService"'), "homepage JSON-LD must include HomeRepairService");
ok(homepage.includes('"addressLocality": "Newport Beach"'), "homepage schema address must be Newport Beach");
ok(homepage.includes("Newport Beach, CA 92660"), "homepage footer NAP must be Newport Beach, CA 92660");
ok(!homepage.includes("92780"), "homepage must not use the old Tustin ZIP");

const company = readFileSync(join(root, "lib/finance/company.ts"), "utf8");
ok(company.includes('city: "Newport Beach, CA 92660"'), "invoice COMPANY.city must be Newport Beach, CA 92660");
ok(!company.includes("92780"), "invoice COMPANY must not use the old Tustin ZIP");

const cityLanding = join(root, "public/service-areas/irvine-ca/index.html");
mustExist("public/service-areas/irvine-ca/index.html");
const cityHtml = readFileSync(cityLanding, "utf8");
ok(cityHtml.includes('"@type": "FAQPage"'), "service-areas landing must include FAQPage JSON-LD");
ok(cityHtml.includes('rel="canonical"'), "service-areas landing must include a canonical tag");
ok(
  cityHtml.includes("https://garageguysoc.com/service-areas/irvine-ca/"),
  "Irvine canonical/url must be the city hub",
);
ok(cityHtml.includes('"@type": "BreadcrumbList"'), "service-areas landing must include BreadcrumbList JSON-LD");

const problemHtml = readFileSync(join(root, "public/garage-door-wont-open/index.html"), "utf8");
ok(problemHtml.includes('rel="canonical"'), "problem landing must include a canonical tag");
ok(problemHtml.includes('"@type": "BreadcrumbList"'), "problem landing must include BreadcrumbList JSON-LD");

function parseLdJsonBlocks(html, label) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)];
  ok(blocks.length > 0, `${label} must contain ld+json`);
  for (const block of blocks) {
    try {
      JSON.parse(block[1]);
    } catch (err) {
      ok(false, `${label} has invalid JSON-LD: ${err instanceof Error ? err.message : err}`);
    }
  }
}
parseLdJsonBlocks(homepage, "public/index.html");
parseLdJsonBlocks(cityHtml, "public/service-areas/irvine-ca/index.html");
parseLdJsonBlocks(problemHtml, "public/garage-door-wont-open/index.html");

if (fails.length) {
  console.error("SMOKE FAILED:");
  for (const f of fails) console.error(` - ${f}`);
  process.exit(1);
}

console.log("SMOKE OK — critical BOS paths and security guards present");
