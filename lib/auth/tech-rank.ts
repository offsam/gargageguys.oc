export type TechRank = "technician" | "senior";

export const DEFAULT_SENIOR_TECH_EMAILS = ["artemovsam@gmail.com"];

export function normalizeTechRank(raw: unknown): TechRank | null {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (value === "senior" || value === "senior_technician" || value === "senior technician") {
    return "senior";
  }
  if (value === "technician" || value === "tech") return "technician";
  return null;
}

export function isDefaultSeniorTechEmail(email: string | null | undefined): boolean {
  const needle = String(email || "")
    .trim()
    .toLowerCase();
  return DEFAULT_SENIOR_TECH_EMAILS.includes(needle);
}

export function resolveTechRank(input: {
  role: string;
  email?: string | null;
  storedRank?: unknown;
}): TechRank | null {
  if (input.role !== "technician") return null;
  if (isDefaultSeniorTechEmail(input.email)) return "senior";
  return normalizeTechRank(input.storedRank) || "technician";
}

export function isSeniorTechnician(input: {
  role: string;
  email?: string | null;
  techRank?: string | null;
}): boolean {
  if (input.role === "owner") return true;
  return resolveTechRank({
    role: input.role,
    email: input.email,
    storedRank: input.techRank,
  }) === "senior";
}

export function techRankLabel(rank: TechRank | null | undefined): string {
  if (rank === "senior") return "Senior technician";
  if (rank === "technician") return "Technician";
  return "";
}
