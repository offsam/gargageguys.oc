#!/usr/bin/env node
/**
 * Upsert Champion Sheet jobs from the address + job-cost list.
 * Dates left empty for manual fill.
 *
 *   vercel env run --environment production -- node scripts/fill_champion_jobs.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url.startsWith("http") || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const PARTNER = "Champion Garage Doors Service";

/** @type {{ address: string; jobCost: string }[]} */
const ROWS = [
  { address: "16352 Rhone Ln, Huntington Beach, CA 92647", jobCost: "850.00" },
  { address: "5292 Blackpool Rd, Westminster, CA 92683", jobCost: "600.00" },
  { address: "8901 Syracuse Ave, Anaheim, CA 92804", jobCost: "500.00" },
  { address: "19633 Miguel Ave, Cerritos, CA 90703", jobCost: "290.00" },
  { address: "21854 Barbados, Mission Viejo, CA 92692", jobCost: "1085.00" },
  { address: "6652 Churchill Dr, Huntington Beach, CA 92648", jobCost: "450.00" },
  { address: "6811 Gas Light Dr, Huntington Beach, CA 92647", jobCost: "550.00" },
  { address: "1070 S Romano Way, Anaheim, CA 92808", jobCost: "360.00" },
  { address: "8670 Meadow Brook Ave, Garden Grove, CA 92844", jobCost: "690.00" },
  { address: "6312 Doral Dr, Huntington Beach, CA 92648", jobCost: "570.00" },
  { address: "4058 Av. Sevilla, Cypress, CA 90630", jobCost: "500.00" },
  { address: "8156 Silkwood Cir, Huntington Beach, CA 92646", jobCost: "700.00" },
  { address: "279 Mesa Dr, Costa Mesa, CA 92627", jobCost: "790.00" },
  { address: "6372 Reubens Dr, Huntington Beach, CA 92647", jobCost: "490.00" },
  { address: "5582 Ridgebury Dr, Huntington Beach, CA 92649", jobCost: "690.00" },
  { address: "15902 Caltech Cir, Westminster, CA 92683", jobCost: "450.00" },
  { address: "307 33rd St, Newport Beach, CA 92663", jobCost: "390.00" },
  { address: "10411 Garden Grove Blvd, Garden Grove, CA 92843", jobCost: "290.00" },
  { address: "6905 Andrew Way, Cypress, CA 90630", jobCost: "300.00" },
];

function normAddr(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\bav\.?\s+/g, "avenue ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\broad\b/g, "rd")
    .replace(/\bcir\b/g, "cir")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function streetKey(s) {
  const n = normAddr(s);
  const m = n.match(/^(\d+)\s+(.+?)\s+(?:st|ave|dr|ln|rd|cir|way|blvd|ct|pl)\b/);
  if (m) return `${m[1]} ${m[2]}`.trim();
  const m2 = n.match(/^(\d+)\s+(\S+)/);
  return m2 ? `${m2[1]} ${m2[2]}` : n.slice(0, 40);
}

function techSalary(jobCost) {
  const n = Number(String(jobCost).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return (n * 0.3).toFixed(2);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: partners } = await admin.from("partners").select("id,name").ilike("name", "%champion%");
const partnerName = partners?.[0]?.name || PARTNER;
console.log("Partner:", partnerName);

const { data: leads, error } = await admin
  .from("leads")
  .select("id, name, address, deal_price, stage, metadata, source")
  .order("created_at", { ascending: false })
  .limit(800);
if (error) {
  console.error(error);
  process.exit(1);
}

const byStreet = new Map();
for (const lead of leads || []) {
  const meta = lead.metadata && typeof lead.metadata === "object" ? lead.metadata : {};
  const addr = String(lead.address || meta.clientAddress || meta.address || "");
  if (!addr) continue;
  const key = streetKey(addr);
  if (!byStreet.has(key)) byStreet.set(key, []);
  byStreet.get(key).push({ lead, meta, addr });
}

let updated = 0;
let created = 0;
let skipped = 0;

for (const row of ROWS) {
  const key = streetKey(row.address);
  const matches = byStreet.get(key) || [];
  const existing =
    matches.find((m) => {
      const ws = String(m.meta.workSource || "");
      const pn = String(m.meta.partnerName || m.lead.source || "");
      return /partner/i.test(ws) || /champion/i.test(pn);
    }) || matches[0];

  const salary = techSalary(row.jobCost);
  if (existing) {
    const meta = { ...existing.meta };
    const alreadyCost = String(meta.jobCost || existing.lead.deal_price || "").replace(/[^0-9.]/g, "");
    const wantCost = row.jobCost.replace(/[^0-9.]/g, "");
    const alreadyPartner =
      /partner/i.test(String(meta.workSource || "")) && /champion/i.test(String(meta.partnerName || existing.lead.source || ""));
    if (alreadyPartner && alreadyCost === wantCost.replace(/\.00$/, "") || alreadyCost === wantCost) {
      console.log("SKIP (already filled)", row.address, `$${row.jobCost}`);
      skipped += 1;
      continue;
    }
    const nextMeta = {
      ...meta,
      workSource: "Partner",
      partnerName,
      clientAddress: meta.clientAddress || existing.addr || row.address,
      jobCost: row.jobCost,
      techSalary: meta.techSalary || salary,
      jobStatus: meta.jobStatus || "Waiting",
      sheetDate: meta.sheetDate || "",
    };
    const patch = {
      address: existing.lead.address || row.address,
      source: partnerName,
      deal_price: row.jobCost,
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await admin.from("leads").update(patch).eq("id", existing.lead.id);
    if (upErr) {
      console.error("UPDATE fail", row.address, upErr.message);
      continue;
    }
    console.log("UPDATE", row.address, `$${row.jobCost}`);
    updated += 1;
    continue;
  }

  const meta = {
    workSource: "Partner",
    partnerName,
    leadSource: "",
    leadCost: "",
    sheetDate: "",
    clientName: "",
    clientAddress: row.address,
    jobStatus: "Waiting",
    jobType: "",
    parts: "",
    paymentType: "",
    checkNumber: "",
    jobCost: row.jobCost,
    bankFee: "",
    partsCost: "",
    technician: "",
    techSalary: salary,
    description: "",
  };
  const insertPayload = {
    name: null,
    address: row.address,
    source: partnerName,
    lead_type: "sheet_row",
    message: null,
    deal_title: null,
    deal_price: row.jobCost,
    stage: "new",
    metadata: meta,
  };
  let { data, error: insErr } = await admin.from("leads").insert(insertPayload).select("id").single();
  if (insErr && /address/i.test(insErr.message)) {
    const { address: _a, ...rest } = insertPayload;
    const retry = await admin.from("leads").insert(rest).select("id").single();
    data = retry.data;
    insErr = retry.error;
  }
  if (insErr) {
    console.error("CREATE fail", row.address, insErr.message);
    continue;
  }
  console.log("CREATE", row.address, `$${row.jobCost}`, data?.id);
  created += 1;
}

console.log(JSON.stringify({ created, updated, skipped, total: ROWS.length, partnerName }, null, 2));
