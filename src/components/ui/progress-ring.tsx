import { cn } from "@/lib/cn";

interface ProgressRingProps {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  /** Any CSS colour — defaults to the inherited --accent. */
  color?: string;
  trackClassName?: string;
  className?: string;
  children?: React.ReactNode;
  /** Adds a soft outer glow in the same colour. */
  glow?: boolean;
}

/**
 * SVG progress ring.
 *
 * Rotated -90° so progress starts at 12 o'clock, which is what everyone
 * expects and what makes a partially-filled ring readable at a glance.
 */
export function ProgressRing({
  value,
  size = 64,
  stroke = 5,
  color = "var(--accent, var(--color-violet))",
  trackClassName,
  className,
  children,
  glow = false,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamped;

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={cn("stroke-surface-3", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            transition: "stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)",
            filter: glow ? `drop-shadow(0 0 6px ${color})` : undefined,
          }}
        />
      </svg>
      {children != null && (
        <div className="absolute inset-0 grid place-items-center">{children}</div>
      )}
    </div>
  );
}
