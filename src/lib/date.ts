import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import type { DayKey } from "./types";

/**
 * All day arithmetic runs on local-time `yyyy-MM-dd` keys.
 *
 * This is deliberate: a habit done at 11pm belongs to that day for the player,
 * regardless of what UTC thinks. Storing UTC timestamps and formatting later is
 * how streak trackers end up "losing" a day for anyone east of London.
 */

export function toDayKey(date: Date = new Date()): DayKey {
  return format(date, "yyyy-MM-dd");
}

export function fromDayKey(key: DayKey): Date {
  // parseISO on a date-only string yields local midnight, which is what we want.
  return parseISO(key);
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

export function shiftDay(key: DayKey, days: number): DayKey {
  return toDayKey(addDays(fromDayKey(key), days));
}

export function daysBetween(a: DayKey, b: DayKey): number {
  return differenceInCalendarDays(fromDayKey(b), fromDayKey(a));
}

/** Most recent `count` days, oldest first, ending at `end` (inclusive). */
export function dayRange(count: number, end: DayKey = todayKey()): DayKey[] {
  const out: DayKey[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftDay(end, -i));
  return out;
}

/** Day of week, 0 = Sunday, matching Cadence.specific-days. */
export function weekdayOf(key: DayKey): number {
  return fromDayKey(key).getDay();
}

/** Week bucket key (Monday-based) — used for times-per-week cadence. */
export function weekKeyOf(key: DayKey): string {
  return toDayKey(startOfWeek(fromDayKey(key), { weekStartsOn: 1 }));
}

export function weekBounds(key: DayKey): { start: DayKey; end: DayKey } {
  const d = fromDayKey(key);
  return {
    start: toDayKey(startOfWeek(d, { weekStartsOn: 1 })),
    end: toDayKey(endOfWeek(d, { weekStartsOn: 1 })),
  };
}

export function monthKeyOf(key: DayKey): string {
  return format(fromDayKey(key), "yyyy-MM");
}

export function monthBounds(key: DayKey): { start: DayKey; end: DayKey } {
  const d = fromDayKey(key);
  return { start: toDayKey(startOfMonth(d)), end: toDayKey(endOfMonth(d)) };
}

export function prettyDay(key: DayKey): string {
  const diff = daysBetween(key, todayKey());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  return format(fromDayKey(key), "EEE d MMM");
}

/** Which part of the day it is — drives greetings and the quest sort order. */
export function timeOfDay(now: Date = new Date()): "morning" | "afternoon" | "evening" | "night" {
  const h = now.getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "night";
}

export function greetingFor(now: Date = new Date()): string {
  switch (timeOfDay(now)) {
    case "morning":
      return "Good morning";
    case "afternoon":
      return "Good afternoon";
    case "evening":
      return "Good evening";
    default:
      return "Still up";
  }
}

export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
