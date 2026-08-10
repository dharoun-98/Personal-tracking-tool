import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Streak indicator.
 *
 * Goes cold-grey at zero rather than hiding — an unlit flame reads as "this is
 * available to you", where a missing element reads as nothing at all. It never
 * shows a broken-streak warning; that's the kind of pressure this app avoids.
 */
export function StreakFlame({
  days,
  className,
  size = "md",
}: {
  days: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const lit = days > 0;
  const hot = days >= 7;
  const blazing = days >= 30;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tabular-nums",
        size === "sm" ? "text-2xs" : "text-xs",
        lit ? (blazing ? "text-gold-ink" : hot ? "text-warn" : "text-ink-dim") : "text-ink-faint",
        className,
      )}
      title={lit ? `${days} day streak` : "No streak yet — today can start one"}
    >
      <Flame
        className={cn(
          size === "sm" ? "size-3" : "size-3.5",
          blazing && "animate-pulse-glow",
        )}
        fill={lit ? "currentColor" : "none"}
        strokeWidth={lit ? 1.5 : 2}
        aria-hidden
      />
      {days}
    </span>
  );
}
