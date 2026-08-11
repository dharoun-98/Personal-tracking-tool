"use client";

import { useEffect } from "react";
import { create } from "zustand";
import {
  reconcile,
  startAutoSync,
  type ReconcileResult,
} from "@/lib/sync/auto-sync";
import { useHydrated } from "@/lib/store";

/* ==================================================================== *
 * Drives automatic sync for the whole app.
 *
 * Renders nothing. Mounted once, high in the tree, so that a player is never
 * asked to press a button to keep their own data.
 * ==================================================================== */

export type SyncPhase = "idle" | "restoring" | "conflict" | "ready" | "offline";

interface SyncStatusState {
  phase: SyncPhase;
  error: string | null;
  set: (phase: SyncPhase, error?: string | null) => void;
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  phase: "idle",
  error: null,
  set: (phase, error = null) => set({ phase, error }),
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
      status.set("ready", result.message);
      break;
    default:
      status.set("ready");
  }
}

export function SyncManager({ signedIn }: { signedIn: boolean }) {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated || !signedIn) return;

    let cancelled = false;

    // Announce the restore before doing it: on a fresh device this is the
    // difference between a considered pause and an app that looks broken.
    useSyncStatus.getState().set("restoring");

    void reconcile().then((result) => {
      if (!cancelled) applyResult(result);
    });

    const stop = startAutoSync();

    // Another device may have written while this tab sat in the background.
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      void reconcile().then((result) => {
        if (!cancelled) applyResult(result);
      });
    };
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
      stop();
    };
  }, [hydrated, signedIn]);

  return null;
}
