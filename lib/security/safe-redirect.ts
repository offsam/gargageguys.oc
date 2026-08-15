/**
 * Allow only same-origin relative paths (block protocol-relative //evil.com).
 */
export function safeInternalPath(next: string | null | undefined, fallback: string): string {
  const value = String(next || "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
