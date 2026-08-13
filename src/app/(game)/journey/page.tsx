"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Award, Lock } from "lucide-react";
import { dayRange, fromDayKey, prettyDay } from "@/lib/date";
import { buildToday, completionCredit, levelTitle, xpOnDay } from "@/lib/game";
import { compactNumber } from "@/lib/format";
import { useSnapshot } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { useNowMs } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { getDomain } from "@/lib/domains";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { buttonClasses } from "@/components/ui/button";
import { XpBar } from "@/components/ui/xp-bar";
import { DayHeatmap, type HeatCell } from "@/components/game/day-heatmap";
import { StreakFlame } from "@/components/game/streak-flame";

const TIERS = {
  bronze: { label: "Bronze", color: "var(--color-tier-bronze)" },
  silver: { label: "Silver", color: "var(--color-tier-silver)" },
  gold: { label: "Gold", color: "var(--color-tier-gold)" },
  mythic: { label: "Mythic", color: "var(--color-tier-mythic)" },
} as const;

export default function JourneyPage() {
  const quests = useGame((s) => s.quests);
  const logs = useGame((s) => s.logs);
  const unlocked = useGame((s) => s.unlocked);
  const unlock = useGame((s) => s.unlock);
  const { level, streak, totalXp, achievements, achievementContext } = useSnapshot();
  const nowMs = useNowMs();
  const [showLocked, setShowLocked] = useState(true);

  /**
   * Record anything already satisfied but never written down — imported
   * history, or an achievement whose condition became true through the passage
   * of time rather than a check-in. Without this the "NEW" badge would stick
   * to those achievements permanently.
   */
  useEffect(() => {
    const known = new Set(unlocked.map((u) => u.id));
    const missing = achievements
      .filter((a) => a.unlocked && !known.has(a.def.id))
      .map((a) => a.def.id);
    if (missing.length > 0) unlock(missing);
  }, [achievements, unlocked, unlock]);

  const xpSeries = useMemo(() => {
    const days = dayRange(14);
    const values = days.map((day) => xpOnDay(quests, logs, day));
    const peak = Math.max(1, ...values);
    return days.map((day, i) => ({ day, xp: values[i], height: values[i] / peak }));
  }, [quests, logs]);

  const heatCells = useMemo<HeatCell[]>(
    () =>
      dayRange(28).map((date) => {
        const view = buildToday(quests, logs, date).filter((t) => t.due || t.log);
        if (view.length === 0) return { date, value: null };
        const credit = view.reduce(
          (sum, item) => sum + completionCredit(item.log?.status),
          0,
        );
        return { date, value: credit / view.length };
      }),
    [quests, logs],
  );

  const fullyCompletedDays = useMemo(() => {
    const loggedDays = [...new Set(logs.map((log) => log.date))];
    return loggedDays.filter((date) => {
      const view = buildToday(quests, logs, date).filter((item) => item.due || item.log);
      return view.length > 0 && view.every((item) => item.log?.status === "done");
    }).length;
  }, [quests, logs]);

  const xpPeriodTotal = xpSeries.reduce((sum, point) => sum + point.xp, 0);
  const xpActiveDays = xpSeries.filter((point) => point.xp > 0).length;
  const bestXpDay = xpSeries.reduce((best, point) =>
    point.xp > best.xp ? point : best,
  );
  const xpSummary = `${compactNumber(xpPeriodTotal)} XP across ${xpActiveDays} ${
    xpActiveDays === 1 ? "day" : "days"
  }. Best day: ${prettyDay(bestXpDay.day)}, ${compactNumber(bestXpDay.xp)} XP.`;

  const scheduledDays = heatCells.filter((cell) => cell.value !== null).length;
  const showingUpDays = heatCells.filter((cell) => (cell.value ?? 0) > 0).length;
  const fullDays = heatCells.filter((cell) => cell.value === 1).length;
  const heatSummary =
    scheduledDays === 0
      ? "Nothing was scheduled in the last four weeks."
      : `You showed up on ${showingUpDays} of ${scheduledDays} scheduled ${
          scheduledDays === 1 ? "day" : "days"
        }, with ${fullDays} ${fullDays === 1 ? "day" : "days"} fully completed.`;

  /** Ids unlocked in the last day — these get the "NEW" flash. */
  const recentlyUnlocked = useMemo(() => {
    if (nowMs === 0) return new Set<string>();
    const cutoff = nowMs - 86_400_000;
    return new Set(
      unlocked
        .filter((u) => new Date(u.unlockedAt).getTime() >= cutoff)
        .map((u) => u.id),
    );
  }, [unlocked, nowMs]);
  const earned = achievements.filter((a) => a.unlocked);
  const pending = achievements.filter(
    (a) => !a.unlocked && (!a.def.secret || a.progress > 0),
  );

  return (
    <main className="space-y-7 pt-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Your journey</h1>
        <p className="mt-1.5 text-sm text-ink-mute">
          Everything you&apos;ve built so far, in one place.
        </p>
      </header>

      {/* ----------------------------------------------------- Level card */}
      <Panel className="relative overflow-hidden p-5">
        <div
          aria-hidden
          className="absolute -top-16 -left-12 size-44 rounded-full bg-gold/12 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-2xs tracking-wide text-ink-faint uppercase">
                Overall level
              </p>
              <p className="font-display text-4xl leading-none font-extrabold">
                {level.level}
              </p>
              <p className="mt-1 text-xs font-semibold text-gold-ink">
                {levelTitle(level.level)}
              </p>
            </div>
            <div className="text-right">
              <StreakFlame days={streak} />
              <p className="mt-1 text-2xs text-ink-faint tabular-nums">
                {compactNumber(totalXp)} XP total
              </p>
            </div>
          </div>
          <XpBar value={level.progress} className="mt-4" color="var(--color-gold)" />
          <p className="mt-1.5 text-2xs text-ink-faint tabular-nums">
            {compactNumber(level.levelSpan - level.intoLevel)} XP to level{" "}
            {level.level + 1}
          </p>
        </div>
      </Panel>

      {/* ---------------------------------------------------------- Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile value={achievementContext.activeDays} label="Active days" />
        <StatTile value={fullyCompletedDays} label="All-done days" />
        <StatTile value={earned.length} label="Achievements" />
      </div>

      {logs.length === 0 ? (
        <section>
          <SectionTitle>Progress over time</SectionTitle>
          <Panel className="p-6 text-center">
            <p className="text-sm font-semibold">Your history starts with one check-in.</p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-mute">
              Complete, partially log, or intentionally skip a quest. Your XP trend and
              four-week activity map will grow from there.
            </p>
            <Link
              href="/dashboard"
              className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4" })}
            >
              Open today&apos;s board
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Panel>
        </section>
      ) : (
        <>
          {/* ------------------------------------------------------ XP chart */}
          <section>
            <SectionTitle>XP, last two weeks</SectionTitle>
            <Panel className="p-4">
              {xpPeriodTotal === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm font-medium">No XP earned in this window.</p>
                  <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-mute">
                    Partial work still earns XP. Complete or partially log a quest to start
                    the next bar.
                  </p>
                </div>
              ) : (
                <>
                  <div role="img" aria-label={`XP over the last two weeks. ${xpSummary}`}>
                    <div className="flex h-28 items-end gap-1.5" aria-hidden>
                      {xpSeries.map((point, i) => (
                        <div
                          key={point.day}
                          className="flex flex-1 flex-col items-center gap-1.5"
                        >
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{
                              height: `${Math.max(point.height * 100, point.xp > 0 ? 8 : 2)}%`,
                            }}
                            transition={{
                              delay: i * 0.03,
                              duration: 0.5,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className={cn(
                              "w-full rounded-t-md",
                              point.xp > 0
                                ? "bg-linear-to-t from-violet/40 to-cyan"
                                : "bg-surface-3",
                            )}
                            style={
                              point.xp > 0
                                ? { boxShadow: "0 0 12px -3px var(--color-cyan)" }
                                : undefined
                            }
                          />
                          <span className="text-2xs text-ink-faint tabular-nums">
                            {fromDayKey(point.day).getDate()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-ink-mute">{xpSummary}</p>
                </>
              )}
            </Panel>
          </section>

          {/* -------------------------------------------------------- Heatmap */}
          <section>
            <SectionTitle>Showing up, last four weeks</SectionTitle>
            <Panel className="p-4">
              <div
                role="group"
                aria-label="Daily completion for the last four weeks"
                aria-describedby="journey-heat-summary"
              >
                <DayHeatmap cells={heatCells} color="var(--color-violet)" />
              </div>
              <p
                id="journey-heat-summary"
                className="mt-3 text-xs leading-relaxed text-ink-mute"
              >
                {heatSummary}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-faint">
                Partial check-ins count as half; intentional skips resolve the day without
                counting as completion.
              </p>
            </Panel>
          </section>
        </>
      )}

      {/* --------------------------------------------------- Achievements */}
      <section>
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => setShowLocked((v) => !v)}
              className="tappable inline-flex min-h-11 items-center text-2xs font-semibold text-violet-soft"
            >
              {showLocked ? "Hide locked" : "Show all"}
            </button>
          }
        >
          Achievements · {earned.length}/{achievements.length}
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2.5">
          {earned.map((item) => (
            <AchievementTile
              key={item.def.id}
              name={item.def.name}
              description={item.def.description}
              tier={item.def.tier}
              domainColor={
                item.def.domain ? getDomain(item.def.domain).ink : undefined
              }
              unlocked
              justNow={recentlyUnlocked.has(item.def.id)}
            />
          ))}
          {showLocked &&
            pending.map((item) => (
              <AchievementTile
                key={item.def.id}
                name={item.def.name}
                description={item.def.description}
                tier={item.def.tier}
                domainColor={
                  item.def.domain ? getDomain(item.def.domain).ink : undefined
                }
                progress={item.progress}
                progressLabel={item.label}
              />
            ))}
        </div>

        {earned.length === 0 && !showLocked && (
          <Panel className="p-6 text-center">
            <p className="text-sm text-ink-mute">
              Nothing unlocked yet. Log one quest and that changes.
            </p>
          </Panel>
        )}
      </section>
    </main>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <Panel className="p-3.5 text-center">
      <p className="font-display text-xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-0.5 text-2xs text-ink-faint">{label}</p>
    </Panel>
  );
}

function AchievementTile({
  name,
  description,
  tier,
  domainColor,
  unlocked = false,
  progress = 0,
  progressLabel,
  justNow = false,
}: {
  name: string;
  description: string;
  tier: keyof typeof TIERS;
  domainColor?: string;
  unlocked?: boolean;
  progress?: number;
  progressLabel?: string;
  justNow?: boolean;
}) {
  const color = domainColor ?? TIERS[tier].color;
  return (
    <div
      className={cn(
        "panel relative overflow-hidden rounded-2xl p-3.5",
        !unlocked && "opacity-70",
      )}
      style={unlocked ? { borderColor: `color-mix(in oklab, ${color} 40%, transparent)` } : undefined}
    >
      {justNow && (
        <span className="absolute top-2 right-2 rounded-full bg-gold px-1.5 py-0.5 text-[0.5rem] font-bold text-on-accent">
          NEW
        </span>
      )}
      <span
        className="mb-2.5 grid size-9 place-items-center rounded-xl"
        style={{
          background: unlocked
            ? `color-mix(in oklab, ${color} 20%, transparent)`
            : "var(--color-surface-2)",
          color: unlocked ? color : "var(--color-ink-faint)",
          boxShadow: unlocked ? `0 0 18px -6px ${color}` : undefined,
        }}
      >
        {unlocked ? <Award className="size-4.5" /> : <Lock className="size-4" />}
      </span>
      <p className="text-xs leading-snug font-semibold">{name}</p>
      <p className="mt-1 text-2xs leading-relaxed text-ink-faint">{description}</p>

      {!unlocked && progress > 0 && (
        <>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress * 100}%`, background: color }}
            />
          </div>
          {progressLabel && (
            <p className="mt-1 text-[0.5625rem] text-ink-faint tabular-nums">
              {progressLabel}
            </p>
          )}
        </>
      )}
    </div>
  );
}
