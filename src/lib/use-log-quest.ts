"use client";

import { useCallback } from "react";
import { buildAchievementContext } from "./analysis";
import { newlyUnlocked } from "./achievements";
import { useCompanion } from "./companion";
import { indexLogs, questStreak, xpForLog } from "./game";
import { useGame } from "./store";
import type { LogStatus, Quest } from "./types";

/**
 * Log a quest and fire off everything that should follow.
 *
 * Centralised because completing a quest is never just a write: it changes XP,
 * can level up a domain and the player, can unlock achievements, and needs to
 * tell the companion so it can react. Duplicating that across every surface
 * that renders a quest card is how celebrations end up firing inconsistently.
 */
export function useLogQuest() {
  const logQuest = useGame((s) => s.logQuest);
  const clearLog = useGame((s) => s.clearLog);
  const unlock = useGame((s) => s.unlock);
  const react = useCompanion((s) => s.reactToCompletion);

  const log = useCallback(
    (quest: Quest, status: LogStatus, value?: number) => {
      const before = useGame.getState();
      const beforeCtx = buildAchievementContext(
        before.quests,
        before.logs,
        before.profile,
      );
      const beforeDomainLevel = beforeCtx.domains[quest.domain].level.level;
      const beforeLevel = beforeCtx.overallLevel;

      logQuest(quest.id, status, value);

      const after = useGame.getState();
      const afterCtx = buildAchievementContext(
        after.quests,
        after.logs,
        after.profile,
      );

      const fresh = newlyUnlocked(
        afterCtx,
        after.unlocked.map((u) => u.id),
      );
      if (fresh.length > 0) unlock(fresh);

      if (status === "skipped") return;

      const streak = questStreak(quest, indexLogs(after.logs));
      react({
        quest,
        streak,
        xp: xpForLog(quest, status, streak),
        leveledUp: afterCtx.overallLevel > beforeLevel,
        domainLeveledUp:
          afterCtx.domains[quest.domain].level.level > beforeDomainLevel,
      });
    },
    [logQuest, unlock, react],
  );

  const clear = useCallback(
    (quest: Quest) => clearLog(quest.id),
    [clearLog],
  );

  return { log, clear };
}
