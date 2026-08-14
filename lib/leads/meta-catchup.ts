import { fetchRecentPageLeads, getDefaultAdsPeriod } from "@/lib/ads/meta";
import { ingestMetaLeadToCrm, metaLeadRowToIngest } from "@/lib/leads/meta-ingest";

export async function catchUpMetaLeads(days = 3): Promise<{
  scanned: number;
  ingested: number;
  skipped: number;
  errors: string[];
}> {
  const period = getDefaultAdsPeriod(Math.max(1, days));
  const rows = await fetchRecentPageLeads(period);
  let ingested = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.phone) {
      skipped += 1;
      continue;
    }
    try {
      const result = await ingestMetaLeadToCrm(metaLeadRowToIngest(row));
      if (result.duplicate) skipped += 1;
      else ingested += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { scanned: rows.length, ingested, skipped, errors };
}
