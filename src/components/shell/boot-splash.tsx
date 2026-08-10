import { Sparkles } from "lucide-react";

/**
 * Shown while localStorage rehydrates.
 *
 * Rendering player data before hydration completes would mismatch the
 * server HTML, so every entry point gates on this. It's deliberately calm
 * and brief rather than a spinner-with-progress-bar.
 */
export function BootSplash({ label = "Loading your world…" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-5">
        <div className="relative size-16">
          <div className="absolute inset-0 animate-pulse-glow rounded-full bg-violet/50 blur-xl" />
          <div className="relative grid size-16 place-items-center rounded-full border border-violet/40 bg-surface">
            <Sparkles className="size-7 animate-float text-gold-ink" strokeWidth={1.5} />
          </div>
        </div>
        <p className="text-xs tracking-[0.14em] text-ink-faint uppercase">{label}</p>
      </div>
    </div>
  );
}
