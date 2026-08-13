/**
 * Core domain model for the game.
 *
 * Everything here is plain data — no React, no browser APIs — so it can be
 * shared by the client store, the (future) Supabase sync layer, and the PDF
 * report generator without dragging dependencies along.
 */

export type DomainId =
  | "health"
  | "wealth"
  | "connections"
  | "purpose"
  | "growth"
  | "peace"
  | "fun";

/** yyyy-MM-dd in the player's *local* time. Never a UTC timestamp. */
export type DayKey = string;

/* ------------------------------------------------------------------ *
 * Quests (the recurring things a player tracks)
 * ------------------------------------------------------------------ */

export type Cadence =
  | { kind: "daily" }
  | { kind: "times-per-week"; times: number }
  | { kind: "specific-days"; days: number[] } // 0 = Sunday
  | { kind: "times-per-month"; times: number };

/** How a quest is completed — drives which check-in control we render. */
export type QuestKind =
  | "binary" // did it / didn't
  | "count" // 8 glasses of water
  | "duration" // 30 minutes
  | "amount"; // $200 saved

export type QuestWindow = "morning" | "afternoon" | "evening" | "anytime";

/** 1 = light, 2 = solid, 3 = heavy. Drives XP and visual weight. */
export type Difficulty = 1 | 2 | 3;

export interface Quest {
  id: string;
  domain: DomainId;
  title: string;
  detail?: string;
  cadence: Cadence;
  kind: QuestKind;
  difficulty: Difficulty;
  window: QuestWindow;
  /** For count/duration/amount quests. */
  target?: number;
  unit?: string;
  createdAt: string;
  /** Schedule intervals retained across pause/restore for honest history. */
  activePeriods?: Array<{ startedAt: string; endedAt?: string }>;
  archivedAt?: string;
  source: "onboarding" | "user" | "suggested";
}

/* ------------------------------------------------------------------ *
 * Logs
 * ------------------------------------------------------------------ */

export type LogStatus = "done" | "partial" | "skipped";

export interface LogEntry {
  id: string;
  questId: string;
  date: DayKey;
  status: LogStatus;
  /** Actual value for count/duration/amount quests. */
  value?: number;
  /** ISO timestamp of when it was logged (not the day it counts for). */
  at: string;
}

export interface DayReflection {
  date: DayKey;
  /** 1 (rough) … 5 (great). */
  mood?: number;
  note?: string;
  at: string;
}

/* ------------------------------------------------------------------ *
 * Goals & achievements
 * ------------------------------------------------------------------ */

export interface Goal {
  id: string;
  domain: DomainId;
  title: string;
  why?: string;
  targetDate?: DayKey;
  /** Optional numeric target, e.g. save 5000. */
  target?: number;
  current?: number;
  unit?: string;
  createdAt: string;
  completedAt?: string;
  source: "onboarding" | "user";
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Which domain it belongs to, or null for cross-domain. */
  domain: DomainId | null;
  tier: "bronze" | "silver" | "gold" | "mythic";
  /** Hidden achievements aren't listed until unlocked. */
  secret?: boolean;
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string;
}

/* ------------------------------------------------------------------ *
 * Player profile (produced by onboarding)
 * ------------------------------------------------------------------ */

export type MotivationStyle =
  | "cheerleader" // warm, celebratory
  | "coach" // direct, practical
  | "sage" // calm, reflective
  | "rival"; // competitive, playful challenge

export type CheckInRhythm = "morning" | "evening" | "both" | "flexible";

export interface PlayerProfile {
  displayName: string;
  /** Ranked highest-priority first. Used to order the dashboard. */
  priorities: DomainId[];
  /** Self-rated 1–10 starting score per domain. */
  baselines: Record<DomainId, number>;
  /** Free-text "what does winning look like" per prioritised domain. */
  visions: Partial<Record<DomainId, string>>;
  motivationStyle: MotivationStyle;
  rhythm: CheckInRhythm;
  /** Minutes per day the player realistically has. Scales quest load. */
  dailyMinutes: number;
  /** The one-line promise that anchors the promise-to-future-self PDF. */
  promise?: string;
  /** Horizon for the promise, in months. */
  promiseHorizonMonths: number;
  timezone: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * Derived / computed shapes
 * ------------------------------------------------------------------ */

export interface LevelInfo {
  level: number;
  /** XP accumulated inside the current level. */
  intoLevel: number;
  /** XP required to move from current level to the next. */
  levelSpan: number;
  /** 0–1 progress through the current level. */
  progress: number;
  totalXp: number;
}

export interface DomainState {
  domain: DomainId;
  xp: number;
  level: LevelInfo;
  /** 0–100 "how alive is this part of your life right now". */
  vitality: number;
  /** Consecutive days with at least one completion in this domain. */
  streak: number;
  /** Completion rate over the trailing 14 days, 0–1. */
  adherence: number;
  /** Positive = improving vs the previous window. */
  trend: number;
  questCount: number;
}

/** A quest resolved against a specific day — what the UI actually renders. */
export interface DueQuest {
  quest: Quest;
  due: boolean;
  log?: LogEntry;
  /** For times-per-week/month quests: progress within the period. */
  periodDone: number;
  periodTarget: number;
  streak: number;
}
