"use client";

import { useEffect } from "react";
import { useTheme, watchSystemTheme } from "@/lib/theme";

/**
 * Hands the theme over from the inline boot script to React.
 *
 * Renders nothing. `sync` reads what the script already decided rather than
 * recomputing it, so there is never a moment where the two disagree.
 */
export function ThemeProvider() {
  const sync = useTheme((s) => s.sync);

  useEffect(() => {
    sync();
    return watchSystemTheme();
  }, [sync]);

  return null;
}
