"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CreditCard, LogOut, Sparkles } from "lucide-react";
import { DOMAINS } from "@/lib/domains";
import type { AccessState } from "@/lib/billing/access";
import { useSnapshot } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { compactNumber } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { DomainIcon } from "@/components/game/domain-icon";

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
    title: "That's sixteen days.",
    body: "Your orbs are exactly where you left them, and they'll stay there. Add a card whenever you want to pick the game back up.",
    cta: "Continue playing",
  },
  "payment-failed-final": {
    title: "Your card said no.",
    body: "Happens to everyone — expired card, new bank, a fraud flag on a subscription it didn't recognise. Update it and you're straight back in.",
    cta: "Update payment method",
  },
  cancelled: {
    title: "Your subscription ended.",
    body: "Everything you built is still here, waiting. Start it up again whenever it's the right time.",
    cta: "Start again",
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
    cta: "Continue playing",
  },
};

export function Paywall({
  state,
  signedIn,
}: {
  state: AccessState;
  signedIn: boolean;
}) {
  const { domains, level, streak, totalXp } = useSnapshot();
  const profile = useGame((s) => s.profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[state.reason] ?? COPY.unknown;
  const first = profile?.displayName.split(" ")[0];
  const lit = DOMAINS.filter((d) => domains[d.id].questCount > 0);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError(result.message ?? "Couldn't open checkout. Try again shortly.");
    } catch {
      setError("Couldn't reach the payment provider. Try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-12 pad-safe-top">
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
          {copy.body}
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
          <Button size="lg" variant="gold" fullWidth loading={busy} onClick={startCheckout}>
            {!busy && <CreditCard className="size-4" />}
            {copy.cta}
          </Button>

          {error && (
            <p className="rounded-xl bg-warn/12 px-3.5 py-2.5 text-center text-xs text-warn">
              {error}
            </p>
          )}

          <Link
            href="/account"
            className="tappable flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold text-ink-mute transition-colors hover:text-ink"
          >
            <Sparkles className="size-3.5" />
            Download your report and promise letter
          </Link>

          {signedIn && (
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="tappable flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-medium text-ink-faint transition-colors hover:text-ink-mute"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-2xs leading-relaxed text-ink-faint">
          Your data stays on this device either way. Cancel any time, and take
          your documents with you.
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
