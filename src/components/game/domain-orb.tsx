"use client";

import Link from "next/link";
import { getDomain } from "@/lib/domains";
import { cn } from "@/lib/cn";
import type { DomainState } from "@/lib/types";
import { DomainIcon } from "./domain-icon";
import { ProgressRing } from "@/components/ui/progress-ring";

const SIZES = {
  sm: { box: 56, ring: 56, stroke: 3, icon: "size-5", label: "text-2xs" },
  md: { box: 76, ring: 76, stroke: 4, icon: "size-7", label: "text-xs" },
  lg: { box: 104, ring: 104, stroke: 5, icon: "size-9", label: "text-sm" },
} as const;

interface DomainOrbProps {
  state: DomainState;
  size?: keyof typeof SIZES;
  showLabel?: boolean;
  href?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * A single life domain, rendered as a glowing orb.
 *
 * The visual language carries real information:
 *  - ring fill      = progress through the current level
 *  - glow intensity = vitality (how alive this domain is right now)
 *  - dashed ring    = dormant, no quests yet — an invitation, not a failure
 */
export function DomainOrb({
  state,
  size = "md",
  showLabel = true,
  href,
  className,
  onClick,
}: DomainOrbProps) {
  const meta = getDomain(state.domain);
  const dims = SIZES[size];
  const dormant = state.questCount === 0;

  // Even a brand-new domain keeps a faint presence so the constellation reads
  // as complete rather than half-broken.
  const intensity = dormant ? 0.12 : 0.22 + (state.vitality / 100) * 0.78;

  const body = (
    <span
      className={cn(
        "group relative flex flex-col items-center gap-2",
        (href || onClick) && "tappable cursor-pointer",
        className,
      )}
      style={{
        ["--accent" as string]: meta.color,
        ["--accent-ink" as string]: meta.ink,
      }}
    >
      <span className="relative grid place-items-center" style={{ width: dims.box, height: dims.box }}>
        {/* Outer bloom */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full blur-xl transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, ${meta.color} 0%, transparent 68%)`,
            opacity: intensity * 0.75,
          }}
        />

        {/* Level progress ring */}
        <ProgressRing
          value={dormant ? 0 : state.level.progress}
          size={dims.ring}
          stroke={dims.stroke}
          color={meta.color}
          glow={!dormant}
          trackClassName={dormant ? "stroke-surface-3/60" : "stroke-surface-3"}
          className="absolute inset-0"
        />

        {/* Core */}
        <span
          className="relative grid place-items-center rounded-full transition-transform duration-300 group-hover:scale-105"
          style={{
            width: dims.box - dims.stroke * 4,
            height: dims.box - dims.stroke * 4,
            background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${meta.color} ${Math.round(
              intensity * 42,
            )}%, var(--color-surface)), var(--color-surface))`,
            boxShadow: dormant
              ? "inset 0 1px 0 var(--c-orb-inset)"
              : `inset 0 1px 0 var(--c-orb-inset), 0 0 20px -8px color-mix(in oklab, ${meta.color} calc(100% * var(--c-glow-strength)), transparent)`,
            border: `1px solid color-mix(in oklab, ${meta.color} ${dormant ? 30 : 55}%, transparent)`,
            color: meta.ink,
          }}
        >
          <DomainIcon
            domain={state.domain}
            className={cn(
              dims.icon,
              "transition-opacity duration-300",
              dormant ? "opacity-35" : "opacity-95",
            )}
          />
        </span>

        {/* Level pip */}
        {!dormant && (
          <span
            className="absolute -right-0.5 -bottom-0.5 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-2xs font-bold tabular-nums text-on-accent"
            style={{
              background: meta.color,
              boxShadow: `0 0 14px -3px color-mix(in oklab, ${meta.color} calc(100% * var(--c-glow-strength)), transparent)`,
            }}
          >
            {state.level.level}
          </span>
        )}
      </span>

      {showLabel && (
        <span className="flex flex-col items-center gap-0.5 text-center">
          <span
            className={cn(
              "font-display leading-none font-semibold",
              dims.label,
              dormant ? "text-ink-mute" : "text-ink",
            )}
          >
            {meta.name}
          </span>
          <span className="text-2xs text-ink-faint leading-none">
            {dormant ? "dormant" : `${state.vitality}%`}
          </span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={`${meta.name} — level ${state.level.level}`}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={meta.name}>
        {body}
      </button>
    );
  }
  return body;
}
