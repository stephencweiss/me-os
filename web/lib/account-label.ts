/** User-provided label for linked Google accounts (OAuth query + signed cookie). */

export const ACCOUNT_LABEL_MAX_LENGTH = 64;

const CONTROL_CHARS = /[\x00-\x1f]/;

export type AccountLabelQueryResult =
  | { ok: true; value: string | undefined }
  | { ok: false; message: string };

/**
 * Parse `?label=` from the Google link start URL.
 * Absent, empty, or whitespace-only → `value: undefined` (use profile email in callback).
 */
export function parseAccountLabelQueryParam(
  raw: string | null | undefined
): AccountLabelQueryResult {
  if (raw == null || raw === "") {
    return { ok: true, value: undefined };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  if (trimmed.length > ACCOUNT_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      message: `Label must be at most ${ACCOUNT_LABEL_MAX_LENGTH} characters`,
    };
  }
  if (CONTROL_CHARS.test(trimmed)) {
    return { ok: false, message: "Label cannot contain control characters" };
  }
  return { ok: true, value: trimmed };
}

/** Whether a string is safe to store as account_label (same rules as query). */
export function isValidAccountLabelString(s: string): boolean {
  return (
    s.length > 0 &&
    s.length <= ACCOUNT_LABEL_MAX_LENGTH &&
    !CONTROL_CHARS.test(s)
  );
}

/**
 * Stored `account_label`: user label from OAuth state if present (already validated),
 * else Google email, else a short fallback from `sub`.
 */
export function resolveLinkedGoogleAccountLabel(
  preferredFromOAuthState: string | undefined,
  googleEmail: string,
  googleSubject: string
): string {
  if (
    preferredFromOAuthState !== undefined &&
    isValidAccountLabelString(preferredFromOAuthState)
  ) {
    return preferredFromOAuthState;
  }
  const em = googleEmail.trim();
  if (em) return em;
  return `google:${googleSubject.slice(0, 24)}`;
}
