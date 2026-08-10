"use client";

import { motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_OPTIONS, useTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/cn";

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/**
 * Segmented Day / Night / Auto control.
 *
 * Until `ready` flips, the selection indicator is hidden rather than guessed —
 * the server has no idea what the player picked, and rendering the wrong pill
 * for a frame is more jarring than rendering none.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useTheme((s) => s.preference);
  const setPreference = useTheme((s) => s.setPreference);
  const ready = useTheme((s) => s.ready);

  return (
    <div
      className={cn("flex gap-1 rounded-2xl bg-surface-2 p-1", className)}
      role="radiogroup"
      aria-label="Colour theme"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = ICONS[option.value];
        const active = ready && preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            onClick={() => setPreference(option.value)}
            className={cn(
              "tappable relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5",
              "text-xs font-semibold transition-colors",
              active ? "text-ink" : "text-ink-mute hover:text-ink-dim",
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                className="absolute inset-0 rounded-xl bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon className="size-3.5" />
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact single-button variant that cycles Day → Night → Auto. */
export function ThemeCycleButton({ className }: { className?: string }) {
  const preference = useTheme((s) => s.preference);
  const resolved = useTheme((s) => s.resolved);
  const setPreference = useTheme((s) => s.setPreference);
  const ready = useTheme((s) => s.ready);

  const order: ThemePreference[] = ["light", "dark", "system"];
  const next = order[(order.indexOf(preference) + 1) % order.length];
  const Icon = ready ? ICONS[preference] : ICONS.system;

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Theme: ${preference}. Switch to ${next}.`}
      className={cn(
        "tappable grid size-9 place-items-center rounded-xl border border-edge bg-surface text-ink-mute",
        "transition-colors hover:text-ink",
        className,
      )}
    >
      <Icon className="size-4" />
      <span className="sr-only">
        {ready ? `Currently ${resolved}` : "Loading theme"}
      </span>
    </button>
  );
}
