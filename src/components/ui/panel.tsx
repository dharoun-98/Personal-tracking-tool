import { cn } from "@/lib/cn";

export function Panel({
  className,
  glass = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { glass?: boolean }) {
  return (
    <div
      className={cn(
        glass ? "panel-glass" : "panel",
        "rounded-3xl",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-mute uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Chip({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "accent" | "gold" | "success" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink-dim border-hairline",
    accent: "accent-bg-soft accent-text accent-border",
    gold: "bg-gold/12 text-gold-ink border-gold/35",
    success: "bg-success/12 text-success border-success/35",
    danger: "bg-danger/12 text-danger border-danger/35",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-2xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
