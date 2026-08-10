"use client";

import { create } from "zustand";

/* ==================================================================== *
 * Theme.
 *
 * Three preferences — system, light, dark — resolving to one of two actual
 * themes. The resolved theme is written to `data-theme` on <html>, which is
 * what the CSS keys off (see globals.css).
 *
 * The initial application happens in a blocking inline script before first
 * paint (see theme-script.tsx). This module takes over afterwards; it never
 * needs to guess, because it can read what that script already decided.
 * ==================================================================== */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ptt.theme";

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  /** False until the client has read the real preference. */
  ready: boolean;
  setPreference: (preference: ThemePreference) => void;
  /** Called once on mount to sync with whatever the inline script decided. */
  sync: () => void;
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private-mode Safari throws on localStorage access. Falling back to
    // "system" is a perfectly good outcome.
  }
  return "system";
}

function applyToDocument(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  /*
   * Freeze every transition for the duration of the swap.
   *
   * Elements carrying `transition-colors` will otherwise try to animate from
   * the old theme's colour to the new one — and Chrome can leave them pinned
   * at the old value indefinitely, producing a page that is half light and
   * half dark. A theme change should be instantaneous anyway.
   */
  root.dataset.themeSwitching = "";
  root.dataset.theme = resolved;
  // Keeps form controls, scrollbars and the on-screen keyboard in step.
  root.style.colorScheme = resolved;

  // Force a style flush so the frozen state is committed before we release it.
  void root.offsetHeight;
  requestAnimationFrame(() => {
    delete root.dataset.themeSwitching;
  });

  // The browser chrome / status bar colour on mobile.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "light" ? "#F6F5FA" : "#0B0B1F");
  }
}

export const useTheme = create<ThemeState>((set, get) => ({
  // Server and first client render agree on these; `sync` corrects them.
  preference: "system",
  resolved: "dark",
  ready: false,

  setPreference: (preference) => {
    const resolved = resolve(preference);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Non-fatal: the theme still applies for this session.
    }
    applyToDocument(resolved);
    set({ preference, resolved, ready: true });
  },

  sync: () => {
    if (get().ready) return;
    const preference = readPreference();
    const resolved = resolve(preference);
    applyToDocument(resolved);
    set({ preference, resolved, ready: true });
  },
}));

/**
 * Watches the OS setting so "system" stays live rather than only applying on
 * load. Returns a teardown function.
 */
export function watchSystemTheme(): () => void {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia("(prefers-color-scheme: light)");

  const onChange = () => {
    const { preference } = useTheme.getState();
    if (preference !== "system") return;
    const resolved = systemTheme();
    applyToDocument(resolved);
    useTheme.setState({ resolved });
  };

  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  hint: string;
}> = [
  { value: "light", label: "Day", hint: "Bright and clear" },
  { value: "dark", label: "Night", hint: "The original cosmos" },
  { value: "system", label: "Auto", hint: "Follows your device" },
];
