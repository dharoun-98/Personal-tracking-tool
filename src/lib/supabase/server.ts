import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseConfig, serviceRoleKey } from "./config";

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * Returns null when Supabase isn't configured, so server components can fall
 * back to the local-only experience instead of throwing.
 */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  const config = publicSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          for (const { name, value, options } of items) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components can't set cookies. That's fine: the middleware
          // refreshes the session on every request, so the write here is
          // redundant rather than load-bearing.
        }
      },
    },
  });
}

/**
 * True when the only thing "wrong" is that nobody is signed in.
 *
 * `auth.getUser()` reports a missing session as an error rather than a null
 * user, so a plain signed-out visitor is indistinguishable from a genuine
 * identity failure unless you check for this. Treating the two the same walls
 * every signed-out player out of a game that's meant to be playable with no
 * account at all.
 */
export function isMissingSession(error: unknown): boolean {
  return !!error && (error as { name?: string }).name === "AuthSessionMissingError";
}

/**
 * Service-role client. Bypasses row-level security entirely.
 *
 * Only ever used from server code that has already established authority of
 * its own — the admin panel behind its password gate, and the Stripe webhook
 * behind signature verification. Never expose a route that calls this without
 * checking who is asking first.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const config = publicSupabaseConfig();
  const key = serviceRoleKey();
  if (!config || !key) return null;

  return createClient(config.url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** The signed-in user, or null. Never throws. */
export async function getCurrentUser() {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
