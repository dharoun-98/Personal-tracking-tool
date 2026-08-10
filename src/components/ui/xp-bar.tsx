import { cn } from "@/lib/cn";

export function XpBar({
  value,
  className,
  height = 8,
  color = "var(--accent, var(--color-violet))",
  showSheen = true,
}: {
  /** 0–1 */
  value: number;
  className?: string;
  height?: number;
  color?: string;
  showSheen?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-surface-3",
        className,
      )}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, color-mix(in oklab, ${color} 70%, black), ${color})`,
          boxShadow: `0 0 12px -2px ${color}`,
          transition: "width 800ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      {showSheen && pct > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 animate-shimmer rounded-full"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, transparent 0%, color-mix(in srgb, white 35%, transparent) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
          }}
        />
      )}
    </div>
  );
}
