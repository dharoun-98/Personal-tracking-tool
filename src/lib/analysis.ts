import { DOMAIN_IDS } from "./domains";
import { todayKey } from "./date";
import {
  buildDomainStates,
  buildToday,
  indexLogs,
  overallLevel,
  overallStreak,
} from "./game";
import type { AchievementContext } from "./achievements";
import type { DayKey, DomainId, LogEntry, PlayerProfile, Quest } from "./types";

/**
 * Full-history analysis shared by the live UI and the achievement checker.
 *
 * Kept as a pure function (rather than living inside a hook) so the same code
 * runs when logging a quest, when rendering, and later when generating the PDF
 * report on the server.
 */
export function buildAchievementContext(
  quests: Quest[],
  logs: LogEntry[],
  profile: PlayerProfile | null,
  today: DayKey = todayKey(),
): AchievementContext {
  const domains = buildDomainStates(quests, logs, today);
  const index = indexLogs(logs);
  const totalXp = DOMAIN_IDS.reduce((sum, d) => sum + domains[d].xp, 0);
  const level = overallLevel(totalXp);

  const activeDayKeys = [...new Set(logs.map((l) => l.date))];
  const priorities = profile?.priorities.slice(0, 3) ?? [];
  const questById = new Map(quests.map((q) => [q.id, q]));

  let perfectDays = 0;
  let balancedDays = 0;

  for (const key of activeDayKeys) {
    const dayView = buildToday(quests, logs, key);
    const relevant = dayView.filter((t) => t.due || t.log);
    if (
      relevant.length > 0 &&
      relevant.every((t) => t.log && t.log.status !== "skipped")
    ) {
      perfectDays++;
    }

    if (priorities.length > 0) {
      const touched = new Set(
        (index.byDay.get(key) ?? [])
          .filter((l) => l.status !== "skipped")
          .map((l) => questById.get(l.questId)?.domain)
          .filter((d): d is DomainId => !!d),
      );
      if (priorities.every((d) => touched.has(d))) balancedDays++;
    }
  }

  return {
    quests,
    logs,
    domains,
    overallStreak: overallStreak(index, today),
    overallLevel: level.level,
    totalXp,
    activeDays: activeDayKeys.length,
    perfectDays,
    balancedDays,
  };
}
