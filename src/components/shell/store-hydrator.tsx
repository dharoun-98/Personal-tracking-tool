"use client";

import { useRehydrateOnce } from "@/lib/store";

/**
 * Reads saved game state out of localStorage, once, after mount.
 *
 * Renders nothing. It exists as a component purely so the effect runs inside
 * React's lifecycle rather than at module load, which is what keeps the
 * server HTML and the first client render identical.
 */
export function StoreHydrator() {
  useRehydrateOnce();
  return null;
}
