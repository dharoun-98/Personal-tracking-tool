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
let pushInFlight: Promise<ReconcileResult> | null = null;
let reconcileInFlight: Promise<ReconcileResult> | null = null;
let publishAutoResult: ((result: ReconcileResult) => void) | null = null;
/**
 * Automatic writes stay closed until a remote inspection has completed and
 * positively established that there is no unresolved divergence.
 *
 * Explicit conflict choices call `pushSnapshot` / `pullSnapshot` directly;
 * they do not need this gate. The gate only protects background writes.
 */
let autoPushEnabled = false;
/** Everything the current watcher needs to undo. */
let teardown: Array<() => void> = [];

export function setAutoPushEnabled(enabled: boolean): void {
  autoPushEnabled = enabled;
  if (!enabled && pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

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
async function reconcileOnce(): Promise<ReconcileResult> {
  setAutoPushEnabled(false);
  try {
    if (useGame.getState().sync.resetPending) {
      return {
        kind: "failed",
        message:
          "Cloud sync is paused until this signed-in reset is completed safely.",
      };
    }
    const remote = await describeRemote();
    // Not signed in, or cloud isn't configured. Local-only is a valid way to
    // use this app, not an error.
    if (!remote) return { kind: "unavailable" };

    const local = localHasData();
    const dirty = hasUnpushedChanges();
    const { sync } = useGame.getState();

    const serverMoved = remote.hasData &&
      (!remote.stamp || !sync.serverStamp || remote.stamp > sync.serverStamp);

    let result: ReconcileResult;

    // Fresh device, or a cloud account with nothing in it yet.
    if (!remote.hasData) {
      if (!local) result = { kind: "idle" };
      else {
        const pushed = await pushSnapshot(remote.userId);
        result = pushed.ok
          ? { kind: "pushed" }
          : { kind: "failed", message: pushed.message };
      }
    } else if (!local) {
      const pulled = await pullSnapshot(remote.userId);
      result = pulled.ok
        ? { kind: "pulled" }
        : { kind: "failed", message: pulled.message };
    } else if (dirty && serverMoved) {
      // Both sides changed. Only the player's explicit choice may open writes.
      result = { kind: "conflict" };
    } else if (dirty) {
      const pushed = await pushSnapshot(remote.userId);
      result = pushed.ok
        ? { kind: "pushed" }
        : { kind: "failed", message: pushed.message };
    } else if (serverMoved) {
      const pulled = await pullSnapshot(remote.userId);
      result = pulled.ok
        ? { kind: "pulled" }
        : { kind: "failed", message: pulled.message };
    } else {
      result = { kind: "idle" };
    }

    if (result.kind === "idle" || result.kind === "pushed" || result.kind === "pulled") {
      setAutoPushEnabled(true);
    }
    return result;
  } catch (error) {
    setAutoPushEnabled(false);
    return {
      kind: "failed",
      message:
        error instanceof Error
          ? error.message
          : error &&
              typeof error === "object" &&
              "message" in error &&
              typeof error.message === "string"
            ? error.message
            : "Sync failed.",
    };
  }
}

/** Coalesce focus, startup and auto-save inspections into one remote decision. */
export function reconcile(): Promise<ReconcileResult> {
  if (reconcileInFlight) return reconcileInFlight;
  const task = reconcileOnce().finally(() => {
    if (reconcileInFlight === task) reconcileInFlight = null;
  });
  reconcileInFlight = task;
  return task;
}

/** Pushes now, coalescing with anything already in flight. */
export async function flushPush(): Promise<void> {
  if (!autoPushEnabled) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (!hasUnpushedChanges()) return;
  if (pushInFlight) {
    await pushInFlight;
    if (!hasUnpushedChanges()) return;
    if (!autoPushEnabled) return;
  }
  // Re-inspect immediately before every automatic write. Another device may
  // have changed the cloud since this tab last gained focus.
  const task = reconcile();
  const publish = publishAutoResult;
  const pending = task.finally(() => {
    if (pushInFlight === pending) pushInFlight = null;
  });
  pushInFlight = pending;
  const result = await pending;
  publish?.(result);
}

function schedulePush() {
  if (!autoPushEnabled) return;
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
export function startAutoSync(
  onResult?: (result: ReconcileResult) => void,
): () => void {
  stopAutoSync();
  publishAutoResult = onResult ?? null;

  const unsubscribe = useGame.subscribe((state, previous) => {
    // A pull is writing the server's own data in; that isn't a local edit.
    if (isApplyingRemote()) return;
    if (state.sync.resetPending) {
      // A legacy/direct signed-in reset must never become an implicit cloud
      // deletion. The UI can complete it through `clearCloudSnapshot`, then
      // call `resetEverything({ cloudCleared: true })`.
      setAutoPushEnabled(false);
      return;
    }

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
  const onOnline = () => {
    const publish = publishAutoResult;
    void reconcile().then((result) => publish?.(result));
  };
  const onPageHide = () => void flushPush();

  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("online", onOnline);
  window.addEventListener("pagehide", onPageHide);

  teardown = [
    unsubscribe,
    () => document.removeEventListener("visibilitychange", onHidden),
    () => window.removeEventListener("online", onOnline),
    () => window.removeEventListener("pagehide", onPageHide),
  ];

  return stopAutoSync;
}

export function stopAutoSync(): void {
  setAutoPushEnabled(false);
  publishAutoResult = null;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  for (const undo of teardown) undo();
  teardown = [];
}
