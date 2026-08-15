/** Strip PostgREST filter metacharacters from user search fragments. */
export function sanitizeIlikeFragment(value: string, max = 80): string {
  return value.replace(/[,.()%\\]/g, "").trim().slice(0, max);
}
