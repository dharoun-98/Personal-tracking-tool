import type {
  DayReflection,
  Goal,
  LogEntry,
  LogStatus,
  PlayerProfile,
  Quest,
  UnlockedAchievement,
} from "@/lib/types";
import type {
  GoalRow,
  LogRow,
  ProfileRow,
  QuestRow,
  ReflectionRow,
  UnlockedAchievementRow,
} from "@/lib/supabase/types";

/* ==================================================================== *
 * Local shapes ⇄ database rows.
 *
 * Two mismatches to keep straight, both deliberate:
 *   `Quest.window` → `time_window` (WINDOW is reserved in Postgres)
 *   `LogEntry.date` → `day`        (clearer beside a `timestamptz at`)
 *
 * Optional fields are `undefined` locally and `null` in Postgres. The
 * conversion is explicit in both directions rather than relying on JSON
 * dropping undefined, which silently turns "unset" into "missing column".
 * ==================================================================== */

const nullable = <T>(value: T | undefined): T | null =>
  value === undefined ? null : value;

const optional = <T>(value: T | null): T | undefined =>
  value === null ? undefined : value;

/* ------------------------------------------------------------ profile -- */

export function profileToRow(
  profile: PlayerProfile,
  userId: string,
  onboardingComplete: boolean,
): Partial<ProfileRow> & { id: string } {
  return {
    id: userId,
    display_name: profile.displayName,
    priorities: profile.priorities,
    baselines: profile.baselines,
    visions: profile.visions,
    motivation_style: profile.motivationStyle,
    rhythm: profile.rhythm,
    daily_minutes: profile.dailyMinutes,
    promise: nullable(profile.promise),
    promise_horizon_months: profile.promiseHorizonMonths,
    timezone: profile.timezone,
    onboarding_complete: onboardingComplete,
    started_at: profile.createdAt,
  };
}

export function rowToProfile(row: ProfileRow): PlayerProfile {
  return {
    displayName: row.display_name,
    priorities: row.priorities ?? [],
    baselines: row.baselines,
    visions: row.visions ?? {},
    motivationStyle: row.motivation_style,
    rhythm: row.rhythm,
    dailyMinutes: row.daily_minutes,
    promise: optional(row.promise),
    promiseHorizonMonths: row.promise_horizon_months,
    timezone: row.timezone,
    createdAt: row.started_at ?? row.created_at,
  };
}

/* ------------------------------------------------------------- quests -- */

export function questToRow(quest: Quest, userId: string): QuestRow {
  return {
    id: quest.id,
    user_id: userId,
    domain: quest.domain,
    title: quest.title,
    detail: nullable(quest.detail),
    cadence: quest.cadence,
    kind: quest.kind,
    difficulty: quest.difficulty,
    time_window: quest.window,
    target: nullable(quest.target),
    unit: nullable(quest.unit),
    source: quest.source,
    created_at: quest.createdAt,
    active_periods: nullable(quest.activePeriods),
    archived_at: nullable(quest.archivedAt),
    updated_at: new Date().toISOString(),
  };
}

export function rowToQuest(row: QuestRow): Quest {
  const activePeriods = Array.isArray(row.active_periods)
    ? row.active_periods.filter(
        (period): period is { startedAt: string; endedAt?: string } =>
          !!period &&
          typeof period === "object" &&
          typeof period.startedAt === "string" &&
          (period.endedAt === undefined || typeof period.endedAt === "string"),
      )
    : undefined;
  return {
    id: row.id,
    domain: row.domain,
    title: row.title,
    detail: optional(row.detail),
    cadence: row.cadence,
    kind: row.kind,
    difficulty: row.difficulty as Quest["difficulty"],
    window: row.time_window,
    target: optional(row.target),
    unit: optional(row.unit),
    source: row.source as Quest["source"],
    createdAt: row.created_at,
    activePeriods: activePeriods?.length ? activePeriods : undefined,
    archivedAt: optional(row.archived_at),
  };
}

/* --------------------------------------------------------------- logs -- */

export function logToRow(log: LogEntry, userId: string): LogRow {
  return {
    id: log.id,
    user_id: userId,
    quest_id: log.questId,
    day: log.date,
    status: log.status,
    value: nullable(log.value),
    at: log.at,
  };
}

export function rowToLog(row: LogRow): LogEntry {
  return {
    id: row.id,
    questId: row.quest_id,
    date: row.day,
    status: row.status as LogStatus,
    value: optional(row.value),
    at: row.at,
  };
}

/* -------------------------------------------------------------- goals -- */

export function goalToRow(goal: Goal, userId: string): GoalRow {
  return {
    id: goal.id,
    user_id: userId,
    domain: goal.domain,
    title: goal.title,
    why: nullable(goal.why),
    target_date: nullable(goal.targetDate),
    target: nullable(goal.target),
    current: nullable(goal.current),
    unit: nullable(goal.unit),
    source: goal.source,
    created_at: goal.createdAt,
    completed_at: nullable(goal.completedAt),
    updated_at: new Date().toISOString(),
  };
}

export function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    domain: row.domain,
    title: row.title,
    why: optional(row.why),
    targetDate: optional(row.target_date),
    target: optional(row.target),
    current: optional(row.current),
    unit: optional(row.unit),
    source: row.source as Goal["source"],
    createdAt: row.created_at,
    completedAt: optional(row.completed_at),
  };
}

/* -------------------------------------------------------- reflections -- */

export function reflectionToRow(
  reflection: DayReflection,
  userId: string,
): ReflectionRow {
  return {
    user_id: userId,
    day: reflection.date,
    mood: nullable(reflection.mood),
    note: nullable(reflection.note),
    at: reflection.at,
  };
}

export function rowToReflection(row: ReflectionRow): DayReflection {
  return {
    date: row.day,
    mood: optional(row.mood),
    note: optional(row.note),
    at: row.at,
  };
}

/* ------------------------------------------------------- achievements -- */

export function achievementToRow(
  unlocked: UnlockedAchievement,
  userId: string,
): UnlockedAchievementRow {
  return {
    user_id: userId,
    achievement_id: unlocked.id,
    unlocked_at: unlocked.unlockedAt,
  };
}

export function rowToAchievement(
  row: UnlockedAchievementRow,
): UnlockedAchievement {
  return { id: row.achievement_id, unlockedAt: row.unlocked_at };
}
