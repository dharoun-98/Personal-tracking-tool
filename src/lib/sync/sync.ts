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
  /** Account identity used for this inspection; guards against mid-sync switches. */
  userId: string;
  hasData: boolean;
  quests: number;
  logs: number;
  displayName: string | null;
  lastActivity: string | null;
  /** `profiles.updated_at`, bumped by a trigger on every push. */
  stamp: string | null;
  /** True when the cloud copy has finished onboarding. */
  onboarded: boolean;
}

export type SyncOutcome =
  | { ok: true }
  | { ok: false; reason: "no-cloud" | "signed-out" | "failed"; message: string };

const FAILED = (message: string): SyncOutcome => ({
  ok: false,
  reason: "failed",
  message,
});

/**
 * True while a pull is writing the server's state into the store.
 *
 * The auto-sync watcher checks this so that applying a pull doesn't look like
 * a local edit and immediately schedule a push back — a loop that would ping
 * data between devices forever.
 */
let applyingRemote = false;
export const isApplyingRemote = () => applyingRemote;

const SYNC_BATCH_SIZE = 500;
let snapshotWriteInFlight: Promise<SyncOutcome> | null = null;

async function upsertInBatches(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
  table: string,
  rows: object[],
  options?: { onConflict?: string },
): Promise<void> {
  for (let start = 0; start < rows.length; start += SYNC_BATCH_SIZE) {
    const { error } = await supabase
      .from(table)
      .upsert(
        rows.slice(start, start + SYNC_BATCH_SIZE) as Array<Record<string, unknown>>,
        options,
      );
    if (error) throw error;
  }
}

async function selectAllPages<T>(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
  table: string,
  columns: string,
  userId: string,
  orderColumn: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += SYNC_BATCH_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("user_id", userId)
      .order(orderColumn, { ascending: true })
      .range(start, start + SYNC_BATCH_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < SYNC_BATCH_SIZE) return rows;
  }
}

async function requireSession() {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { supabase: null, userId: null, sessionError: null } as const;
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return { supabase, userId: user?.id ?? null, sessionError: null } as const;
  } catch (error) {
    return { supabase, userId: null, sessionError: error } as const;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

/* -------------------------------------------------------------------- *
 * Inspect
 * -------------------------------------------------------------------- */

export async function describeRemote(): Promise<RemoteSummary | null> {
  const { supabase, userId, sessionError } = await requireSession();
  if (sessionError) throw sessionError;
  if (!supabase || !userId) return null;

  const [quests, logs, goals, reflections, unlocked, profile, latest] = await Promise.all([
    supabase.from("quests").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("logs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("goals").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("reflections")
      .select("day", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("unlocked_achievements")
      .select("achievement_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("profiles")
      .select("display_name, onboarding_complete, updated_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("logs").select("day").eq("user_id", userId).order("day", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const firstError =
    quests.error ??
    logs.error ??
    goals.error ??
    reflections.error ??
    unlocked.error ??
    profile.error ??
    latest.error;
  if (firstError) throw firstError;

  const questCount = quests.count ?? 0;
  const logCount = logs.count ?? 0;
  const onboarded = !!profile.data?.onboarding_complete;

  return {
    userId,
    hasData:
      questCount > 0 ||
      logCount > 0 ||
      (goals.count ?? 0) > 0 ||
      (reflections.count ?? 0) > 0 ||
      (unlocked.count ?? 0) > 0 ||
      onboarded,
    quests: questCount,
    logs: logCount,
    displayName: profile.data?.display_name ?? null,
    lastActivity: latest.data?.day ?? null,
    stamp: profile.data?.updated_at ?? null,
    onboarded,
  };
}

/* -------------------------------------------------------------------- *
 * Push — this device becomes the truth
 * -------------------------------------------------------------------- */

async function pushSnapshotOnce(expectedUserId?: string): Promise<SyncOutcome> {
  const { supabase, userId, sessionError } = await requireSession();
  if (sessionError) {
    const message = errorMessage(sessionError, "Could not verify your account.");
    useGame.getState().setSync({ error: message });
    return FAILED(message);
  }
  if (!supabase) return { ok: false, reason: "no-cloud", message: "Cloud backup isn't configured." };
  if (!userId) return { ok: false, reason: "signed-out", message: "You're not signed in." };
  if (expectedUserId && userId !== expectedUserId) {
    return FAILED("The signed-in account changed while sync was running. Nothing was saved.");
  }

  const state = useGame.getState();
  if (state.sync.ownerUserId && state.sync.ownerUserId !== userId && localHasData()) {
    return FAILED("This device belongs to a different account. Sync is paused.");
  }
  // Captured before any awaits: anything the player changes mid-push belongs
  // to the *next* push, and must not be marked as already sent.
  const revisionAtStart = state.revision;
  let stamp: string | null = null;

  try {
    if (state.profile) {
      const { data, error } = await supabase
        .from("profiles")
        .upsert(profileToRow(state.profile, userId, state.onboardingComplete))
        .select("updated_at")
        .maybeSingle();
      if (error) throw error;
      stamp = (data as { updated_at?: string } | null)?.updated_at ?? null;
    }

    const quests = state.quests.map((q) => questToRow(q, userId));
    const logs = state.logs.map((l) => logToRow(l, userId));
    const goals = state.goals.map((g) => goalToRow(g, userId));
    const reflections = state.reflections.map((r) => reflectionToRow(r, userId));
    const unlocked = state.unlocked.map((u) => achievementToRow(u, userId));

    // Upsert in dependency order so a partial failure never leaves logs
    // pointing at quests that don't exist yet.
    await upsertInBatches(supabase, "quests", quests);
    await upsertInBatches(supabase, "logs", logs, {
      onConflict: "user_id,quest_id,day",
    });
    await upsertInBatches(supabase, "goals", goals);
    await upsertInBatches(supabase, "reflections", reflections);
    await upsertInBatches(supabase, "unlocked_achievements", unlocked);

    // Mirror deletions. Anything removed locally must not reappear on restore.
    await pruneRemote(supabase, userId, "quests", "id", quests.map((q) => q.id));
    await pruneRemote(supabase, userId, "logs", "id", logs.map((l) => l.id));
    await pruneRemote(supabase, userId, "goals", "id", goals.map((g) => g.id));
    await pruneRemote(
      supabase,
      userId,
      "reflections",
      "day",
      reflections.map((r) => r.day),
    );
    await pruneRemote(
      supabase,
      userId,
      "unlocked_achievements",
      "achievement_id",
      unlocked.map((u) => u.achievement_id),
    );

    useGame.getState().setSync({
      ownerUserId: userId,
      lastPushedAt: new Date().toISOString(),
      pushedRevision: revisionAtStart,
      serverStamp: stamp ?? undefined,
      error: null,
    });
    return { ok: true };
  } catch (error) {
    const message = errorMessage(error, "Backup failed.");
    useGame.getState().setSync({ error: message });
    return FAILED(message);
  }
}

/** Serialize whole-snapshot writes; interleaved prune phases can lose rows. */
export function pushSnapshot(expectedUserId?: string): Promise<SyncOutcome> {
  if (snapshotWriteInFlight) return snapshotWriteInFlight;
  const task = pushSnapshotOnce(expectedUserId).finally(() => {
    if (snapshotWriteInFlight === task) snapshotWriteInFlight = null;
  });
  snapshotWriteInFlight = task;
  return task;
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
  table:
    | "quests"
    | "logs"
    | "goals"
    | "reflections"
    | "unlocked_achievements",
  keyColumn: "id" | "day" | "achievement_id",
  keep: string[],
): Promise<void> {
  const data = await selectAllPages<Record<string, unknown>>(
    supabase,
    table,
    keyColumn,
    userId,
    keyColumn,
  );

  const keepSet = new Set(keep);
  const stale = data
    .map((row) => String((row as Record<string, unknown>)[keyColumn]))
    .filter((id) => !keepSet.has(id));
  if (stale.length === 0) return;

  const BATCH = 200;
  for (let i = 0; i < stale.length; i += BATCH) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in(keyColumn, stale.slice(i, i + BATCH));
    if (deleteError) throw deleteError;
  }
}

/* -------------------------------------------------------------------- *
 * Pull — the cloud becomes the truth on this device
 * -------------------------------------------------------------------- */

export async function pullSnapshot(expectedUserId?: string): Promise<SyncOutcome> {
  const { supabase, userId, sessionError } = await requireSession();
  if (sessionError) {
    const message = errorMessage(sessionError, "Could not verify your account.");
    useGame.getState().setSync({ error: message });
    return FAILED(message);
  }
  if (!supabase) return { ok: false, reason: "no-cloud", message: "Cloud backup isn't configured." };
  if (!userId) return { ok: false, reason: "signed-out", message: "You're not signed in." };
  if (expectedUserId && userId !== expectedUserId) {
    return FAILED("The signed-in account changed while sync was running. Nothing was restored.");
  }
  const previousOwner = useGame.getState().sync.ownerUserId;

  try {
    const [profile, questRows, logRows, goalRows, reflectionRows, unlockedRows] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      selectAllPages<QuestRow>(supabase, "quests", "*", userId, "id"),
      selectAllPages<LogRow>(supabase, "logs", "*", userId, "id"),
      selectAllPages<GoalRow>(supabase, "goals", "*", userId, "id"),
      selectAllPages<ReflectionRow>(supabase, "reflections", "*", userId, "day"),
      selectAllPages<UnlockedAchievementRow>(
        supabase,
        "unlocked_achievements",
        "*",
        userId,
        "achievement_id",
      ),
    ]);

    if (profile.error) throw profile.error;

    // The client is untyped, so name the row shapes here — this is the seam
    // where database columns become application types.
    const profileRow = profile.data as ProfileRow | null;

    applyingRemote = true;
    try {
      useGame.getState().replaceAll({
        profile: profileRow ? rowToProfile(profileRow) : null,
        onboardingComplete: profileRow?.onboarding_complete ?? false,
        quests: questRows.map(rowToQuest),
        logs: logRows.map(rowToLog),
        goals: goalRows.map(rowToGoal),
        reflections: reflectionRows.map(rowToReflection),
        unlocked: unlockedRows.map(rowToAchievement),
        // Never carry an old person's email or device-world timestamps into
        // an explicitly selected account. Same-account restores retain them.
        clearDeviceMetadata: !!previousOwner && previousOwner !== userId,
      });

      // We now hold exactly what the server holds, so this device has nothing
      // outstanding — whatever the revision ended up as, that's the synced point.
      useGame.getState().replaceSync({
        ownerUserId: userId,
        lastPulledAt: new Date().toISOString(),
        pushedRevision: useGame.getState().revision,
        serverStamp: profileRow?.updated_at ?? undefined,
        error: null,
      });
    } finally {
      applyingRemote = false;
    }

    return { ok: true };
  } catch (error) {
    const message = errorMessage(error, "Restore failed.");
    useGame.getState().setSync({ error: message });
    return FAILED(message);
  }
}

/**
 * Explicitly remove this account's cloud game before a signed-in local reset.
 *
 * Callers must only clear local state after this succeeds. Keeping this as a
 * separate, named operation prevents an ordinary empty local snapshot from
 * masquerading as a complete account reset.
 */
export async function clearCloudSnapshot(): Promise<SyncOutcome> {
  const { supabase, userId, sessionError } = await requireSession();
  if (sessionError) {
    const message = errorMessage(sessionError, "Could not verify your account.");
    useGame.getState().setSync({ error: message });
    return FAILED(message);
  }
  if (!supabase) {
    return { ok: false, reason: "no-cloud", message: "Cloud backup isn't configured." };
  }
  if (!userId) {
    return { ok: false, reason: "signed-out", message: "You're not signed in." };
  }

  try {
    // The RPC is one PostgreSQL transaction. If any table operation fails,
    // PostgreSQL rolls the complete reset back before returning the error.
    const { error } = await supabase.rpc("reset_my_game_snapshot");
    if (error) throw error;

    useGame.getState().replaceSync({ ownerUserId: userId });
    return { ok: true };
  } catch (error) {
    const message = errorMessage(error, "Cloud reset failed.");
    useGame.getState().setSync({ error: message });
    return FAILED(message);
  }
}

/** True when this device is holding a game worth protecting. */
export function localHasData(): boolean {
  const state = useGame.getState();
  return state.onboardingComplete || state.quests.length > 0 || state.logs.length > 0;
}
