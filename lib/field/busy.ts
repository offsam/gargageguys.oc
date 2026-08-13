export const BUSY_JOB_MARKER = "[BUSY]";

export function isBusyJob(job: { title?: string | null; notes?: string | null }): boolean {
  if (String(job.title || "").trim().toLowerCase() === "busy") return true;
  return String(job.notes || "").includes(BUSY_JOB_MARKER);
}
