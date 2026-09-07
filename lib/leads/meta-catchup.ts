import { fetchRecentPageLeads, getDefaultAdsPeriod } from "@/lib/ads/meta";
import { ingestMetaLeadToCrm, metaLeadRowToIngest } from "@/lib/leads/meta-ingest";

export async function catchUpMetaLeads(days = 3): Promise<{
  scanned: number;
  ingested: number;
  skipped: number;
  missingPhoneSaved: number;
  errors: string[];
  sample: Array<{
    id: string;
    createdTime: string | null;
    name: string;
    hasPhone: boolean;
    campaignName: string | null;
    adName: string | null;
    fieldKeys: string[];
  }>;
}> {
  const period = getDefaultAdsPeriod(Math.max(1, days));
  const rows = await fetchRecentPageLeads(period);
  let ingested = 0;
  let skipped = 0;
  let missingPhoneSaved = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const result = await ingestMetaLeadToCrm(metaLeadRowToIngest(row));
      if (result.duplicate) skipped += 1;
      else {
        ingested += 1;
        if (result.missingPhone) missingPhoneSaved += 1;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const sample = rows.slice(0, 12).map((row) => ({
    id: row.id,
    createdTime: row.createdTime,
    name: row.name,
    hasPhone: Boolean(row.phone),
    campaignName: row.campaignName,
    adName: row.adName,
    fieldKeys: Object.keys(row.fields || {}),
  }));

  return {
    scanned: rows.length,
    ingested,
    skipped,
    missingPhoneSaved,
    errors,
    sample,
  };
}
