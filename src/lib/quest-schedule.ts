import type { Cadence, DayKey, LogStatus, Quest } from "./types";

type QuestSchedule = Pick<Quest, "createdAt" | "archivedAt" | "activePeriods">;
type FlexibleCadence = Extract<
  Cadence,
  { kind: "times-per-week" | "times-per-month" }
>;

/** One completion scale shared by XP, vitality and activity charts. */
export function completionCredit(status?: LogStatus): number {
  if (status === "done") return 1;
  if (status === "partial") return 0.5;
  return 0;
}

/** Whether the quest's schedule was active on this local calendar day. */
export function questWasActiveOnDay(quest: QuestSchedule, day: DayKey): boolean {
  if (quest.activePeriods?.length) {
    return quest.activePeriods.some((period) => {
      const started = period.startedAt.slice(0, 10);
      const ended = period.endedAt?.slice(0, 10);
      return started <= day && (!ended || ended > day);
    });
  }

  // Legacy quests predate explicit intervals. Retain their original
  // created/archive behavior until the first pause or restore records periods.
  if (quest.createdAt.slice(0, 10) > day) return false;
  return !quest.archivedAt || quest.archivedAt.slice(0, 10) > day;
}

/** A recorded check-in is history even if the schedule was paused that day. */
export function questBelongsOnDay(
  quest: QuestSchedule,
  day: DayKey,
  hasLog: boolean,
): boolean {
  return hasLog || questWasActiveOnDay(quest, day);
}

/**
 * Flexible quotas are evaluated before today's response.
 *
 * This keeps the quota-closing check-in on the board instead of making a
 * 1x/week quest disappear the instant the player taps it.
 */
export function flexibleQuestBelongsOnDay(
  cadence: FlexibleCadence,
  completionsBeforeToday: number,
  hasLogToday: boolean,
): boolean {
  return completionsBeforeToday < cadence.times || hasLogToday;
}
