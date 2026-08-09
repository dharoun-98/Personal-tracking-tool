"use client";

import { create } from "zustand";
import { buildAchievementContext } from "./analysis";
import { coachStatusLine, selectCoachMessage, type CoachMessage } from "./coach";
import { buildToday, overallLevel } from "./game";
import { useGame } from "./store";
import type { Quest } from "./types";

export type CompanionMood = "idle" | "happy" | "curious" | "proud" | "sleepy";

export interface CompanionPulse {
  /** Changes every time, so repeats of the same celebration still replay. */
  id: number;
  mood: CompanionMood;
  intensity: "normal" | "big";
  xp: number;
}

export interface CompletionInput {
  quest: Quest;
  streak: number;
  xp: number;
  leveledUp: boolean;
  domainLeveledUp: boolean;
}

interface CompanionState {
  bubble: CoachMessage | null;
  pulse: CompanionPulse | null;
  say: (message: CoachMessage) => void;
  hide: () => void;
  clearPulse: () => void;
  /** Pick a message for the current moment; returns false if all on cooldown. */
  speakUp: () => boolean;
  /** Say something true and harmless when everything is on cooldown. */
  sayStatus: () => void;
  reactToCompletion: (input: CompletionInput) => void;
}

/* -------------------------------------------------------------------- *
 * Context assembly
 * -------------------------------------------------------------------- */

function coachContext(justCompleted?: CompletionInput) {
  const state = useGame.getState();
  if (!state.profile) return null;

  const ctx = buildAchievementContext(state.quests, state.logs, state.profile);
  return {
    now: new Date(),
    profile: state.profile,
    today: buildToday(state.quests, state.logs),
    domains: ctx.domains,
    overallStreak: ctx.overallStreak,
    level: overallLevel(ctx.totalXp),
    totalLogs: state.logs.length,
    justCompleted,
    lastSeenAt: state.previousSeenAt,
    cooldowns: state.coachCooldowns,
  };
}

let pulseCounter = 0;

/**
 * The companion's voice.
 *
 * Messages are *pushed* here by whatever caused them — a completed quest, a
 * tap, arriving on a page. Deriving them reactively from game state would
 * loop: writing the cooldown for the message being shown immediately changes
 * which message the selector returns.
 */
export const useCompanion = create<CompanionState>((set, get) => ({
  bubble: null,
  pulse: null,

  say: (message) => {
    set({ bubble: message });
    useGame.getState().noteCoachShown(message.id);
  },

  hide: () => set({ bubble: null }),

  clearPulse: () => set({ pulse: null }),

  speakUp: () => {
    const ctx = coachContext();
    if (!ctx) return false;
    const message = selectCoachMessage(ctx);
    if (!message) return false;
    get().say(message);
    return true;
  },

  sayStatus: () => {
    const ctx = coachContext();
    set({
      bubble: {
        id: "status",
        tone: "greet",
        text: ctx ? coachStatusLine(ctx) : "Ready when you are.",
        priority: 0,
        cooldownMinutes: 0,
      },
    });
  },

  reactToCompletion: (input) => {
    const big = input.leveledUp;
    set({
      pulse: {
        id: ++pulseCounter,
        mood: input.leveledUp || input.domainLeveledUp ? "proud" : "happy",
        intensity: big ? "big" : "normal",
        xp: input.xp,
      },
    });

    const ctx = coachContext(input);
    if (!ctx) return;
    const message = selectCoachMessage(ctx);
    if (message) get().say(message);
  },
}));
