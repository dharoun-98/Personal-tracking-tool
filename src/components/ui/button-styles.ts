import { cn } from "@/lib/cn";

/**
 * Button styling, deliberately kept out of the `"use client"` button module.
 *
 * Server components need these classes to render links that look like buttons,
 * and a client module's exports can't be called from the server.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "gold"
  | "danger"
  | "accent";

export type ButtonSize = "sm" | "md" | "lg" | "xl";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-violet text-white shadow-[0_8px_30px_-10px_var(--color-violet)] hover:bg-violet-soft border border-violet-soft/40",
  secondary:
    "bg-surface-2 text-ink border border-hairline hover:bg-surface-3 hover:border-violet/40",
  ghost: "bg-transparent text-ink-dim hover:text-ink hover:bg-surface-2/70",
  gold: "bg-gold text-abyss font-semibold shadow-[0_8px_30px_-10px_var(--color-gold)] hover:bg-gold-soft border border-gold-soft/50",
  danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
  // Reads --accent from an ancestor, so one button works for all seven domains.
  accent:
    "text-abyss font-semibold border border-white/20 bg-[var(--accent)] hover:brightness-110 shadow-[0_8px_30px_-12px_var(--accent)]",
};

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-2xl gap-2",
  lg: "h-13 px-6 text-base rounded-2xl gap-2",
  xl: "h-15 px-7 text-lg rounded-[1.25rem] gap-2.5",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "tappable no-select inline-flex items-center justify-center font-medium",
    "transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-soft",
    "disabled:pointer-events-none disabled:opacity-45",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fullWidth && "w-full",
    className,
  );
}
