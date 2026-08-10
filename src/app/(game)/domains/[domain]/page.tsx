"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { DOMAIN_IDS, getDomain } from "@/lib/domains";
import { buildToday } from "@/lib/game";
import { dayRange } from "@/lib/date";
import { compactNumber } from "@/lib/format";
import { useSnapshot } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { useLogQuest } from "@/lib/use-log-quest";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { XpBar } from "@/components/ui/xp-bar";
import { buttonClasses } from "@/components/ui/button";
import { DomainOrb } from "@/components/game/domain-orb";
import { QuestCard } from "@/components/game/quest-card";
import { StreakFlame } from "@/components/game/streak-flame";
import { DayHeatmap, type HeatCell } from "@/components/game/day-heatmap";
import type { DomainId } from "@/lib/types";

export default function DomainPage() {
  const params = useParams<{ domain: string }>();
  const domainId = params.domain as DomainId;
  const valid = DOMAIN_IDS.includes(domainId);

  const quests = useGame((s) => s.quests);
  const logs = useGame((s) => s.logs);
  const goals = useGame((s) => s.goals);
  const profile = useGame((s) => s.profile);
  const snapshot = useSnapshot();
  const { log, clear } = useLogQuest();

  const heatCells = useMemo<HeatCell[]>(() => {
    if (!valid) return [];
    return dayRange(28).map((date) => {
      const view = buildToday(quests, logs, date).filter(
        (t) => t.quest.domain === domainId && (t.due || t.log),
      );
      if (view.length === 0) return { date, value: null };
      const done = view.filter((t) => t.log && t.log.status !== "skipped").length;
      return { date, value: done / view.length };
    });
  }, [quests, logs, domainId, valid]);

  if (!valid) notFound();

  const meta = getDomain(domainId);
  const state = snapshot.domains[domainId];
  const todayItems = snapshot.today.filter(
    (t) => t.quest.domain === domainId && t.due,
  );
  const domainQuests = quests.filter((q) => q.domain === domainId && !q.archivedAt);
  const domainGoals = goals.filter((g) => g.domain === domainId && !g.completedAt);
  const vision = profile?.visions?.[domainId];
  const trendUp = state.trend >= 0;

  return (
    <main
      className="space-y-7 pt-6"
      style={{
        ["--accent" as string]: meta.color,
        ["--accent-ink" as string]: meta.ink,
      }}
    >
      <Link
        href="/map"
        className="tappable inline-flex items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Constellation
      </Link>

      {/* ---------------------------------------------------------- Header */}
      <header className="flex items-center gap-5">
        <DomainOrb state={state} size="lg" showLabel={false} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">{meta.name}</h1>
          <p className="mt-0.5 text-xs text-ink-mute">{meta.tagline}</p>
          <XpBar value={state.level.progress} className="mt-3" color={meta.color} />
          <p className="mt-1.5 text-2xs text-ink-faint tabular-nums">
            Level {state.level.level} · {compactNumber(state.level.intoLevel)}/
            {compactNumber(state.level.levelSpan)} XP
          </p>
        </div>
      </header>

      <p className="text-sm leading-relaxed text-ink-mute">{meta.blurb}</p>

      {/* ----------------------------------------------------------- Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <Panel className="p-3.5 text-center">
          <p className="font-display text-xl font-extrabold tabular-nums accent-text">
            {state.vitality}%
          </p>
          <p className="mt-0.5 text-2xs text-ink-faint">Vitality</p>
        </Panel>
        <Panel className="p-3.5 text-center">
          <div className="flex items-center justify-center">
            <StreakFlame days={state.streak} />
          </div>
          <p className="mt-0.5 text-2xs text-ink-faint">Day streak</p>
        </Panel>
        <Panel className="p-3.5 text-center">
          <p
            className={`flex items-center justify-center gap-1 font-display text-xl font-extrabold tabular-nums ${
              trendUp ? "text-success" : "text-danger"
            }`}
          >
            {trendUp ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
            {Math.abs(Math.round(state.trend * 100))}
          </p>
          <p className="mt-0.5 text-2xs text-ink-faint">vs last 2wk</p>
        </Panel>
      </div>

      {/* ---------------------------------------------------------- Vision */}
      {vision && (
        <Panel className="accent-border p-4">
          <p className="mb-1.5 text-2xs tracking-wide text-ink-faint uppercase">
            What winning looks like
          </p>
          <p className="text-sm leading-relaxed text-ink italic">&ldquo;{vision}&rdquo;</p>
        </Panel>
      )}

      {/* ----------------------------------------------------------- Today */}
      <section>
        <SectionTitle
          action={
            <Link
              href={`/quests/new?domain=${domainId}`}
              className="tappable inline-flex items-center gap-1 text-2xs font-semibold accent-text"
            >
              <Plus className="size-3.5" />
              Add
            </Link>
          }
        >
          Today
        </SectionTitle>

        {todayItems.length === 0 ? (
          <Panel className="p-5 text-center">
            <p className="text-sm font-medium">
              {domainQuests.length === 0 ? "This orb is dormant" : "Nothing due today"}
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-mute">
              {domainQuests.length === 0 ? meta.neglectNudge : "It'll come back around."}
            </p>
            {domainQuests.length === 0 && (
              <Link
                href={`/quests/new?domain=${domainId}`}
                className={buttonClasses({
                  variant: "accent",
                  size: "sm",
                  className: "mt-4",
                })}
              >
                <Plus className="size-3.5" />
                Light it up
              </Link>
            )}
          </Panel>
        ) : (
          <div className="space-y-2.5">
            {todayItems.map((item) => (
              <QuestCard
                key={item.quest.id}
                item={item}
                compact
                onLog={(status, value) => log(item.quest, status, value)}
                onClear={() => clear(item.quest)}
              />
            ))}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- Heatmap */}
      {domainQuests.length > 0 && (
        <section>
          <SectionTitle>Last four weeks</SectionTitle>
          <Panel className="p-4">
            <DayHeatmap cells={heatCells} color={meta.color} />
            <p className="mt-3 text-2xs text-ink-faint">
              Filled squares are days you showed up. Dashed ones had nothing scheduled.
            </p>
          </Panel>
        </section>
      )}

      {/* ----------------------------------------------------------- Goals */}
      {domainGoals.length > 0 && (
        <section>
          <SectionTitle>Goals</SectionTitle>
          <div className="space-y-2.5">
            {domainGoals.map((goal) => (
              <Panel key={goal.id} className="p-4">
                <p className="text-sm font-medium">{goal.title}</p>
                {goal.why && (
                  <p className="mt-1 text-2xs text-ink-faint">{goal.why}</p>
                )}
              </Panel>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ All quests */}
      {domainQuests.length > 0 && (
        <section>
          <SectionTitle>All quests here</SectionTitle>
          <Panel className="divide-y divide-hairline/60">
            {domainQuests.map((quest) => (
              <div key={quest.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{quest.title}</span>
                </span>
                <span className="shrink-0 text-2xs text-ink-faint">
                  {quest.difficulty === 1
                    ? "Light"
                    : quest.difficulty === 2
                      ? "Solid"
                      : "Heavy"}
                </span>
              </div>
            ))}
          </Panel>
        </section>
      )}
    </main>
  );
}
