"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CloudDownload,
  CloudUpload,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  describeRemote,
  localHasData,
  pullSnapshot,
  pushSnapshot,
  type RemoteSummary,
} from "@/lib/sync/sync";
import { prettyDay } from "@/lib/date";
import { useGame, useHydrated } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";

type Busy = null | "checking" | "pushing" | "pulling";

/**
 * Backup and restore.
 *
 * The one thing this must never do is silently pick a side. When the device
 * and the cloud both hold a game, the player is shown what's in each and asked
 * — losing a 90-day streak to an automatic merge would be unforgivable, and
 * "we chose the newer one" is not a defence when the newer one was a fresh
 * install.
 */
export function SyncPanel({ signedIn }: { signedIn: boolean }) {
  const hydrated = useHydrated();
  const sync = useGame((s) => s.sync);

  const [remote, setRemote] = useState<RemoteSummary | null>(null);
  // Starts as "checking" for signed-in players so the effect below never has
  // to set it synchronously just to show a spinner on first paint.
  const [busy, setBusy] = useState<Busy>(signedIn ? "checking" : null);
  const [message, setMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    describeRemote()
      .then((summary) => {
        if (!cancelled) setRemote(summary);
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!hydrated) return null;

  if (!signedIn) {
    return (
      <Panel className="p-4">
        <p className="text-sm font-semibold">Back up your world</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-mute">
          Right now everything lives on this device and nowhere else. Lose the
          phone, lose the streak. An account fixes that — and it&apos;s how you
          get your documents by email.
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

  const hasLocal = localHasData();
  const conflict = !resolved && hasLocal && !!remote?.hasData;

  const run = async (action: "push" | "pull") => {
    setBusy(action === "push" ? "pushing" : "pulling");
    setMessage(null);
    const result = action === "push" ? await pushSnapshot() : await pullSnapshot();
    setBusy(null);
    setResolved(true);

    if (result.ok) {
      setMessage(
        action === "push" ? "Backed up." : "Restored from your backup.",
      );
      setRemote(await describeRemote());
    } else {
      setMessage(result.message);
    }
  };

  /* --- Both sides hold data: ask, don't guess ----------------------- */
  if (conflict) {
    return (
      <Panel className="border-warn/40 bg-warn/8 p-4">
        <div className="flex gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warn">Two versions exist</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">
              There&apos;s a game on this device and a different one in your
              backup. Pick which to keep — the other is replaced, so choose
              carefully.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <SideCard
            title="This device"
            lines={[
              `${useGame.getState().quests.filter((q) => !q.archivedAt).length} quests`,
              `${useGame.getState().logs.length} check-ins`,
            ]}
            action="Keep this device"
            busy={busy === "pushing"}
            onClick={() => run("push")}
          />
          <SideCard
            title="Your backup"
            lines={[
              `${remote?.quests ?? 0} quests`,
              `${remote?.logs ?? 0} check-ins`,
              remote?.lastActivity
                ? `Last active ${prettyDay(remote.lastActivity)}`
                : "No activity recorded",
            ]}
            action="Restore backup"
            busy={busy === "pulling"}
            onClick={() => run("pull")}
          />
        </div>

        {message && <p className="mt-3 text-2xs text-danger">{message}</p>}
      </Panel>
    );
  }

  /* --- Normal state -------------------------------------------------- */
  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan/15 text-cyan-ink">
          {busy ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : sync.lastPushedAt ? (
            <Check className="size-4.5" strokeWidth={2.5} />
          ) : (
            <CloudUpload className="size-4.5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Cloud backup</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            {sync.lastPushedAt
              ? `Last backed up ${new Date(sync.lastPushedAt).toLocaleString()}.`
              : "Nothing backed up yet. One tap and your world is safe."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" loading={busy === "pushing"} onClick={() => run("push")}>
              <CloudUpload className="size-3.5" />
              Back up now
            </Button>
            {remote?.hasData && (
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "pulling"}
                onClick={() => run("pull")}
              >
                <CloudDownload className="size-3.5" />
                Restore
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              loading={busy === "checking"}
              onClick={async () => {
                setBusy("checking");
                setRemote(await describeRemote());
                setBusy(null);
              }}
            >
              <RefreshCw className="size-3.5" />
              Check
            </Button>
          </div>

          {message && (
            <p
              className={cn(
                "mt-2.5 text-2xs",
                message.includes("Backed up") || message.includes("Restored")
                  ? "text-success"
                  : "text-danger",
              )}
            >
              {message}
            </p>
          )}
          {sync.error && !message && (
            <p className="mt-2.5 text-2xs text-danger">{sync.error}</p>
          )}

          <p className="mt-2.5 text-2xs text-ink-faint">
            This is a backup, not live sync across devices — the last device to
            back up wins.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function SideCard({
  title,
  lines,
  action,
  busy,
  onClick,
}: {
  title: string;
  lines: string[];
  action: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-edge bg-surface p-3.5">
      <p className="text-xs font-semibold">{title}</p>
      <ul className="mt-1.5 space-y-0.5">
        {lines.map((line) => (
          <li key={line} className="text-2xs text-ink-mute">
            {line}
          </li>
        ))}
      </ul>
      <Button size="sm" fullWidth className="mt-3" loading={busy} onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}
