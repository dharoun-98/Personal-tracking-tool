"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { todayKey } from "./date";
import { uid } from "./cn";
import type {
  DayKey,
  DayReflection,
  Goal,
  LogEntry,
  LogStatus,
  PlayerProfile,
  Quest,
  UnlockedAchievement,
} from "./types";

/* ==================================================================== *
 * Local-first game state.
 *
 * Stage 1 persists everything to localStorage so the game is instantly
 * playable, works offline, and survives a refresh. The action surface is
 * deliberately narrow and serialisable so Stage 3 can back it with Supabase
 * without any component needing to change.
 * ==================================================================== */

/** Bump when the persisted shape changes; `migrate` handles the upgrade. */
const STORE_VERSION = 1;
const STORAGE_KEY = "ptt.game.v1";

export type TrialStatus = "trialing" | "active" | "past_due" | "expired" | "comped";

export interface AccountState {
  /** ISO. Set the first time onboarding completes. */
  trialStartedAt?: string;
  trialDays: number;
  status: TrialStatus;
  /** Placeholder until Stage 3 wires Stripe. */
  plan?: "monthly" | "yearly";
  /** Admins and team accounts bypass the paywall entirely. */
  bypassBilling?: boolean;
  email?: string;
}

export interface GameState {
  /* --- persisted ------------------------------------------------- */
  profile: PlayerProfile | null;
  quests: Quest[];
  logs: LogEntry[];
  goals: Goal[];
  reflections: DayReflection[];
  unlocked: UnlockedAchievement[];
  coachCooldowns: Record<string, string>;
  account: AccountState;
  onboardingComplete: boolean;
  lastSeenAt?: string;
  /** Set once the two documents have been generated at least once. */
  reportsGeneratedAt?: string;

  /* --- transient -------------------------------------------------- */
  hydrated: boolean;
  /** Session-scoped: the previous session's timestamp, for the coach. */
  previousSeenAt?: string;

  /* --- actions ----------------------------------------------------- */
  completeOnboarding: (input: {
    profile: PlayerProfile;
    quests: Quest[];
    goals: Goal[];
  }) => void;
  logQuest: (questId: string, status: LogStatus, value?: number, day?: DayKey) => LogEntry;
  clearLog: (questId: string, day?: DayKey) => void;
  addQuest: (quest: Omit<Quest, "id" | "createdAt">) => Quest;
  updateQuest: (id: string, patch: Partial<Quest>) => void;
  archiveQuest: (id: string) => void;
  restoreQuest: (id: string) => void;
  addGoal: (goal: Omit<Goal, "id" | "createdAt">) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  setReflection: (reflection: Omit<DayReflection, "at">) => void;
  unlock: (ids: string[]) => void;
  noteCoachShown: (id: string) => void;
  touchSession: () => void;
  setHydrated: () => void;
  setAccount: (patch: Partial<AccountState>) => void;
  markReportsGenerated: () => void;
  resetEverything: () => void;
}

const initialAccount: AccountState = {
  trialDays: 16,
  status: "trialing",
};

const empty = {
  profile: null,
  quests: [] as Quest[],
  logs: [] as LogEntry[],
  goals: [] as Goal[],
  reflections: [] as DayReflection[],
  unlocked: [] as UnlockedAchievement[],
  coachCooldowns: {} as Record<string, string>,
  account: initialAccount,
  onboardingComplete: false,
  lastSeenAt: undefined as string | undefined,
  reportsGeneratedAt: undefined as string | undefined,
};

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...empty,
      hydrated: false,
      previousSeenAt: undefined,

      completeOnboarding: ({ profile, quests, goals }) =>
        set((s) => ({
          profile,
          quests,
          goals,
          onboardingComplete: true,
          account: {
            ...s.account,
            trialStartedAt: s.account.trialStartedAt ?? new Date().toISOString(),
            status: s.account.status === "trialing" ? "trialing" : s.account.status,
          },
        })),

      logQuest: (questId, status, value, day) => {
        const date = day ?? todayKey();
        const entry: LogEntry = {
          id: uid("log"),
          questId,
          date,
          status,
          value,
          at: new Date().toISOString(),
        };
        set((s) => ({
          // One entry per quest per day — re-logging replaces.
          logs: [...s.logs.filter((l) => !(l.questId === questId && l.date === date)), entry],
        }));
        return entry;
      },

      clearLog: (questId, day) => {
        const date = day ?? todayKey();
        set((s) => ({
          logs: s.logs.filter((l) => !(l.questId === questId && l.date === date)),
        }));
      },

      addQuest: (quest) => {
        const created: Quest = {
          ...quest,
          id: uid("q"),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ quests: [...s.quests, created] }));
        return created;
      },

      updateQuest: (id, patch) =>
        set((s) => ({
          quests: s.quests.map((q) => (q.id === id ? { ...q, ...patch } : q)),
        })),

      archiveQuest: (id) =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.id === id ? { ...q, archivedAt: new Date().toISOString() } : q,
          ),
        })),

      restoreQuest: (id) =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.id === id ? { ...q, archivedAt: undefined } : q,
          ),
        })),

      addGoal: (goal) => {
        const created: Goal = {
          ...goal,
          id: uid("g"),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ goals: [...s.goals, created] }));
        return created;
      },

      updateGoal: (id, patch) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),

      setReflection: (reflection) =>
        set((s) => ({
          reflections: [
            ...s.reflections.filter((r) => r.date !== reflection.date),
            { ...reflection, at: new Date().toISOString() },
          ],
        })),

      unlock: (ids) => {
        if (ids.length === 0) return;
        set((s) => {
          const known = new Set(s.unlocked.map((u) => u.id));
          const fresh = ids
            .filter((id) => !known.has(id))
            .map((id) => ({ id, unlockedAt: new Date().toISOString() }));
          return fresh.length ? { unlocked: [...s.unlocked, ...fresh] } : {};
        });
      },

      noteCoachShown: (id) =>
        set((s) => ({
          coachCooldowns: { ...s.coachCooldowns, [id]: new Date().toISOString() },
        })),

      touchSession: () => {
        const prev = get().lastSeenAt;
        set({ previousSeenAt: prev, lastSeenAt: new Date().toISOString() });
      },

      setHydrated: () => set({ hydrated: true }),

      setAccount: (patch) => set((s) => ({ account: { ...s.account, ...patch } })),

      markReportsGenerated: () =>
        set({ reportsGeneratedAt: new Date().toISOString() }),

      resetEverything: () => set({ ...empty, hydrated: true, previousSeenAt: undefined }),
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      /**
       * Persisted keys are listed explicitly rather than subtracted from the
       * whole state. Anything transient added later stays out of storage by
       * default, instead of silently starting to persist.
       */
      partialize: (state) => ({
        profile: state.profile,
        quests: state.quests,
        logs: state.logs,
        goals: state.goals,
        reflections: state.reflections,
        unlocked: state.unlocked,
        coachCooldowns: state.coachCooldowns,
        account: state.account,
        onboardingComplete: state.onboardingComplete,
        lastSeenAt: state.lastSeenAt,
        reportsGeneratedAt: state.reportsGeneratedAt,
      }),
      /**
       * Reading localStorage is synchronous, so without this zustand would
       * rehydrate during store creation — before React mounts. The client's
       * first render would then disagree with the server's HTML and React
       * would throw a hydration mismatch. Instead we rehydrate explicitly
       * from an effect, once the tree is mounted.
       */
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        // `state` carries the store's own bound actions, so this is safe even
        // though `useGame` itself isn't assigned yet.
        state?.touchSession();
        state?.setHydrated();
      },
    },
  ),
);

/**
 * Kicks off rehydration on the client. Mounted once, from the root layout.
 *
 * Also flips the flag when there's nothing stored at all, so a first-time
 * visitor doesn't sit on the loading splash forever.
 */
export function useRehydrateOnce(): void {
  useEffect(() => {
    void useGame.persist.rehydrate();
    if (!useGame.getState().hydrated) useGame.getState().setHydrated();
  }, []);
}

/**
 * True once localStorage has been read.
 *
 * Components must gate on this before rendering player data, otherwise the
 * server-rendered HTML (empty state) and the first client render (real state)
 * disagree and React throws a hydration error.
 */
export function useHydrated(): boolean {
  return useGame((s) => s.hydrated);
}
