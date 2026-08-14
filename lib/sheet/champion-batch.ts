import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ensureLeadWorkOrder } from "@/lib/field/job-invoice";
import { formatJobNumber } from "@/lib/field/job-invoice-types";

export type ChampionBatchRow = { address: string; jobCost: string };

export const CHAMPION_BATCH_ROWS: ChampionBatchRow[] = [
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

const FALLBACK_PARTNER = "Champion Garage Doors Service";

function normAddr(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\bav\.?\s+/g, "avenue ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\broad\b/g, "rd")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function streetKey(s: string) {
  const n = normAddr(s);
  const m = n.match(/^(\d+)\s+(.+?)\s+(?:st|ave|dr|ln|rd|cir|way|blvd|ct|pl)\b/);
  if (m) return `${m[1]} ${m[2]}`.trim();
  const m2 = n.match(/^(\d+)\s+(\S+)/);
  return m2 ? `${m2[1]} ${m2[2]}` : n.slice(0, 40);
}

function moneyKey(raw: string) {
  const n = Number(String(raw || "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

function techSalary(jobCost: string) {
  const n = Number(String(jobCost).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return (n * 0.3).toFixed(2);
}

export async function importChampionBatchRows(rows: ChampionBatchRow[] = CHAMPION_BATCH_ROWS) {
  const admin = getSupabaseAdmin();
  const { data: partners } = await admin
    .from("partners")
    .select("id, name")
    .ilike("name", "%champion%");
  const partnerName = partners?.[0]?.name || FALLBACK_PARTNER;

  const { data: leads, error } = await admin
    .from("leads")
    .select("id, name, address, deal_price, stage, metadata, source")
    .order("created_at", { ascending: false })
    .limit(800);
  if (error) throw error;

  const byStreet = new Map<
    string,
    Array<{ lead: Record<string, unknown>; meta: Record<string, unknown>; addr: string }>
  >();
  for (const lead of leads || []) {
    const meta =
      lead.metadata && typeof lead.metadata === "object"
        ? (lead.metadata as Record<string, unknown>)
        : {};
    const addr = String(lead.address || meta.clientAddress || meta.address || "");
    if (!addr) continue;
    const key = streetKey(addr);
    const list = byStreet.get(key) || [];
    list.push({ lead: lead as Record<string, unknown>, meta, addr });
    byStreet.set(key, list);
  }

  let updated = 0;
  let created = 0;
  let skipped = 0;
  let numbered = 0;
  const log: string[] = [];

  for (const row of rows) {
    const key = streetKey(row.address);
    const matches = byStreet.get(key) || [];
    const existing =
      matches.find((m) => {
        const ws = String(m.meta.workSource || "");
        const pn = String(m.meta.partnerName || m.lead.source || "");
        return /partner/i.test(ws) || /champion/i.test(pn);
      }) || matches[0];

    const salary = techSalary(row.jobCost);
    const wantCost = moneyKey(row.jobCost);
    let leadId = "";

    if (existing) {
      leadId = String(existing.lead.id);
      const alreadyCost = moneyKey(
        String(existing.meta.jobCost || existing.lead.deal_price || ""),
      );
      const alreadyPartner =
        /partner/i.test(String(existing.meta.workSource || "")) &&
        /champion/i.test(String(existing.meta.partnerName || existing.lead.source || ""));
      if (alreadyPartner && alreadyCost === wantCost) {
        skipped += 1;
        log.push(`skip-cost ${row.address}`);
      } else {
        const nextMeta = {
          ...existing.meta,
          workSource: "Partner",
          partnerName,
          clientAddress: String(existing.meta.clientAddress || existing.addr || row.address),
          jobCost: row.jobCost,
          techSalary: String(existing.meta.techSalary || salary),
          jobStatus: String(existing.meta.jobStatus || "Waiting"),
          sheetDate: String(existing.meta.sheetDate || ""),
        };
        const { error: upErr } = await admin
          .from("leads")
          .update({
            address: String(existing.lead.address || row.address),
            source: partnerName,
            deal_price: row.jobCost,
            metadata: nextMeta,
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId);
        if (upErr) throw upErr;
        updated += 1;
        log.push(`update ${row.address} $${row.jobCost}`);
      }
    } else {
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
        service: "",
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
        name: null as string | null,
        address: row.address,
        source: partnerName,
        lead_type: "sheet_row",
        message: null as string | null,
        deal_title: null as string | null,
        deal_price: row.jobCost,
        stage: "new",
        metadata: meta,
      };
      let { data: createdLead, error: insErr } = await admin
        .from("leads")
        .insert(insertPayload)
        .select("id")
        .single();
      if (insErr && /address/i.test(insErr.message)) {
        const { address: _a, ...rest } = insertPayload;
        const retry = await admin.from("leads").insert(rest).select("id").single();
        createdLead = retry.data;
        insErr = retry.error;
      }
      if (insErr || !createdLead) throw insErr || new Error("Could not create lead");
      leadId = createdLead.id;
      created += 1;
      log.push(`create ${row.address} $${row.jobCost}`);
    }

    try {
      const wo = await ensureLeadWorkOrder({ leadId });
      numbered += 1;
      log.push(`number ${row.address} ${formatJobNumber(wo.jobNumber)}`);
    } catch (err) {
      log.push(
        `number-fail ${row.address}: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }

  return {
    ok: true as const,
    partnerName,
    created,
    updated,
    skipped,
    numbered,
    total: rows.length,
    log,
  };
}
