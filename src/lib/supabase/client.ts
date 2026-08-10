"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";

let cached: SupabaseClient | null = null;

/**
 * The browser Supabase client, or null when cloud sync isn't configured.
 *
 * Memoised: `createBrowserClient` opens its own auth listener and token
 * refresh timer, so constructing one per render would leak both.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (cached) return cached;
  const config = publicSupabaseConfig();
  if (!config) return null;
  cached = createBrowserClient(config.url, config.anonKey);
  return cached;
}
