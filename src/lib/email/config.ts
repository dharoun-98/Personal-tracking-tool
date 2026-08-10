/**
 * Email configuration, read server-side only.
 *
 * Everything degrades to "not configured" rather than throwing. The product
 * has to work without a mail provider — the documents are generated on the
 * device and downloadable regardless, so email is an enhancement, never a
 * dependency.
 */

export interface EmailConfig {
  apiKey: string;
  from: string;
}

export function readEmailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function isEmailConfigured(): boolean {
  return readEmailConfig() !== null;
}

/**
 * Deliberately conservative address check.
 *
 * Full RFC 5322 validation is famously not worth it; the provider will reject
 * anything genuinely malformed. This exists to catch typos and to give the
 * endpoint something cheap to reject before doing any work.
 */
export function isPlausibleEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 6 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(trimmed);
}

/** Largest attachment we'll accept, per document. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
