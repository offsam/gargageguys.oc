/** Job # encoding: YYMM * 1000 + seq → display GG26-08001 (America/Los_Angeles month). */

const LA = "America/Los_Angeles";

/** Legacy flat sequence (GG-1001…) before year-month encoding. */
export function isLegacyJobNumber(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n < 1_000_000;
}

export function yymmFromDate(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LA,
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const yy = parts.find((p) => p.type === "year")?.value || "00";
  const mm = parts.find((p) => p.type === "month")?.value || "01";
  return Number(`${yy}${mm}`);
}

export function encodeJobNumber(yymm: number, seq: number): number {
  return yymm * 1000 + seq;
}

export function decodeJobNumber(jobNumber: number): { yymm: number; yy: number; mm: number; seq: number } | null {
  if (!jobNumber || !Number.isFinite(jobNumber) || isLegacyJobNumber(jobNumber)) return null;
  const yymm = Math.floor(jobNumber / 1000);
  const seq = jobNumber % 1000;
  return {
    yymm,
    yy: Math.floor(yymm / 100),
    mm: yymm % 100,
    seq,
  };
}

/** Display: GG26-08001 (or legacy GG-1001 until renumbered). */
export function formatJobNumber(jobNumber: number | null | undefined): string {
  if (!jobNumber || !Number.isFinite(jobNumber)) return "—";
  if (isLegacyJobNumber(jobNumber)) return `GG-${jobNumber}`;
  const parts = decodeJobNumber(jobNumber);
  if (!parts || parts.mm < 1 || parts.mm > 12 || parts.seq < 1) return "—";
  return `GG${String(parts.yy).padStart(2, "0")}-${String(parts.mm).padStart(2, "0")}${String(parts.seq).padStart(3, "0")}`;
}

export function parseJobNumberLabel(raw: string): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const modern = /^GG(\d{2})-(\d{2})(\d{3})$/i.exec(s);
  if (modern) {
    const yy = Number(modern[1]);
    const mm = Number(modern[2]);
    const seq = Number(modern[3]);
    if (mm < 1 || mm > 12 || seq < 1) return null;
    return encodeJobNumber(yy * 100 + mm, seq);
  }
  const legacy = /^GG-(\d+)$/i.exec(s);
  if (legacy) {
    const n = Number(legacy[1]);
    return Number.isFinite(n) ? n : null;
  }
  const bare = Number(s);
  return Number.isFinite(bare) ? bare : null;
}
