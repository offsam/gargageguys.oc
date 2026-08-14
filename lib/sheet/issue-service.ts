/** Client-stated issue vs catalog service we actually perform. */

const GENERIC_LEAD_TYPE = /^(sheet_row|callback|field_job|qualified)$/i;

function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const v = String(value || "").trim();
    if (v) return v;
  }
  return "";
}

export function isGenericLeadType(value: string | null | undefined): boolean {
  return GENERIC_LEAD_TYPE.test(String(value || "").trim());
}

export function sheetIssueFromLead(input: {
  metadata: Record<string, unknown>;
  dealTitle?: string | null;
  leadType?: string | null;
  message?: string | null;
}): string {
  const meta = input.metadata;
  const fromMeta = firstText(
    typeof meta.issue === "string" ? meta.issue : "",
    typeof meta.jobType === "string" ? meta.jobType : "",
    typeof meta.job_type === "string" ? meta.job_type : "",
  );
  if (fromMeta && !isGenericLeadType(fromMeta)) return fromMeta;
  if (input.dealTitle?.trim()) return input.dealTitle.trim();
  if (input.leadType?.trim() && !isGenericLeadType(input.leadType)) return input.leadType.trim();
  return firstText(input.message);
}

export function sheetServiceFromLead(metadata: Record<string, unknown>): string {
  const v = metadata.service;
  return typeof v === "string" ? v.trim() : "";
}
