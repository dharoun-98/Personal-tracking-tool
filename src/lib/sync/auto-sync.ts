"use client";

import { useGame } from "@/lib/store";
import {
  describeRemote,
  isApplyingRemote,
  localHasData,
  pullSnapshot,
  pushSnapshot,
} from "./sync";

/* ==================================================================== *
 * Automatic sync.
 *
 * The goal is that a player never thinks about this. Sign in on a new phone
 * and your world is there; log a quest and it's on the other device by the
 * time you open it. No buttons, no "backup now".
 *
 * The thing standing between "automatic" and "eats your streak" is knowing
 * which side is authoritative. Two cheap signals answer it without a CRDT:
 *
 *   revision > pushedRevision   this device has edits the server hasn't seen
 *   remote.stamp > serverStamp  some other device has written since we synced
 *
 * Neither → nothing to do. One → that side wins, silently and safely.
 * Both → genuine divergence, and the only honest move is to ask. That last
 * case is rare (it needs edits on two devices between syncs) which is exactly
 * why it's acceptable to interrupt for it.
 * ==================================================================== */

export type ReconcileResult =
  | { kind: "idle" }
  | { kind: "pushed" }
  | { kind: "pulled" }
  | { kind: "conflict" }
  | { kind: "unavailable" }
  | { kind: "failed"; message: string };

const PUSH_DEBOUNCE_MS = 2500;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight: Promise<unknown> | null = null;
/** Everything the current watcher needs to undo. */
let teardown: Array<() => void> = [];

/** True when this device holds edits the server hasn't received. */
export function hasUnpushedChanges(): boolean {
  const { revision, sync } = useGame.getState();
  return revision !== (sync.pushedRevision ?? -1);
}

/**
 * Works out what should happen and does it.
 *
 * Called on sign-in, on app open, and when a tab regains focus.
 */
export async function reconcile(): Promise<ReconcileResult> {
  const remote = await describeRemote();
  // Not signed in, or cloud isn't configured. Local-only is a valid way to
  // use this app, not an error.
  if (!remote) return { kind: "unavailable" };

  const local = localHasData();
  const dirty = hasUnpushedChanges();
  const { sync } = useGame.getState();

  const serverMoved =
    !!remote.stamp && (!sync.serverStamp || remote.stamp > sync.serverStamp);

  // Fresh device, or a cloud account with nothing in it yet.
  if (!remote.hasData) {
    if (!local) return { kind: "idle" };
    const result = await pushSnapshot();
    return result.ok ? { kind: "pushed" } : { kind: "failed", message: result.message };
  }

  if (!local) {
    const result = await pullSnapshot();
    return result.ok ? { kind: "pulled" } : { kind: "failed", message: result.message };
  }

  // Both sides hold something.
  if (dirty && serverMoved) return { kind: "conflict" };

  if (dirty) {
    const result = await pushSnapshot();
    return result.ok ? { kind: "pushed" } : { kind: "failed", message: result.message };
  }

  if (serverMoved) {
    const result = await pullSnapshot();
    return result.ok ? { kind: "pulled" } : { kind: "failed", message: result.message };
  }

  return { kind: "idle" };
}

/** Pushes now, coalescing with anything already in flight. */
export async function flushPush(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (!hasUnpushedChanges()) return;
  if (pushInFlight) {
    await pushInFlight;
    if (!hasUnpushedChanges()) return;
  }
  pushInFlight = pushSnapshot().finally(() => {
    pushInFlight = null;
  });
  await pushInFlight;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  // Debounced so tapping through five quests is one request, not five.
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flushPush();
  }, PUSH_DEBOUNCE_MS);
}

/**
 * Watches game data and keeps the cloud in step.
 *
 * Returns a teardown function. Safe to call more than once — the previous
 * watcher is replaced rather than stacked.
 */
export function startAutoSync(): () => void {
  stopAutoSync();

  const unsubscribe = useGame.subscribe((state, previous) => {
    // A pull is writing the server's own data in; that isn't a local edit.
    if (isApplyingRemote()) return;

    const changed =
      state.quests !== previous.quests ||
      state.logs !== previous.logs ||
      state.goals !== previous.goals ||
      state.reflections !== previous.reflections ||
      state.unlocked !== previous.unlocked ||
      state.profile !== previous.profile ||
      state.onboardingComplete !== previous.onboardingComplete;

    if (!changed) return;

    state.bumpRevision();
    schedulePush();
  });

  const onHidden = () => {
    // Closing the tab or backgrounding the app is the last chance to save.
    if (document.visibilityState === "hidden") void flushPush();
  };
  const onOnline = () => void flushPush();

  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("online", onOnline);
  window.addEventListener("pagehide", onOnline);

  teardown = [
    unsubscribe,
    () => document.removeEventListener("visibilitychange", onHidden),
    () => window.removeEventListener("online", onOnline),
    () => window.removeEventListener("pagehide", onOnline),
  ];

  return stopAutoSync;
}

export function stopAutoSync(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  for (const undo of teardown) undo();
  teardown = [];
}
