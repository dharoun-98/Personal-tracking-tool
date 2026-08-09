"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { DOMAIN_IDS, getDomain, orderByPriority } from "@/lib/domains";
import { useSnapshot } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { DomainIcon } from "@/components/game/domain-icon";
import { StreakFlame } from "@/components/game/streak-flame";

/** Heptagon layout, starting at the top and going clockwise. */
function positions(count: number, radius: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
  });
}

export default function MapPage() {
  const profile = useGame((s) => s.profile);
  const { domains } = useSnapshot();

  const ordered = useMemo(
    () => orderByPriority(DOMAIN_IDS, profile?.priorities ?? []),
    [profile?.priorities],
  );

  const points = useMemo(() => positions(DOMAIN_IDS.length, 34), []);
  const avgVitality = Math.round(
    DOMAIN_IDS.reduce((sum, id) => sum + domains[id].vitality, 0) / DOMAIN_IDS.length,
  );

  return (
    <main className="space-y-7 pt-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Your constellation</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
          Seven domains, one life. Brightness is how alive each one is right now — not
          how good you are at it.
        </p>
      </header>

      {/* ------------------------------------------------------ The map */}
      <Panel className="relative overflow-hidden p-4">
        <div className="relative mx-auto aspect-square w-full max-w-md">
          {/* Constellation lines */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 size-full"
            aria-hidden
          >
            {DOMAIN_IDS.map((_, i) => {
              const from = points[i];
              const to = points[(i + 1) % points.length];
              const a = domains[DOMAIN_IDS[i]].vitality;
              const b = domains[DOMAIN_IDS[(i + 1) % DOMAIN_IDS.length]].vitality;
              // A link is only as bright as its dimmer end.
              const strength = Math.min(a, b) / 100;
              return (
                <motion.line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="var(--color-violet)"
                  strokeWidth={0.35}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.15 + strength * 0.55 }}
                  transition={{ duration: 1.1, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              );
            })}
          </svg>

          {/* Centre — the whole-life reading */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="font-display text-3xl font-extrabold tabular-nums">
              {avgVitality}
              <span className="text-base text-ink-faint">%</span>
            </p>
            <p className="text-2xs tracking-wider text-ink-faint uppercase">alive</p>
          </div>

          {/* Orbs */}
          {DOMAIN_IDS.map((id, i) => {
            const state = domains[id];
            const meta = getDomain(id);
            const point = points[i];
            const dormant = state.questCount === 0;
            const intensity = dormant ? 0.14 : 0.25 + (state.vitality / 100) * 0.75;
            // Higher-level domains take up more of the sky.
            const size = 34 + Math.min(state.level.level, 20) * 0.9;

            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.15 + i * 0.07,
                  type: "spring",
                  stiffness: 240,
                  damping: 18,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <Link
                  href={`/domains/${id}`}
                  aria-label={`${meta.name}, level ${state.level.level}`}
                  className="tappable group flex flex-col items-center gap-1.5"
                >
                  <span
                    className="relative grid place-items-center rounded-full transition-transform duration-300 group-hover:scale-110"
                    style={{ width: size, height: size }}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full blur-lg"
                      style={{
                        background: `radial-gradient(circle, ${meta.color} 0%, transparent 70%)`,
                        opacity: intensity,
                      }}
                    />
                    <span
                      className="relative grid size-full place-items-center rounded-full"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${meta.color} ${Math.round(
                          intensity * 45,
                        )}%, var(--color-surface)), var(--color-surface))`,
                        border: `1px solid color-mix(in oklab, ${meta.color} ${dormant ? 20 : 50}%, transparent)`,
                        color: meta.color,
                      }}
                    >
                      <DomainIcon
                        domain={id}
                        className={dormant ? "size-4 opacity-40" : "size-4.5"}
                      />
                    </span>
                  </span>
                  <span className="text-2xs font-medium whitespace-nowrap text-ink-dim">
                    {meta.name}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </Panel>

      {/* ------------------------------------------------------ Breakdown */}
      <section>
        <SectionTitle>Domain by domain</SectionTitle>
        <div className="space-y-2.5">
          {ordered.map((id) => {
            const state = domains[id];
            const meta = getDomain(id);
            const dormant = state.questCount === 0;
            return (
              <Link
                key={id}
                href={`/domains/${id}`}
                style={{ ["--accent" as string]: meta.color }}
                className="panel tappable flex items-center gap-3.5 rounded-2xl p-3.5"
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-xl"
                  style={{
                    background: `color-mix(in oklab, ${meta.color} 15%, transparent)`,
                    color: meta.color,
                  }}
                >
                  <DomainIcon domain={id} className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{meta.name}</p>
                    {!dormant && (
                      <span className="text-2xs font-bold accent-text">
                        Lv {state.level.level}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${state.vitality}%`,
                        background: meta.color,
                        boxShadow: `0 0 10px -1px ${meta.color}`,
                      }}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {dormant ? (
                    <span className="text-2xs text-ink-faint">dormant</span>
                  ) : (
                    <>
                      <p className="text-sm font-bold tabular-nums accent-text">
                        {state.vitality}%
                      </p>
                      <StreakFlame days={state.streak} size="sm" />
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
