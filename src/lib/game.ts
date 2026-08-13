import { DOMAIN_IDS } from "./domains";
import {
  completionCredit,
  flexibleQuestBelongsOnDay,
  questBelongsOnDay,
  questWasActiveOnDay,
} from "./quest-schedule";
import {
  dayRange,
  daysBetween,
  monthBounds,
  shiftDay,
  todayKey,
  weekBounds,
  weekdayOf,
} from "./date";
import type {
  DayKey,
  Difficulty,
  DomainId,
  DomainState,
  DueQuest,
  LevelInfo,
  LogEntry,
  LogStatus,
  Quest,
} from "./types";

/* ================================================================== *
 * XP
 * ================================================================== */

const BASE_XP: Record<Difficulty, number> = { 1: 10, 2: 20, 3: 35 };
export { completionCredit } from "./quest-schedule";

/** Streak bonus tops out at +25% so late-game days never trivialise early ones. */
function streakMultiplier(streak: number): number {
  return 1 + Math.min(Math.floor(streak / 7), 5) * 0.05;
}

export function xpForLog(
  quest: Quest,
  status: LogStatus,
  streak = 0,
): number {
  const base = BASE_XP[quest.difficulty] * completionCredit(status);
  return Math.round(base * streakMultiplier(streak));
}

/* ================================================================== *
 * Levels
 * ================================================================== */

/**
 * Cumulative XP required to *reach* a level.
 *
 * The exponent keeps early levels quick (a good first day lands level 2) while
 * stretching later ones enough that a 6-month streak still feels like it's
 * going somewhere.
 */
function cumulativeXp(level: number, factor: number, exponent: number): number {
  if (level <= 1) return 0;
  return Math.round(factor * Math.pow(level - 1, exponent));
}

function levelFrom(xp: number, factor: number, exponent: number): LevelInfo {
  const safeXp = Math.max(0, Math.round(xp));
  let level = 1;
  // Levels are cheap to walk and this caps out well before any real player.
  while (level < 999 && cumulativeXp(level + 1, factor, exponent) <= safeXp) {
    level++;
  }
  const floor = cumulativeXp(level, factor, exponent);
  const ceil = cumulativeXp(level + 1, factor, exponent);
  const span = Math.max(1, ceil - floor);
  const into = safeXp - floor;
  return {
    level,
    intoLevel: into,
    levelSpan: span,
    progress: Math.min(1, into / span),
    totalXp: safeXp,
  };
}

/** Per-domain progression — fast enough to feel responsive day to day. */
export function domainLevel(xp: number): LevelInfo {
  return levelFrom(xp, 60, 1.6);
}

/** Overall progression across all seven domains — deliberately slower. */
export function overallLevel(xp: number): LevelInfo {
  return levelFrom(xp, 220, 1.7);
}

/** Flavour title shown next to the overall level. */
export function levelTitle(level: number): string {
  if (level >= 40) return "Legend";
  if (level >= 30) return "Luminary";
  if (level >= 22) return "Voyager";
  if (level >= 16) return "Pathfinder";
  if (level >= 11) return "Navigator";
  if (level >= 7) return "Explorer";
  if (level >= 4) return "Apprentice";
  if (level >= 2) return "Spark";
  return "Newborn Star";
}

/* ================================================================== *
 * Log indexing
 * ================================================================== */

export interface LogIndex {
  byQuestDay: Map<string, LogEntry>;
  byDay: Map<DayKey, LogEntry[]>;
}

const key = (questId: string, day: DayKey) => `${questId}|${day}`;

export function indexLogs(logs: LogEntry[]): LogIndex {
  const byQuestDay = new Map<string, LogEntry>();
  const byDay = new Map<DayKey, LogEntry[]>();
  for (const log of logs) {
    // Last write wins — the store already de-dupes, this is belt and braces.
    byQuestDay.set(key(log.questId, log.date), log);
    const list = byDay.get(log.date);
    if (list) list.push(log);
    else byDay.set(log.date, [log]);
  }
  return { byQuestDay, byDay };
}

export function logFor(
  index: LogIndex,
  questId: string,
  day: DayKey,
): LogEntry | undefined {
  return index.byQuestDay.get(key(questId, day));
}

/* ================================================================== *
 * Cadence resolution
 * ================================================================== */

function countInRange(
  index: LogIndex,
  questId: string,
  start: DayKey,
  end: DayKey,
): number {
  let n = 0;
  const span = daysBetween(start, end);
  for (let i = 0; i <= span; i++) {
    const log = logFor(index, questId, shiftDay(start, i));
    if (log && log.status !== "skipped") n++;
  }
  return n;
}

/** How many completions the cadence asks for in the period containing `day`. */
export function periodProgress(
  quest: Quest,
  index: LogIndex,
  day: DayKey,
): { done: number; target: number } {
  switch (quest.cadence.kind) {
    case "times-per-week": {
      const { start, end } = weekBounds(day);
      return {
        done: countInRange(index, quest.id, start, end),
        target: quest.cadence.times,
      };
    }
    case "times-per-month": {
      const { start, end } = monthBounds(day);
      return {
        done: countInRange(index, quest.id, start, end),
        target: quest.cadence.times,
      };
    }
    default: {
      const log = logFor(index, quest.id, day);
      return { done: log && log.status !== "skipped" ? 1 : 0, target: 1 };
    }
  }
}

export function isQuestDue(
  quest: Quest,
  index: LogIndex,
  day: DayKey,
): boolean {
  if (quest.archivedAt) return false;
  switch (quest.cadence.kind) {
    case "daily":
      return true;
    case "specific-days":
      return quest.cadence.days.includes(weekdayOf(day));
    case "times-per-week":
    case "times-per-month": {
      // Flexible cadences stay "available" until the quota is met, then rest.
      const { done, target } = periodProgress(quest, index, day);
      return done < target;
    }
  }
}

/**
 * Whether a quest belongs in a historical day view.
 *
 * Creation and archive timestamps are instants while the game calendar is a
 * local day key. Comparing their leading date is the best deterministic
 * eligibility boundary available in the current persisted schema. A real log
 * always wins: management actions must never hide recorded history.
 */
function isQuestDueOnHistoricalDay(
  quest: Quest,
  index: LogIndex,
  day: DayKey,
): boolean {
  if (!questWasActiveOnDay(quest, day)) return false;
  switch (quest.cadence.kind) {
    case "daily":
      return true;
    case "specific-days":
      return quest.cadence.days.includes(weekdayOf(day));
    case "times-per-week":
    case "times-per-month": {
      const start =
        quest.cadence.kind === "times-per-week"
          ? weekBounds(day).start
          : monthBounds(day).start;
      const doneBeforeToday = countInRange(index, quest.id, start, shiftDay(day, -1));
      return flexibleQuestBelongsOnDay(
        quest.cadence,
        doneBeforeToday,
        !!logFor(index, quest.id, day),
      );
    }
  }
}

/* ================================================================== *
 * Streaks
 * ================================================================== */

/**
 * Consecutive completed periods for a quest.
 *
 * The current period never *breaks* a streak — an unfinished today is simply
 * not counted yet. Punishing someone at 9am for not having done their evening
 * habit is exactly the kind of friction this app exists to avoid.
 */
export function questStreak(
  quest: Quest,
  index: LogIndex,
  today: DayKey = todayKey(),
): number {
  if (quest.cadence.kind === "times-per-week") {
    let streak = 0;
    let cursor = today;
    for (let i = 0; i < 104; i++) {
      const { start, end } = weekBounds(cursor);
      const done = countInRange(index, quest.id, start, end);
      const met = done >= quest.cadence.times;
      if (met) streak++;
      else if (i > 0) break;
      cursor = shiftDay(start, -1);
    }
    return streak;
  }

  if (quest.cadence.kind === "times-per-month") {
    let streak = 0;
    let cursor = today;
    for (let i = 0; i < 36; i++) {
      const { start, end } = monthBounds(cursor);
      const done = countInRange(index, quest.id, start, end);
      const met = done >= quest.cadence.times;
      if (met) streak++;
      else if (i > 0) break;
      cursor = shiftDay(start, -1);
    }
    return streak;
  }

  // daily / specific-days: walk back over the days the quest was actually due.
  let streak = 0;
  let cursor = today;
  for (let i = 0; i < 730; i++) {
    const dueToday =
      quest.cadence.kind === "daily" ||
      quest.cadence.days.includes(weekdayOf(cursor));
    if (dueToday) {
      const log = logFor(index, quest.id, cursor);
      const completed = !!log && log.status !== "skipped";
      if (completed) streak++;
      else if (i === 0) {
        // Today is still open — keep walking without counting it.
      } else break;
    }
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/** Consecutive days with at least one completion anywhere. */
export function overallStreak(
  index: LogIndex,
  today: DayKey = todayKey(),
): number {
  let streak = 0;
  let cursor = today;
  for (let i = 0; i < 3650; i++) {
    const logs = index.byDay.get(cursor) ?? [];
    const any = logs.some((l) => l.status !== "skipped");
    if (any) streak++;
    else if (i > 0) break;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/** Consecutive days with at least one completion inside a single domain. */
export function domainStreak(
  domain: DomainId,
  quests: Quest[],
  index: LogIndex,
  today: DayKey = todayKey(),
): number {
  const ids = new Set(quests.filter((q) => q.domain === domain).map((q) => q.id));
  if (ids.size === 0) return 0;
  let streak = 0;
  let cursor = today;
  for (let i = 0; i < 3650; i++) {
    const logs = index.byDay.get(cursor) ?? [];
    const any = logs.some((l) => ids.has(l.questId) && l.status !== "skipped");
    if (any) streak++;
    else if (i > 0) break;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/* ================================================================== *
 * Vitality & adherence
 * ================================================================== */

/**
 * Adherence over a trailing window, weighted so recent days matter more
 * (half-life ≈ 5 days). Returns 0–1, or null when nothing was ever due.
 */
export function weightedAdherence(
  quests: Quest[],
  index: LogIndex,
  windowDays: number,
  end: DayKey = todayKey(),
): number | null {
  const days = dayRange(windowDays, end);
  let weightedDone = 0;
  let weightedDue = 0;

  days.forEach((day, i) => {
    // i = 0 is the oldest day in the window.
    const age = windowDays - 1 - i;
    const weight = Math.pow(0.5, age / 5);
    for (const quest of quests) {
      if (!questWasActiveOnDay(quest, day)) continue;

      const due =
        quest.cadence.kind === "daily"
          ? true
          : quest.cadence.kind === "specific-days"
            ? quest.cadence.days.includes(weekdayOf(day))
            : false;

      if (due) {
        weightedDue += weight;
        const log = logFor(index, quest.id, day);
        if (log) weightedDone += weight * completionCredit(log.status);
      } else if (
        quest.cadence.kind === "times-per-week" ||
        quest.cadence.kind === "times-per-month"
      ) {
        // Flexible cadences are scored per period, spread across its days.
        const { target } = periodProgress(quest, index, day);
        const periodDays = quest.cadence.kind === "times-per-week" ? 7 : 30;
        const share = target / periodDays;
        weightedDue += weight * share;
        const log = logFor(index, quest.id, day);
        if (log) weightedDone += weight * share * completionCredit(log.status);
      }
    }
  });

  if (weightedDue === 0) return null;
  return Math.min(1, weightedDone / weightedDue);
}

/* ================================================================== *
 * Aggregate state
 * ================================================================== */

export function totalXpFor(
  quests: Quest[],
  logs: LogEntry[],
  index: LogIndex,
): Record<DomainId, number> {
  const questMap = new Map(quests.map((q) => [q.id, q]));
  const xp = Object.fromEntries(DOMAIN_IDS.map((d) => [d, 0])) as Record<
    DomainId,
    number
  >;
  // Streak-at-time-of-logging is approximated by the quest's current streak,
  // which keeps totals stable when history is edited after the fact.
  const streakCache = new Map<string, number>();
  for (const log of logs) {
    const quest = questMap.get(log.questId);
    if (!quest) continue;
    let streak = streakCache.get(quest.id);
    if (streak === undefined) {
      streak = questStreak(quest, index, log.date);
      streakCache.set(quest.id, streak);
    }
    xp[quest.domain] += xpForLog(quest, log.status, streak);
  }
  return xp;
}

export function buildDomainStates(
  quests: Quest[],
  logs: LogEntry[],
  today: DayKey = todayKey(),
): Record<DomainId, DomainState> {
  const index = indexLogs(logs);
  const xpByDomain = totalXpFor(quests, logs, index);

  const out = {} as Record<DomainId, DomainState>;
  for (const domain of DOMAIN_IDS) {
    const domainQuests = quests.filter((q) => q.domain === domain);
    const activeDomainQuests = domainQuests.filter((q) => !q.archivedAt);
    const recent = weightedAdherence(domainQuests, index, 14, today);
    const prior = weightedAdherence(
      domainQuests,
      index,
      14,
      shiftDay(today, -14),
    );
    const adherence = recent ?? 0;

    out[domain] = {
      domain,
      xp: xpByDomain[domain],
      level: domainLevel(xpByDomain[domain]),
      vitality: Math.round(adherence * 100),
      streak: domainStreak(domain, quests, index, today),
      adherence,
      trend: recent !== null && prior !== null ? recent - prior : 0,
      questCount: activeDomainQuests.length,
    };
  }
  return out;
}

/** Everything the dashboard needs about *today*, sorted for the UI. */
export function buildToday(
  quests: Quest[],
  logs: LogEntry[],
  day: DayKey = todayKey(),
): DueQuest[] {
  const index = indexLogs(logs);
  const windowRank: Record<Quest["window"], number> = {
    morning: 0,
    afternoon: 1,
    evening: 2,
    anytime: 3,
  };

  return quests
    .filter((quest) =>
      questBelongsOnDay(quest, day, !!logFor(index, quest.id, day)),
    )
    .map<DueQuest>((quest) => {
      const { done, target } = periodProgress(quest, index, day);
      return {
        quest,
        // Flexible-cadence quests remain visible on a day they were logged,
        // even when that check-in is the one that completed the quota.
        due: isQuestDueOnHistoricalDay(quest, index, day),
        log: logFor(index, quest.id, day),
        periodDone: done,
        periodTarget: target,
        streak: questStreak(quest, index, day),
      };
    })
    .sort((a, b) => {
      // Unanswered first; done, partial and skipped are all settled responses.
      const aResolved = !!a.log;
      const bResolved = !!b.log;
      if (aResolved !== bResolved) return aResolved ? 1 : -1;
      const w = windowRank[a.quest.window] - windowRank[b.quest.window];
      if (w !== 0) return w;
      return b.quest.difficulty - a.quest.difficulty;
    });
}

/** XP earned on a specific day — powers the daily counter and charts. */
export function xpOnDay(
  quests: Quest[],
  logs: LogEntry[],
  day: DayKey,
): number {
  const index = indexLogs(logs);
  const questMap = new Map(quests.map((q) => [q.id, q]));
  return (index.byDay.get(day) ?? []).reduce((sum, log) => {
    const quest = questMap.get(log.questId);
    if (!quest) return sum;
    return sum + xpForLog(quest, log.status, questStreak(quest, index, day));
  }, 0);
}
