"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useGame } from "@/lib/store";
import type {
  GoalRow,
  LogRow,
  ProfileRow,
  QuestRow,
  ReflectionRow,
  UnlockedAchievementRow,
} from "@/lib/supabase/types";
import {
  achievementToRow,
  goalToRow,
  logToRow,
  profileToRow,
  questToRow,
  reflectionToRow,
  rowToAchievement,
  rowToGoal,
  rowToLog,
  rowToProfile,
  rowToQuest,
  rowToReflection,
} from "./mapping";

/* ==================================================================== *
 * Cloud backup and restore.
 *
 * This is deliberately NOT a live multi-device sync engine. It is a backup
 * you can restore onto a new device, and the difference matters:
 *
 *   - A real merge needs tombstones for every deletion, a vector clock or
 *     per-field timestamps, and a conflict policy per entity. Getting any of
 *     that subtly wrong loses somebody's streak, silently, months later.
 *   - Almost nobody tracks their life on two phones at once.
 *
 * So: the device pushes its whole state, and the server mirrors it. When both
 * sides hold data and we can't tell which is wanted, we *ask* rather than
 * guess. Nothing here overwrites a player's history without them choosing it.
 * ==================================================================== */

export interface RemoteSummary {
  hasData: boolean;
  quests: number;
  logs: number;
  displayName: string | null;
  lastActivity: string | null;
}

export type SyncOutcome =
  | { ok: true }
  | { ok: false; reason: "no-cloud" | "signed-out" | "failed"; message: string };

const FAILED = (message: string): SyncOutcome => ({
  ok: false,
  reason: "failed",
  message,
});

async function requireSession() {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { supabase: null, userId: null } as const;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null } as const;
}

/* -------------------------------------------------------------------- *
 * Inspect
 * -------------------------------------------------------------------- */

export async function describeRemote(): Promise<RemoteSummary | null> {
  const { supabase, userId } = await requireSession();
  if (!supabase || !userId) return null;

  const [quests, logs, profile, latest] = await Promise.all([
    supabase.from("quests").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("logs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("profiles").select("display_name, onboarding_complete").eq("id", userId).maybeSingle(),
    supabase.from("logs").select("day").eq("user_id", userId).order("day", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const questCount = quests.count ?? 0;
  const logCount = logs.count ?? 0;

  return {
    hasData: questCount > 0 || logCount > 0 || !!profile.data?.onboarding_complete,
    quests: questCount,
    logs: logCount,
    displayName: profile.data?.display_name ?? null,
    lastActivity: latest.data?.day ?? null,
  };
}

/* -------------------------------------------------------------------- *
 * Push — this device becomes the truth
 * -------------------------------------------------------------------- */

export async function pushSnapshot(): Promise<SyncOutcome> {
  const { supabase, userId } = await requireSession();
  if (!supabase) return { ok: false, reason: "no-cloud", message: "Cloud backup isn't configured." };
  if (!userId) return { ok: false, reason: "signed-out", message: "You're not signed in." };

  const state = useGame.getState();

  try {
    if (state.profile) {
      const { error } = await supabase
        .from("profiles")
        .upsert(profileToRow(state.profile, userId, state.onboardingComplete));
      if (error) throw error;
    }

    const quests = state.quests.map((q) => questToRow(q, userId));
    const logs = state.logs.map((l) => logToRow(l, userId));
    const goals = state.goals.map((g) => goalToRow(g, userId));
    const reflections = state.reflections.map((r) => reflectionToRow(r, userId));
    const unlocked = state.unlocked.map((u) => achievementToRow(u, userId));

    // Upsert in dependency order so a partial failure never leaves logs
    // pointing at quests that don't exist yet.
    if (quests.length) {
      const { error } = await supabase.from("quests").upsert(quests);
      if (error) throw error;
    }
    if (logs.length) {
      const { error } = await supabase.from("logs").upsert(logs, {
        onConflict: "user_id,quest_id,day",
      });
      if (error) throw error;
    }
    if (goals.length) {
      const { error } = await supabase.from("goals").upsert(goals);
      if (error) throw error;
    }
    if (reflections.length) {
      const { error } = await supabase.from("reflections").upsert(reflections);
      if (error) throw error;
    }
    if (unlocked.length) {
      const { error } = await supabase.from("unlocked_achievements").upsert(unlocked);
      if (error) throw error;
    }

    // Mirror deletions. A quest removed here should not come back on restore.
    await pruneRemote(supabase, userId, "quests", quests.map((q) => q.id));
    await pruneRemote(supabase, userId, "logs", logs.map((l) => l.id));
    await pruneRemote(supabase, userId, "goals", goals.map((g) => g.id));

    useGame.getState().setSync({ lastPushedAt: new Date().toISOString(), error: null });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed.";
    useGame.getState().setSync({ error: message });
    return FAILED(message);
  }
}

/**
 * Delete rows for this user whose ids aren't in `keep`.
 *
 * PostgREST has no "not in (huge list)" that stays under a URL length limit,
 * so this fetches ids and deletes the difference in batches.
 */
async function pruneRemote(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
  userId: string,
  table: "quests" | "logs" | "goals",
  keep: string[],
): Promise<void> {
  const { data, error } = await supabase.from(table).select("id").eq("user_id", userId);
  if (error || !data) return;

  const keepSet = new Set(keep);
  const stale = data.map((row) => row.id).filter((id) => !keepSet.has(id));
  if (stale.length === 0) return;

  const BATCH = 200;
  for (let i = 0; i < stale.length; i += BATCH) {
    await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("id", stale.slice(i, i + BATCH));
  }
}

/* -------------------------------------------------------------------- *
 * Pull — the cloud becomes the truth on this device
 * -------------------------------------------------------------------- */

export async function pullSnapshot(): Promise<SyncOutcome> {
  const { supabase, userId } = await requireSession();
  if (!supabase) return { ok: false, reason: "no-cloud", message: "Cloud backup isn't configured." };
  if (!userId) return { ok: false, reason: "signed-out", message: "You're not signed in." };

  try {
    const [profile, quests, logs, goals, reflections, unlocked] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("quests").select("*").eq("user_id", userId),
      supabase.from("logs").select("*").eq("user_id", userId),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("reflections").select("*").eq("user_id", userId),
      supabase.from("unlocked_achievements").select("*").eq("user_id", userId),
    ]);

    const firstError =
      profile.error ?? quests.error ?? logs.error ?? goals.error ?? reflections.error ?? unlocked.error;
    if (firstError) throw firstError;

    // The client is untyped, so name the row shapes here — this is the seam
    // where database columns become application types.
    useGame.getState().replaceAll({
      profile: profile.data ? rowToProfile(profile.data as ProfileRow) : null,
      onboardingComplete: (profile.data as ProfileRow | null)?.onboarding_complete ?? false,
      quests: ((quests.data ?? []) as QuestRow[]).map(rowToQuest),
      logs: ((logs.data ?? []) as LogRow[]).map(rowToLog),
      goals: ((goals.data ?? []) as GoalRow[]).map(rowToGoal),
      reflections: ((reflections.data ?? []) as ReflectionRow[]).map(rowToReflection),
      unlocked: ((unlocked.data ?? []) as UnlockedAchievementRow[]).map(rowToAchievement),
    });

    useGame.getState().setSync({ lastPulledAt: new Date().toISOString(), error: null });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed.";
    useGame.getState().setSync({ error: message });
    return FAILED(message);
  }
}

/** True when this device is holding a game worth protecting. */
export function localHasData(): boolean {
  const state = useGame.getState();
  return state.onboardingComplete || state.quests.length > 0 || state.logs.length > 0;
}
