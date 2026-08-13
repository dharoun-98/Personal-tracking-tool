"use client";

import { useMemo } from "react";
import { todayKey } from "./date";
import { buildToday, overallLevel } from "./game";
import { buildAchievementContext } from "./analysis";
import { evaluateAchievements, type AchievementContext } from "./achievements";
import { useGame } from "./store";
import { useNowMs } from "./use-now";
import type { DomainId, DomainState, DueQuest, LevelInfo } from "./types";

export interface GameSnapshot {
  today: DueQuest[];
  dueToday: DueQuest[];
  remainingToday: DueQuest[];
  doneToday: DueQuest[];
  partialToday: DueQuest[];
  skippedToday: DueQuest[];
  resolvedToday: DueQuest[];
  domains: Record<DomainId, DomainState>;
  level: LevelInfo;
  streak: number;
  totalXp: number;
  achievements: ReturnType<typeof evaluateAchievements>;
  achievementContext: AchievementContext;
}

/**
 * One memoised pass over the log history.
 *
 * Everything derived lives here rather than in components, so the maths runs
 * once per state change instead of once per subscriber.
 */
export function useSnapshot(): GameSnapshot {
  const quests = useGame((s) => s.quests);
  const logs = useGame((s) => s.logs);
  const profile = useGame((s) => s.profile);

  return useMemo(() => {
    const day = todayKey();
    const ctx = buildAchievementContext(quests, logs, profile, day);
    const today = buildToday(quests, logs, day);

    const dueToday = today.filter((t) => t.due);
    // A response and a completion are different things. Partial work and an
    // intentional skip both settle the quest for today, but neither should be
    // reported as fully done.
    const doneToday = dueToday.filter((t) => t.log?.status === "done");
    const partialToday = dueToday.filter((t) => t.log?.status === "partial");
    const skippedToday = dueToday.filter((t) => t.log?.status === "skipped");
    const resolvedToday = dueToday.filter((t) => t.log != null);
    const remainingToday = dueToday.filter((t) => !t.log);

    return {
      today,
      dueToday,
      remainingToday,
      doneToday,
      partialToday,
      skippedToday,
      resolvedToday,
      domains: ctx.domains,
      level: overallLevel(ctx.totalXp),
      streak: ctx.overallStreak,
      totalXp: ctx.totalXp,
      achievements: evaluateAchievements(ctx),
      achievementContext: ctx,
    };
  }, [quests, logs, profile]);
}

/**
 * Days remaining in the free trial. Negative once it has lapsed, `null` until
 * the clock has ticked on the client (and on the server, where "now" would be
 * a different instant than the browser's).
 */
export function useTrialDaysLeft(): number | null {
  const account = useGame((s) => s.account);
  const nowMs = useNowMs();

  return useMemo(() => {
    if (!account.trialStartedAt || nowMs === 0) return null;
    const started = new Date(account.trialStartedAt).getTime();
    const elapsed = (nowMs - started) / 86_400_000;
    return Math.ceil(account.trialDays - elapsed);
  }, [account, nowMs]);
}
