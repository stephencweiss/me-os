/**
 * Allowlist post-login paths: same-app relative only (open-redirect safe).
 */
export function safeRelativeRedirectPath(
  input: string | undefined | null,
  fallback: string
): string {
  const fb = fallback.startsWith("/") ? fallback : `/${fallback}`;
  if (input == null || typeof input !== "string") return fb;
  const t = input.trim();
  if (!t.startsWith("/")) return fb;
  if (t.startsWith("//")) return fb;
  if (t.includes("\\")) return fb;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/u.test(t)) return fb;
  if (t.length > 2048) return fb;
  return t;
}
