"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CloudOff,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { pullSnapshot, pushSnapshot } from "@/lib/sync/sync";
import { hasUnpushedChanges, reconcile } from "@/lib/sync/auto-sync";
import { useSyncStatus } from "@/components/shell/sync-manager";
import { useGame, useHydrated } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";

/**
 * Sync status, and the manual controls for the one case that needs them.
 *
 * Sync is automatic now, so this is mostly a reassurance surface — "your world
 * is safe, here's when it last saved". The only moment it demands attention is
 * a genuine divergence, where two devices both changed things between syncs.
 * Then it shows what's on each side and asks, because silently discarding
 * somebody's streak is not a thing software should do.
 */
export function SyncPanel({ signedIn }: { signedIn: boolean }) {
  const hydrated = useHydrated();
  const sync = useGame((s) => s.sync);
  const phase = useSyncStatus((s) => s.phase);
  const statusError = useSyncStatus((s) => s.error);
  const setPhase = useSyncStatus((s) => s.set);

  const [busy, setBusy] = useState<"push" | "pull" | "check" | null>(null);

  if (!hydrated) return null;

  if (!signedIn) {
    return (
      <Panel className="p-4">
        <p className="text-sm font-semibold">Back up your world</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-mute">
          Right now everything lives on this device and nowhere else. Lose the
          phone, lose the streak. Sign in and it syncs itself from then on —
          every device, automatically.
        </p>
        <div className="mt-3.5 flex gap-2.5">
          <Link href="/auth/sign-up" className={buttonClasses({ size: "sm" })}>
            Create an account
          </Link>
          <Link
            href="/auth/sign-in"
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Sign in
          </Link>
        </div>
      </Panel>
    );
  }

  const resolve = async (choice: "push" | "pull") => {
    setBusy(choice);
    const result = choice === "push" ? await pushSnapshot() : await pullSnapshot();
    setBusy(null);
    setPhase("ready", result.ok ? null : result.message);
  };

  /* --- Genuine divergence: ask, never guess ------------------------- */
  if (phase === "conflict") {
    const state = useGame.getState();
    return (
      <Panel className="border-warn/40 bg-warn/8 p-4">
        <div className="flex gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warn">
              This device and the cloud both changed
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">
              You edited things here while another device edited things there,
              and we can&apos;t safely merge the two. Pick which to keep — the
              other is replaced.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-2xl border border-edge bg-surface p-3.5">
            <p className="text-xs font-semibold">This device</p>
            <p className="mt-1.5 text-2xs text-ink-mute">
              {state.quests.filter((q) => !q.archivedAt).length} quests ·{" "}
              {state.logs.length} check-ins
            </p>
            <Button
              size="sm"
              fullWidth
              className="mt-3"
              loading={busy === "push"}
              onClick={() => resolve("push")}
            >
              Keep this device
            </Button>
          </div>
          <div className="rounded-2xl border border-edge bg-surface p-3.5">
            <p className="text-xs font-semibold">The cloud</p>
            <p className="mt-1.5 text-2xs text-ink-mute">
              Last saved{" "}
              {sync.serverStamp
                ? new Date(sync.serverStamp).toLocaleString()
                : "recently"}
            </p>
            <Button
              size="sm"
              variant="secondary"
              fullWidth
              className="mt-3"
              loading={busy === "pull"}
              onClick={() => resolve("pull")}
            >
              Use the cloud copy
            </Button>
          </div>
        </div>
      </Panel>
    );
  }

  /* --- Everything else ---------------------------------------------- */
  const syncing = phase === "restoring" || busy !== null;
  const pending = hasUnpushedChanges();

  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            phase === "offline"
              ? "bg-surface-2 text-ink-faint"
              : "bg-success/15 text-success",
          )}
        >
          {syncing ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : phase === "offline" ? (
            <CloudOff className="size-4.5" />
          ) : (
            <Check className="size-4.5" strokeWidth={2.5} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {phase === "offline"
              ? "Not syncing"
              : syncing
                ? "Syncing…"
                : pending
                  ? "Saving shortly"
                  : "Everything is saved"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            {phase === "offline"
              ? "Cloud sync isn't available right now. Your game carries on locally and will catch up when it can."
              : sync.lastPushedAt
                ? `Last saved ${new Date(sync.lastPushedAt).toLocaleString()}. Changes sync on their own — every device you sign in to stays in step.`
                : "Your world syncs automatically from now on. Sign in anywhere and it follows you."}
          </p>

          {statusError && (
            <p className="mt-2.5 text-2xs text-danger">{statusError}</p>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="mt-3 -ml-2"
            loading={busy === "check"}
            onClick={async () => {
              setBusy("check");
              const result = await reconcile();
              setBusy(null);
              setPhase(
                result.kind === "conflict"
                  ? "conflict"
                  : result.kind === "unavailable"
                    ? "offline"
                    : "ready",
                result.kind === "failed" ? result.message : null,
              );
            }}
          >
            <RefreshCw className="size-3.5" />
            Sync now
          </Button>
        </div>
      </div>
    </Panel>
  );
}
