"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CreditCard, RefreshCw, X } from "lucide-react";
import { evaluateAccess, type AccessState } from "@/lib/billing/access";
import { localAccountRow } from "@/lib/billing/local-access";
import { useGame, useHydrated } from "@/lib/store";
import { useNowMs } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { AppHeader, BottomNav, SideRail } from "@/components/shell/app-nav";
import { BootSplash } from "@/components/shell/boot-splash";
import { syncNow, useSyncStatus } from "@/components/shell/sync-manager";
import { Mascot } from "@/components/mascot/mascot";
import { Paywall } from "@/components/billing/paywall";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { pullSnapshot } from "@/lib/sync/sync";
import { DataExportCard } from "@/components/account/data-export-card";

/**
 * Shell for every in-game screen.
 *
 * Navigation is duplicated rather than adaptive: a bottom tab bar on phones
 * (thumb reach, standard app grammar) and a left rail on laptops (no wasted
 * vertical space). One component trying to be both ends up good at neither.
 *
 * `serverAccess` is computed in the server layout from the account row. When
 * it's present it wins outright — the browser's opinion of whether someone has
 * paid is not evidence. It's null for signed-out players, who fall back to the
 * local trial clock.
 */
export function GameShell({
  children,
  serverAccess,
  signedIn,
  email,
  accountError,
  hasStripeCustomer,
}: {
  children: React.ReactNode;
  serverAccess: AccessState | null;
  signedIn: boolean;
  email: string | null;
  accountError: string | null;
  hasStripeCustomer: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const onboarded = useGame((s) => s.onboardingComplete);
  const account = useGame((s) => s.account);
  const nowMs = useNowMs();
  const syncPhase = useSyncStatus((s) => s.phase);

  const [dismissed, setDismissed] = useState(false);

  /*
   * Don't march a returning player through onboarding.
   *
   * A signed-in user on a new device has an empty store but a full account in
   * the cloud. Redirecting on `!onboarded` alone would force them to invent a
   * whole new life before they could reach the screen that restores their real
   * one. So while a restore is in flight, wait.
   */
  const restoring =
    signedIn && !onboarded && (syncPhase === "idle" || syncPhase === "restoring");
  const restoreProblem =
    signedIn &&
    !onboarded &&
    (syncPhase === "offline" || syncPhase === "error" || syncPhase === "conflict");
  const accountChanged = signedIn && syncPhase === "account-change";

  useEffect(() => {
    if (
      !hydrated ||
      onboarded ||
      restoring ||
      restoreProblem ||
      accountChanged ||
      accountError
    ) {
      return;
    }
    router.replace("/onboarding");
  }, [accountChanged, accountError, hydrated, onboarded, restoring, restoreProblem, router, signedIn]);

  const access = useMemo<AccessState>(() => {
    if (serverAccess) return serverAccess;
    if (nowMs === 0) {
      // Before the clock ticks, assume open. Flashing a paywall for a frame
      // while we work out the date would be unforgivable.
      return { level: "open", reason: "unknown", daysLeft: null, message: "", isTrial: true };
    }
    return evaluateAccess(localAccountRow(account), nowMs);
  }, [serverAccess, account, nowMs]);

  if (!hydrated) return <BootSplash />;
  if (accountError) {
    return (
      <IdentityState signedIn={signedIn} email={email} identityUnknown={!signedIn}>
        <AccountAccessProblem signedIn={signedIn} email={email} message={accountError} />
      </IdentityState>
    );
  }
  if (accountChanged) {
    return (
      <IdentityState signedIn email={email}>
        <AccountChangeProblem />
      </IdentityState>
    );
  }
  if (!onboarded && restoring) {
    return (
      <IdentityState signedIn email={email}>
        <BootSplash label="Restoring your world…" />
      </IdentityState>
    );
  }
  if (restoreProblem) {
    return (
      <IdentityState signedIn email={email}>
        <RestoreProblem phase={syncPhase} />
      </IdentityState>
    );
  }
  if (!onboarded) return <BootSplash label="Setting things up…" />;

  // Billing should never block the one route where someone can update it,
  // sign out, or export their data.
  if (access.level === "locked" && pathname !== "/account") {
    return (
      <IdentityState signedIn={signedIn} email={email}>
        <Paywall
          state={access}
          signedIn={signedIn}
          hasStripeCustomer={hasStripeCustomer}
        />
      </IdentityState>
    );
  }

  const showBanner =
    (access.level === "notice" && !dismissed) || access.level === "warning";

  return (
    <div className="md:pl-60">
      <SideRail />
      <AppHeader signedIn={signedIn} email={email} />

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sticky top-[calc(3.5rem+var(--safe-top))] z-20 overflow-hidden md:top-0 md:pl-0"
          >
            <div
              className={cn(
                "flex flex-wrap items-center gap-2.5 px-5 py-2.5 backdrop-blur-md md:pt-[calc(0.625rem+var(--safe-top))] md:pr-56",
                access.level === "warning"
                  ? "bg-warn/15 text-warn"
                  : "bg-surface-2/90 text-ink-dim",
              )}
            >
              <p className="min-w-0 flex-1 text-2xs font-medium">{access.message}</p>
              <Link
                href="/account"
                className="tappable inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-gold px-3 text-xs font-bold text-on-accent"
              >
                <CreditCard className="size-3" />
                {access.isTrial ? "Continue" : "Update card"}
              </Link>
              {access.level === "notice" && (
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  aria-label="Dismiss"
                  className="tappable grid size-11 shrink-0 place-items-center rounded-lg text-ink-faint"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto w-full max-w-2xl px-5 pb-[calc(var(--nav-h)+var(--safe-bottom)+2rem)] md:pt-10 md:pb-14">
        {children}
      </div>

      <BottomNav />
      <Mascot />
    </div>
  );
}

function IdentityState({
  signedIn,
  email,
  identityUnknown = false,
  children,
}: {
  signedIn: boolean;
  email: string | null;
  identityUnknown?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <AppHeader signedIn={signedIn} email={email} identityUnknown={identityUnknown} />
      {children}
    </div>
  );
}

function AccountAccessProblem({
  signedIn,
  email,
  message,
}: {
  signedIn: boolean;
  email: string | null;
  message: string;
}) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-3.5rem-var(--safe-top))] w-full max-w-md place-items-center px-5 py-12 md:min-h-dvh">
      <div className="w-full">
        <Panel className="p-6">
          <span className="mb-4 grid size-11 place-items-center rounded-2xl bg-warn/14 text-warn">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-xl font-bold">We couldn&apos;t verify your account</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute">
            {signedIn
              ? `${email ? `You're still signed in as ${email}, but ` : "You're still signed in, but "}we couldn't safely confirm your access.`
              : "We couldn't securely check whether this device is signed in."} We have
            not changed your local world or guessed at your billing status.
          </p>
          <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2.5 text-xs leading-relaxed text-warn" role="alert">
            {message}
          </p>
          <div className="mt-5 space-y-2.5">
            <Button
              fullWidth
              loading={retrying}
              onClick={() => startRetry(() => router.refresh())}
            >
              <RefreshCw className="size-4" aria-hidden />
              Retry account check
            </Button>
            <form action="/auth/sign-out" method="post">
              <Button type="submit" variant="ghost" fullWidth>
                Sign out
              </Button>
            </form>
          </div>
        </Panel>
        <div className="mt-3">
          <DataExportCard />
        </div>
      </div>
    </main>
  );
}

function RestoreProblem({ phase }: { phase: ReturnType<typeof useSyncStatus.getState>["phase"] }) {
  const error = useSyncStatus((state) => state.error);
  const [retrying, setRetrying] = useState(false);

  const offline = phase === "offline";

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-3.5rem-var(--safe-top))] w-full max-w-md place-items-center px-5 py-12 md:min-h-dvh">
      <Panel className="w-full p-6">
        <span className="mb-4 grid size-11 place-items-center rounded-2xl bg-warn/14 text-warn">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <h1 className="font-display text-xl font-bold">
          {offline ? "We couldn't reach your cloud save" : "Your world couldn't be restored"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute">
          We have not started a new world or replaced anything on this device. Retry
          when the connection is ready, or sign out to play locally without touching
          the account&apos;s cloud data.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Button
            fullWidth
            loading={retrying}
            onClick={async () => {
              setRetrying(true);
              await syncNow({ restoring: true });
              setRetrying(false);
            }}
          >
            <RefreshCw className="size-4" aria-hidden />
            Retry restore
          </Button>
          <form action="/auth/sign-out" method="post" className="w-full">
            <input type="hidden" name="next" value="/onboarding" />
            <Button type="submit" variant="secondary" fullWidth>
              Sign out &amp; start locally
            </Button>
          </form>
        </div>
      </Panel>
    </main>
  );
}

function AccountChangeProblem() {
  const router = useRouter();
  const statusError = useSyncStatus((state) => state.error);
  const setPhase = useSyncStatus((state) => state.set);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const replaceWithAccount = async () => {
    if (!confirmReplace) {
      setConfirmReplace(true);
      return;
    }

    setRestoring(true);
    const result = await pullSnapshot();
    setRestoring(false);
    if (result.ok) {
      setPhase("ready");
      router.refresh();
      return;
    }
    setPhase("account-change", result.message);
  };

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-3.5rem-var(--safe-top))] w-full max-w-md place-items-center px-5 py-12 md:min-h-dvh">
      <Panel className="w-full p-6">
        <span className="mb-4 grid size-11 place-items-center rounded-2xl bg-warn/14 text-warn">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <h1 className="font-display text-xl font-bold">This device holds another world</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute">
          You signed in with a different account. Sync is paused so one person&apos;s
          quests and check-ins can never be attached to another account.
        </p>
        {confirmReplace && (
          <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2.5 text-xs leading-relaxed text-warn">
            Replacing loads the signed-in account&apos;s cloud copy onto this device.
            The current local world will no longer be available here. Export it first
            if you need to keep a copy.
          </p>
        )}
        {statusError && (
          <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            {statusError}
          </p>
        )}
        {confirmReplace && (
          <div className="mt-3">
            <DataExportCard />
          </div>
        )}
        <div className="mt-5 space-y-2.5">
          <Button
            variant={confirmReplace ? "danger" : "secondary"}
            fullWidth
            loading={restoring}
            onClick={replaceWithAccount}
          >
            {confirmReplace ? "Yes, replace this device" : "Use the signed-in account here"}
          </Button>
          <form action="/auth/sign-out" method="post">
            <Button type="submit" variant="ghost" fullWidth>
              Sign out and keep this device as it is
            </Button>
          </form>
        </div>
      </Panel>
    </main>
  );
}
