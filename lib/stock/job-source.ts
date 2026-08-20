import { isPartnerWork } from "@/lib/sheet/work-source";

export type JobStockSource = {
  owner: "gg" | string;
  label: string;
  from: "van" | "partner";
};

export function resolveJobStockSource(
  workSource: string,
  partnerName: string,
  partners: Array<{ id: string; name: string; has_own_stock: boolean }>,
): JobStockSource {
  if (isPartnerWork(workSource) && partnerName.trim()) {
    const needle = partnerName.trim().toLowerCase();
    const match = partners.find((p) => p.name.trim().toLowerCase() === needle);
    if (match?.has_own_stock && !match.id.startsWith("seed-")) {
      return { owner: match.id, label: match.name, from: "partner" };
    }
  }
  return { owner: "gg", label: "Garage Guys", from: "van" };
}

export function pickLeadWorkMeta(meta: Record<string, unknown>) {
  const workSource = String(meta.workSource || meta.work_source || meta.owner || "");
  const partnerName = String(meta.partnerName || meta.partner_name || meta.partner || "");
  return { workSource, partnerName };
}

/** Company the job belongs to — partner name, or Garage Guys for own work. */
export function jobCompanyLabel(workSource: string, partnerName: string): string {
  if (isPartnerWork(workSource) && partnerName.trim()) return partnerName.trim();
  return "Garage Guys";
}
