"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { CreditCard, ExternalLink, LogOut, UserRoundPlus } from "lucide-react";
import { DOMAINS } from "@/lib/domains";
import type { AccessState } from "@/lib/billing/access";
import { useSnapshot } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { compactNumber } from "@/lib/format";
import { safeInternalReturnPath } from "@/lib/safe-return";
import { Panel } from "@/components/ui/panel";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataExportCard } from "@/components/account/data-export-card";
import { DocumentCard } from "@/components/documents/document-card";
import { DomainIcon } from "@/components/game/domain-icon";
import { formatPlanPrice, usePlanPrice } from "@/components/billing/plan-price";

/* ==================================================================== *
 * The lock screen.
 *
 * Two rules shaped this:
 *
 *   1. Never imply the player's history is gone. It isn't — it's sitting
 *      right there on the device, and the screen says so and proves it by
 *      showing their real numbers. A paywall that feels like a hostage
 *      situation earns a chargeback, not a subscription.
 *   2. Ask once, warmly, and leave a door open. Sign out, download your
 *      documents, take your data. People who feel free to leave come back.
 * ==================================================================== */

const COPY: Record<
  AccessState["reason"],
  { title: string; body: string; cta: string }
> = {
  "trial-expired": {
    title: "Your free trial has ended.",
    body: "Your orbs are exactly where you left them, and they'll stay there. Add a card whenever you want to pick the game back up.",
    cta: "Choose a plan",
  },
  "payment-failed-final": {
    title: "Your card said no.",
    body: "Happens to everyone — expired card, new bank, a fraud flag on a subscription it didn't recognise. Update it and you're straight back in.",
    cta: "Update payment method",
  },
  cancelled: {
    title: "Your subscription ended.",
    body: "Everything you built is still here, waiting. Start it up again whenever it's the right time.",
    cta: "Restart subscription",
  },
  // The rest never reach a locked state; present for exhaustiveness.
  trialing: { title: "", body: "", cta: "" },
  "trial-ending": { title: "", body: "", cta: "" },
  subscribed: { title: "", body: "", cta: "" },
  comped: { title: "", body: "", cta: "" },
  staff: { title: "", body: "", cta: "" },
  "payment-failed": { title: "", body: "", cta: "" },
  unknown: {
    title: "Time to sort out billing.",
    body: "Add a payment method to keep playing.",
    cta: "Set up subscription",
  },
};

export function Paywall({
  state,
  signedIn,
  hasStripeCustomer,
}: {
  state: AccessState;
  signedIn: boolean;
  hasStripeCustomer: boolean;
}) {
  const { domains, level, streak, totalXp } = useSnapshot();
  const profile = useGame((s) => s.profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[state.reason] ?? COPY.unknown;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const returnPath = safeInternalReturnPath(search ? `${pathname}?${search}` : pathname);
  const nextParam = encodeURIComponent(returnPath);
  const first = profile?.displayName.split(" ")[0];
  const lit = DOMAINS.filter((d) => domains[d.id].questCount > 0);
  const body = signedIn
    ? copy.body
    : "Your orbs are exactly where you left them. Connect this world to an account whenever you want to pick the game back up.";

  const billingAction =
    state.reason === "payment-failed-final" && hasStripeCustomer ? "portal" : "checkout";
  const planPrice = usePlanPrice(!signedIn || billingAction === "checkout");
  const planPriceLabel = formatPlanPrice(planPrice);

  const startBilling = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/billing/${billingAction}`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError(
        result.message ??
          `Couldn't open ${billingAction === "portal" ? "billing" : "checkout"}. Try again shortly.`,
      );
    } catch {
      setError("Couldn't reach the payment provider. Try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem-var(--safe-top))] w-full max-w-lg flex-col justify-center px-5 py-12 md:min-h-dvh">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* The player's own constellation, dimmed but present. */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          {lit.map((domain, i) => (
            <motion.span
              key={domain.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 220, damping: 18 }}
              className="grid size-12 place-items-center rounded-full"
              style={{
                background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${domain.color} 28%, var(--color-surface)), var(--color-surface))`,
                border: `1px solid color-mix(in oklab, ${domain.color} 45%, transparent)`,
                color: domain.ink,
              }}
            >
              <DomainIcon domain={domain.id} className="size-5" />
            </motion.span>
          ))}
        </div>

        <h1 className="text-center font-display text-3xl leading-tight font-bold text-balance">
          {copy.title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-ink-mute text-pretty">
          {first ? `${first}, ` : ""}
          {body}
        </p>

        {/* Proof that nothing is lost. */}
        <Panel className="mt-7 p-4">
          <p className="mb-3 text-center text-2xs tracking-wide text-ink-faint uppercase">
            Still yours, exactly as you left it
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat value={String(level.level)} label="Level" />
            <Stat value={String(streak)} label="Day streak" />
            <Stat value={compactNumber(totalXp)} label="XP" />
          </div>
        </Panel>

        <div className="mt-6 space-y-2.5">
          {signedIn ? (
            <div>
              {billingAction === "checkout" && (
                <p className="mb-2.5 text-center text-xs text-ink-mute">
                  {planPriceLabel
                    ? `${planPriceLabel}. You'll review the plan in Stripe before confirming.`
                    : "Price and billing cadence are shown in Stripe before you confirm."}
                </p>
              )}
              <Button size="lg" variant="gold" fullWidth loading={busy} onClick={startBilling}>
                {!busy &&
                  (billingAction === "portal" ? (
                    <ExternalLink className="size-4" aria-hidden />
                  ) : (
                    <CreditCard className="size-4" aria-hidden />
                  ))}
                {copy.cta}
              </Button>
            </div>
          ) : (
            <Panel className="p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet-soft">
                  <UserRoundPlus className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Connect this world first</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                    A subscription needs an account to belong to. Create one to
                    protect this world, or sign in if it is already backed up.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                <Link
                  href={`/auth/sign-up?next=${nextParam}`}
                  className={buttonClasses({ variant: "gold", size: "md", fullWidth: true })}
                >
                  Create an account
                </Link>
                <Link
                  href={`/auth/sign-in?next=${nextParam}`}
                  className={buttonClasses({ variant: "secondary", size: "md", fullWidth: true })}
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-3 text-2xs leading-relaxed text-ink-faint">
                {planPriceLabel
                  ? `Current plan: ${planPriceLabel}. You'll review it again before confirming.`
                  : "Price and billing cadence are shown before you confirm anything."}
              </p>
            </Panel>
          )}

          {error && (
            <p
              className="rounded-xl bg-warn/12 px-3.5 py-2.5 text-center text-xs text-warn"
              role="alert"
            >
              {error}
            </p>
          )}

          {signedIn && (
            <form action="/auth/sign-out" method="post">
              <Button
                type="submit"
                variant="ghost"
                fullWidth
              >
                <LogOut className="size-3.5" aria-hidden />
                Sign out
              </Button>
            </form>
          )}
        </div>

        <section className="mt-9" aria-labelledby="paywall-downloads-title">
          <h2
            id="paywall-downloads-title"
            className="text-center font-display text-xl font-bold"
          >
            Your data is still yours
          </h2>
          <p className="mx-auto mt-2 mb-4 max-w-sm text-center text-xs leading-relaxed text-ink-mute">
            These downloads are available without subscribing. PDFs are built
            on this device, and the JSON file contains the complete local copy.
          </p>
          <div className="space-y-2.5">
            <DocumentCard kind="report" />
            <DocumentCard kind="promise" />
            <DataExportCard />
          </div>
        </section>

        <p className="mt-6 text-center text-2xs leading-relaxed text-ink-faint">
          Cancel any time. Your on-device data and these export tools remain available.
        </p>
      </motion.div>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-3 text-center">
      <p className="font-display text-xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-0.5 text-2xs text-ink-faint">{label}</p>
    </div>
  );
}
