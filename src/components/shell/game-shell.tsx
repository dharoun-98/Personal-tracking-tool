"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CreditCard, X } from "lucide-react";
import { evaluateAccess, type AccessState } from "@/lib/billing/access";
import { localAccountRow } from "@/lib/billing/local-access";
import { useGame, useHydrated } from "@/lib/store";
import { useNowMs } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { BottomNav, SideRail } from "@/components/shell/app-nav";
import { BootSplash } from "@/components/shell/boot-splash";
import { Mascot } from "@/components/mascot/mascot";
import { Paywall } from "@/components/billing/paywall";

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
}: {
  children: React.ReactNode;
  serverAccess: AccessState | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useGame((s) => s.onboardingComplete);
  const account = useGame((s) => s.account);
  const nowMs = useNowMs();

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/onboarding");
  }, [hydrated, onboarded, router]);

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
  if (!onboarded) return <BootSplash label="Setting things up…" />;

  if (access.level === "locked") {
    return <Paywall state={access} signedIn={signedIn} />;
  }

  const showBanner =
    (access.level === "notice" && !dismissed) || access.level === "warning";

  return (
    <div className="md:pl-60">
      <SideRail />

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sticky top-0 z-30 overflow-hidden md:pl-0"
          >
            <div
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 pad-safe-top backdrop-blur-md",
                access.level === "warning"
                  ? "bg-warn/15 text-warn"
                  : "bg-surface-2/90 text-ink-dim",
              )}
            >
              <p className="min-w-0 flex-1 text-2xs font-medium">{access.message}</p>
              <Link
                href="/account"
                className="tappable inline-flex shrink-0 items-center gap-1 rounded-lg bg-gold px-2.5 py-1.5 text-2xs font-bold text-on-accent"
              >
                <CreditCard className="size-3" />
                {access.isTrial ? "Continue" : "Update card"}
              </Link>
              {access.level === "notice" && (
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  aria-label="Dismiss"
                  className="tappable shrink-0 text-ink-faint"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto w-full max-w-2xl px-5 pb-[calc(var(--nav-h)+var(--safe-bottom)+2rem)] pad-safe-top md:pb-14">
        {children}
      </div>

      <BottomNav />
      <Mascot />
    </div>
  );
}
