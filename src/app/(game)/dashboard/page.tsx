"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Moon, Plus, Sunrise } from "lucide-react";
import { greetingFor, prettyDay, timeOfDay, todayKey } from "@/lib/date";
import { orderByPriority, DOMAIN_IDS } from "@/lib/domains";
import { levelTitle } from "@/lib/game";
import { compactNumber } from "@/lib/format";
import { useSnapshot } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { useLogQuest } from "@/lib/use-log-quest";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { ProgressRing } from "@/components/ui/progress-ring";
import { XpBar } from "@/components/ui/xp-bar";
import { buttonClasses } from "@/components/ui/button";
import { DomainOrb } from "@/components/game/domain-orb";
import { QuestCard } from "@/components/game/quest-card";
import { StreakFlame } from "@/components/game/streak-flame";

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function DashboardPage() {
  const profile = useGame((s) => s.profile);
  const snapshot = useSnapshot();
  const { log, clear } = useLogQuest();
  const now = useNow();
  /*
   * Query params are read once, in a lazy initialiser rather than an effect.
   *
   * `useSearchParams` would drag this whole page behind a Suspense boundary,
   * and reading in an effect would mean an extra render just to apply them.
   * This subtree only ever renders on the client (the layout holds back until
   * the store has hydrated), so there's no server/client mismatch to worry
   * about.
   */
  const [welcome, setWelcome] = useState(() => readParam("welcome") !== null);
  const [focusId, setFocusId] = useState<string | null>(() => readParam("focus"));

  // Let the highlight fade on its own so it draws the eye without sticking.
  useEffect(() => {
    if (!focusId) return;
    const timer = setTimeout(() => setFocusId(null), 2600);
    return () => clearTimeout(timer);
  }, [focusId]);

  const { dueToday, doneToday, remainingToday, domains, level, streak } = snapshot;

  const dayProgress = dueToday.length === 0 ? 0 : doneToday.length / dueToday.length;
  const allDone = dueToday.length > 0 && remainingToday.length === 0;
  const first = profile?.displayName.split(" ")[0] ?? "there";

  const orderedDomains = useMemo(
    () => orderByPriority(DOMAIN_IDS, profile?.priorities ?? []),
    [profile?.priorities],
  );

  const part = now ? timeOfDay(now) : "morning";
  const greeting = now ? greetingFor(now) : "Hello";

  return (
    <main className="space-y-7 pt-6">
      {/* ------------------------------------------------------- Greeting */}
      <header>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs text-ink-mute">
              {part === "evening" || part === "night" ? (
                <Moon className="size-3.5" />
              ) : (
                <Sunrise className="size-3.5" />
              )}
              {greeting}
            </p>
            <h1 className="mt-1 truncate font-display text-2xl font-bold">{first}</h1>
          </div>
          <div className="shrink-0 text-right">
            <StreakFlame days={streak} />
            <p className="mt-0.5 text-2xs text-ink-faint">{prettyDay(todayKey())}</p>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------- Welcome note */}
      <AnimatePresence>
        {welcome && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Panel className="border-gold/35 bg-gold/8 p-4">
              <p className="text-sm font-semibold text-gold">Your world is live.</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">
                Tap any quest to log it — one tap is all it takes. Your report and promise
                letter are waiting in your profile.
              </p>
              <button
                type="button"
                onClick={() => setWelcome(false)}
                className="tappable mt-2.5 text-2xs font-semibold text-gold/80 underline underline-offset-2"
              >
                Got it
              </button>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------- Hero card */}
      <Panel className="relative overflow-hidden p-5">
        <div
          aria-hidden
          className="absolute -top-20 -right-16 size-52 rounded-full bg-violet/18 blur-3xl"
        />
        <div className="relative flex items-center gap-5">
          <ProgressRing
            value={dayProgress}
            size={94}
            stroke={7}
            color="var(--color-cyan)"
            glow
          >
            <div className="text-center">
              <p className="font-display text-xl leading-none font-extrabold tabular-nums">
                {doneToday.length}
                <span className="text-ink-faint">/{dueToday.length}</span>
              </p>
              <p className="mt-0.5 text-2xs text-ink-faint">today</p>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg font-bold">Level {level.level}</span>
              <span className="truncate text-2xs tracking-wide text-gold uppercase">
                {levelTitle(level.level)}
              </span>
            </div>
            <XpBar
              value={level.progress}
              className="mt-2.5"
              color="var(--color-violet)"
            />
            <p className="mt-1.5 text-2xs text-ink-faint tabular-nums">
              {compactNumber(level.intoLevel)} / {compactNumber(level.levelSpan)} XP to
              level {level.level + 1}
            </p>
          </div>
        </div>
      </Panel>

      {/* ---------------------------------------------------------- Today */}
      <section>
        <SectionTitle
          action={
            <Link
              href="/quests/new"
              className="tappable inline-flex items-center gap-1 text-2xs font-semibold text-violet-soft"
            >
              <Plus className="size-3.5" />
              Add quest
            </Link>
          }
        >
          {allDone ? "Today — complete" : "Today"}
        </SectionTitle>

        {dueToday.length === 0 ? (
          <Panel className="p-6 text-center">
            <p className="text-sm font-medium">Nothing scheduled today.</p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-mute">
              A quiet board is allowed. Add a quest when you&apos;re ready for one.
            </p>
            <Link
              href="/quests/new"
              className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4" })}
            >
              <Plus className="size-3.5" />
              Add your first quest
            </Link>
          </Panel>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {dueToday.map((item) => (
                <motion.div
                  key={item.quest.id}
                  layout
                  className={cn(
                    "rounded-2xl transition-shadow",
                    focusId === item.quest.id &&
                      "ring-2 ring-violet ring-offset-2 ring-offset-abyss",
                  )}
                >
                  <QuestCard
                    item={item}
                    onLog={(status, value) => log(item.quest, status, value)}
                    onClear={() => clear(item.quest)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3"
          >
            <Panel className="border-success/30 bg-success/8 p-4 text-center">
              <p className="text-sm font-semibold text-success">
                Board cleared. Every single thing.
              </p>
              <p className="mt-1 text-xs text-ink-dim">
                Rest is part of the game. Go enjoy the rest of your{" "}
                {part === "morning" ? "day" : "evening"}.
              </p>
            </Panel>
          </motion.div>
        )}
      </section>

      {/* --------------------------------------------------- Constellation */}
      <section>
        <SectionTitle
          action={
            <Link
              href="/map"
              className="tappable inline-flex items-center gap-0.5 text-2xs font-semibold text-violet-soft"
            >
              Full map
              <ChevronRight className="size-3.5" />
            </Link>
          }
        >
          Your constellation
        </SectionTitle>
        <div className="scroll-row -mx-5 flex gap-4 px-5 pb-2">
          {orderedDomains.map((id) => (
            <div key={id} className="shrink-0 scroll-ml-5" style={{ scrollSnapAlign: "start" }}>
              <DomainOrb state={domains[id]} href={`/domains/${id}`} size="md" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
