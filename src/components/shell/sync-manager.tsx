"use client";

import { useEffect } from "react";
import { create } from "zustand";
import {
  reconcile,
  setAutoPushEnabled,
  startAutoSync,
  type ReconcileResult,
} from "@/lib/sync/auto-sync";
import { useGame, useHydrated } from "@/lib/store";
import { localHasData } from "@/lib/sync/sync";

/* ==================================================================== *
 * Drives automatic sync for the whole app.
 *
 * Renders nothing. Mounted once, high in the tree, so that a player is never
 * asked to press a button to keep their own data.
 * ==================================================================== */

export type SyncPhase =
  | "idle"
  | "restoring"
  | "conflict"
  | "ready"
  | "offline"
  | "error"
  | "account-change";

interface SyncStatusState {
  phase: SyncPhase;
  error: string | null;
  set: (phase: SyncPhase, error?: string | null) => void;
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  phase: "idle",
  error: null,
  set: (phase, error = null) => {
    // `ready` is only published after a positive reconciliation or an
    // explicit conflict/account replacement succeeds. Every other phase keeps
    // background writes closed.
    setAutoPushEnabled(phase === "ready");
    set({ phase, error });
  },
}));

function applyResult(result: ReconcileResult) {
  const status = useSyncStatus.getState();
  switch (result.kind) {
    case "conflict":
      status.set("conflict");
      break;
    case "unavailable":
      status.set("offline");
      break;
    case "failed":
      status.set("error", result.message);
      break;
    default:
      status.set("ready");
  }
}

/** Reconcile immediately and publish an honest global status for the UI. */
async function reconcileSafely(): Promise<ReconcileResult> {
  try {
    return await reconcile();
  } catch (error) {
    return {
      kind: "failed",
      message: error instanceof Error ? error.message : "Sync failed.",
    };
  }
}

export async function syncNow({ restoring = false } = {}): Promise<ReconcileResult> {
  if (restoring) useSyncStatus.getState().set("restoring");
  const result = await reconcileSafely();
  applyResult(result);
  return result;
}

export function SyncManager({
  signedIn,
  userId,
}: {
  signedIn: boolean;
  userId: string | null;
}) {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!signedIn || !userId) {
      setAutoPushEnabled(false);
      useSyncStatus.getState().set("idle");
      return;
    }

    const owner = useGame.getState().sync.ownerUserId;
    if (owner && owner !== userId && localHasData()) {
      useSyncStatus
        .getState()
        .set(
          "account-change",
          "This device still contains a different account's world. Sync is paused so the two cannot be mixed.",
        );
      setAutoPushEnabled(false);
      return;
    }
    if (!owner && localHasData()) {
      // The first account connected to an existing local world becomes its
      // owner immediately, even if the first network attempt later fails.
      useGame.getState().setSync({ ownerUserId: userId });
    }

    let cancelled = false;

    // Announce the restore before doing it: on a fresh device this is the
    // difference between a considered pause and an app that looks broken.
    useSyncStatus.getState().set("restoring");

    const stop = startAutoSync((result) => {
      if (!cancelled) applyResult(result);
    });

    const runReconcile = async () => {
      const result = await reconcileSafely();
      if (cancelled) return;
      applyResult(result);
      return result;
    };

    void runReconcile();

    // Another device may have written while this tab sat in the background.
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      void runReconcile();
    };
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
      stop();
    };
  }, [hydrated, signedIn, userId]);

  return null;
}
