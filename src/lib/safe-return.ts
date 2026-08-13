const INTERNAL_ORIGIN = "https://lifequest.invalid";
const DEFAULT_RETURN_PATH = "/dashboard";

// Browsers treat backslashes as path separators for special URLs. Control
// characters may also be stripped before parsing, so reject both before URL
// normalisation. Check their percent-encoded forms as well because a `next`
// query parameter has already been decoded once by the time it reaches us.
const RAW_FORBIDDEN = /[\\\u0000-\u001f\u007f-\u009f]/;
const ENCODED_FORBIDDEN = /%(?:0[0-9a-f]|1[0-9a-f]|5c|7f|8[0-9a-f]|9[0-9a-f])/i;

function parseInternalPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (RAW_FORBIDDEN.test(value) || ENCODED_FORBIDDEN.test(value)) return null;

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/**
 * Returns a root-relative destination that cannot leave this application.
 *
 * Use this for any user-controlled `next` or `returnTo` value before passing
 * it to a router, a Link, or `new URL`. The fallback is validated too so a
 * future caller cannot accidentally turn the safety net into another redirect.
 */
export function safeInternalReturnPath(
  value: unknown,
  fallback: string = DEFAULT_RETURN_PATH,
): string {
  return (
    parseInternalPath(value) ??
    parseInternalPath(fallback) ??
    DEFAULT_RETURN_PATH
  );
}
