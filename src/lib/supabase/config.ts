/**
 * Supabase configuration.
 *
 * Every accessor returns null rather than throwing when the environment is
 * incomplete. The game is local-first and must stay fully playable with no
 * backend at all — a missing key degrades cloud sync, it does not break the
 * app. Every call site is expected to handle null.
 *
 * Newer Supabase projects issue "publishable" and "secret" keys; older ones
 * issue "anon" and "service_role". Both naming conventions work with
 * supabase-js v2, so both are accepted here.
 */

export interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

export function publicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function serviceRoleKey(): string | null {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  return key || null;
}

/** True when the browser has enough configuration to talk to Supabase. */
export function isCloudEnabled(): boolean {
  return publicSupabaseConfig() !== null;
}

/**
 * Where Supabase should send people back to after an email link.
 *
 * Must be an absolute URL, and must be listed under Authentication →
 * URL Configuration in the Supabase dashboard or the redirect is refused.
 */
export function authRedirectUrl(path = "/auth/callback"): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  return `${base}${path}`;
}
