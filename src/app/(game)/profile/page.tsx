"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Cloud,
  CreditCard,
  LogIn,
  Pencil,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { MOTIVATION_STYLES, RHYTHMS, TIME_BUDGETS } from "@/lib/onboarding";
import { levelTitle } from "@/lib/game";
import { compactNumber } from "@/lib/format";
import { useSnapshot, useTrialDaysLeft } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { MascotAvatar } from "@/components/mascot/mascot-avatar";
import { InstallCard } from "@/components/shell/install-card";
import { DocumentCard } from "@/components/documents/document-card";
import { EmailDocuments } from "@/components/documents/email-documents";
import { DataExportCard } from "@/components/account/data-export-card";
import { useViewerAccount } from "@/components/account/account-context";
import { useSyncStatus } from "@/components/shell/sync-manager";
import { buttonClasses } from "@/components/ui/button-styles";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { StreakFlame } from "@/components/game/streak-flame";
import { clearCloudSnapshot } from "@/lib/sync/sync";

export default function ProfilePage() {
  const router = useRouter();
  const profile = useGame((s) => s.profile);
  const account = useGame((s) => s.account);
  const sync = useGame((s) => s.sync);
  const resetEverything = useGame((s) => s.resetEverything);
  const viewer = useViewerAccount();
  const syncPhase = useSyncStatus((s) => s.phase);
  const { level, streak, totalXp } = useSnapshot();
  const trialLeft = useTrialDaysLeft();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const resetCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmReset) return;
    requestAnimationFrame(() => resetCancelRef.current?.focus());
  }, [confirmReset]);

  if (!profile) return null;

  const first = profile.displayName.split(" ")[0];

  return (
    <main className="space-y-7 pt-6">
      {/* --------------------------------------------------------- Header */}
      <header className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-full border border-cyan/30 bg-surface">
          <MascotAvatar size={44} mood="happy" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold">
            {profile.displayName}
          </h1>
          <p className="mt-0.5 text-xs text-gold-ink">
            Level {level.level} · {levelTitle(level.level)}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <StreakFlame days={streak} size="sm" />
            <span className="text-2xs text-ink-faint tabular-nums">
              {compactNumber(totalXp)} XP
            </span>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------- Account & services */}
      <section>
        <SectionTitle>Account &amp; services</SectionTitle>
        <Panel className="mb-2.5 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl",
                viewer.signedIn
                  ? "bg-success/15 text-success"
                  : "bg-violet/15 text-violet-soft",
              )}
            >
              {viewer.signedIn ? (
                <ShieldCheck className="size-5" aria-hidden />
              ) : (
                <UserRound className="size-5" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {viewer.signedIn ? "Signed in" : "Using this device only"}
              </p>
              <p className="mt-1 break-all text-xs leading-relaxed text-ink-mute">
                {viewer.signedIn
                  ? viewer.email ?? "Your account is connected."
                  : viewer.cloudEnabled
                    ? "Sign in to keep this world synced and available on other devices."
                    : "Your progress is saved locally on this device."}
              </p>
            </div>
            {viewer.signedIn ? (
              <Link
                href="/account#sign-in-security"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Manage account
              </Link>
            ) : viewer.cloudEnabled ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href="/auth/sign-in?next=%2Fprofile" className={buttonClasses({ size: "sm" })}>
                  <LogIn className="size-3.5" aria-hidden />
                  Sign in
                </Link>
                <Link
                  href="/auth/sign-up?next=%2Fprofile"
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  Create account
                </Link>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="divide-y divide-hairline/60 overflow-hidden">
          <ServiceRow
            href="/account#cloud-sync"
            icon={Cloud}
            label="Cloud sync"
            value={cloudSyncLabel(viewer.signedIn, syncPhase, sync.lastPushedAt)}
            tone={syncPhase === "conflict" || syncPhase === "error" ? "warning" : undefined}
          />
          <ServiceRow
            href="/account#notifications"
            icon={Bell}
            label="Notifications"
            value="Manage check-in reminders"
          />
          <ServiceRow
            href="/account#subscription"
            icon={CreditCard}
            label="Subscription"
            value={subscriptionLabel(viewer.access, viewer.signedIn, trialLeft)}
          />
        </Panel>
      </section>

      {/* ---------------------------------------------------------- Trial */}
      {!viewer.signedIn && account.status === "trialing" && trialLeft !== null && (
        <Panel
          className={cn(
            "p-4",
            trialLeft <= 3 ? "border-gold/40 bg-gold/8" : "border-cyan/25 bg-cyan/6",
          )}
        >
          <p
            className={cn(
              "text-sm font-semibold",
              trialLeft <= 3 ? "text-gold-ink" : "text-cyan-ink",
            )}
          >
            {trialLeft > 0
              ? `${trialLeft} ${trialLeft === 1 ? "day" : "days"} left in your trial`
              : "Your trial has ended"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-dim">
            {trialLeft > 0
              ? "No card on file, nothing to cancel. Keep playing and decide later."
              : "Choose a subscription whenever you're ready to keep playing. Price and billing cadence are shown before you confirm."}
          </p>
        </Panel>
      )}

      {/* ------------------------------------------------------ Documents */}
      <section>
        <SectionTitle>Your data &amp; documents</SectionTitle>
        <div className="space-y-2.5">
          <DocumentCard kind="report" />
          <DocumentCard kind="promise" />
          <DataExportCard />
          <EmailDocuments />
        </div>
        <p className="mt-2 px-1 text-2xs text-ink-faint">
          Downloads are built on this device. Email delivery only sends the two PDFs
          after you explicitly choose it.
        </p>
      </section>

      {/* -------------------------------------------------------- Install */}
      <section>
        <SectionTitle>On your device</SectionTitle>
        <InstallCard />
      </section>

      {/* ----------------------------------------------------- Appearance */}
      <section>
        <SectionTitle>Appearance</SectionTitle>
        <ThemeToggle />
        <p className="mt-2 px-1 text-2xs text-ink-faint">
          Night is the original. Day is for bright rooms and people who prefer it.
        </p>
      </section>

      {/* ------------------------------------------------------- Settings */}
      <section>
        <SectionTitle
          action={
            <Link
              href="/settings"
              className="tappable inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-2xs font-semibold text-violet-soft"
            >
              <Pencil className="size-3.5" />
              Edit
            </Link>
          }
        >
          Your setup
        </SectionTitle>
        <Panel className="divide-y divide-hairline/60">
          <SettingRow
            label="Companion"
            value={
              MOTIVATION_STYLES.find((s) => s.id === profile.motivationStyle)?.name ??
              "—"
            }
          />
          <SettingRow
            label="Check-in rhythm"
            value={RHYTHMS.find((r) => r.id === profile.rhythm)?.name ?? "—"}
          />
          <SettingRow
            label="Daily time"
            value={
              TIME_BUDGETS.find((t) => t.minutes === profile.dailyMinutes)?.label ??
              `${profile.dailyMinutes} min`
            }
          />
          <SettingRow
            label="Focus domains"
            value={`${profile.priorities.length} chosen`}
          />
        </Panel>
      </section>

      {/* ----------------------------------------------------- Danger zone */}
      <section>
        <SectionTitle>Start over</SectionTitle>
        <Panel className="p-4">
          {confirmReset ? (
            <>
              <p className="text-sm font-semibold text-danger">
                This erases everything.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                {viewer.signedIn
                  ? "Every quest, check-in, streak and achievement on this device and in your cloud save, permanently."
                  : "Every quest, check-in, streak and achievement on this device, permanently."}
                {` ${first} — there's no undo.`}
              </p>
              {resetError && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger"
                >
                  {resetError}
                </p>
              )}
              <div className="mt-3.5 flex gap-2.5">
                <Button
                  variant="danger"
                  size="sm"
                  loading={resetting}
                  onClick={async () => {
                    setResetError(null);
                    setResetting(true);
                    if (viewer.signedIn) {
                      const result = await clearCloudSnapshot();
                      if (!result.ok) {
                        setResetError(`${result.message} Nothing on this device was erased.`);
                        setResetting(false);
                        return;
                      }
                      resetEverything({ cloudCleared: true });
                    } else {
                      // This device is signed out, so the reset is deliberately
                      // local-only. Forget the old sync owner without touching
                      // that account's cloud copy.
                      resetEverything({ detachCloud: true });
                    }
                    router.replace("/onboarding");
                  }}
                >
                  Yes, erase it all
                </Button>
                <Button
                  ref={resetCancelRef}
                  variant="ghost"
                  size="sm"
                  disabled={resetting}
                  onClick={() => {
                    setConfirmReset(false);
                    setResetError(null);
                    requestAnimationFrame(() => resetTriggerRef.current?.focus());
                  }}
                >
                  Keep my world
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Reset your world</p>
                <p className="mt-0.5 text-2xs text-ink-faint">
                  Wipe everything and run setup again.
                </p>
              </div>
              <Button
                ref={resetTriggerRef}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmReset(true);
                  setResetError(null);
                }}
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-ink-dim">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ServiceRow({
  href,
  icon: Icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: typeof Cloud;
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <Link href={href} className="tappable flex min-h-16 items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          tone === "warning"
            ? "bg-warn/15 text-warn"
            : "bg-surface-2 text-violet-soft",
        )}
      >
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-mute">{value}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
    </Link>
  );
}

function cloudSyncLabel(
  signedIn: boolean,
  phase: ReturnType<typeof useSyncStatus.getState>["phase"],
  lastPushedAt?: string,
): string {
  if (!signedIn) return "Off — sign in to sync across devices";
  if (phase === "conflict") return "Choose which copy to keep";
  if (phase === "account-change") return "Sync paused — account changed";
  if (phase === "error") return "Sync needs attention";
  if (phase === "offline") return "Offline — changes will retry";
  if (phase === "restoring") return "Restoring your cloud copy…";
  if (lastPushedAt) return `Last saved ${new Date(lastPushedAt).toLocaleString()}`;
  return "Automatic sync is on";
}

function subscriptionLabel(
  access: ReturnType<typeof useViewerAccount>["access"],
  signedIn: boolean,
  localTrialDays: number | null,
): string {
  if (!signedIn) {
    return localTrialDays == null
      ? "View access and plan options"
      : `${localTrialDays} ${localTrialDays === 1 ? "day" : "days"} left in local trial`;
  }
  if (!access) return "View access and plan options";
  const labels = {
    trialing: "Free trial",
    "trial-ending": `${access.daysLeft ?? 0} days left in free trial`,
    "trial-expired": "Free trial ended",
    subscribed: "Subscribed",
    comped: "Complimentary access",
    staff: "Team access",
    "payment-failed": "Payment needs attention",
    "payment-failed-final": "Payment needs attention",
    cancelled: "Subscription ended",
    unknown: "No subscription",
  } as const;
  return labels[access.reason];
}
