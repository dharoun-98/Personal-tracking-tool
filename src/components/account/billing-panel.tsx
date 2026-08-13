"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { evaluateAccess, type AccessState } from "@/lib/billing/access";
import { localAccountRow } from "@/lib/billing/local-access";
import { useGame } from "@/lib/store";
import { useNowMs } from "@/lib/use-now";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { formatPlanPrice, usePlanPrice } from "@/components/billing/plan-price";

const LABEL: Record<AccessState["reason"], string> = {
  trialing: "Free trial",
  "trial-ending": "Free trial, ending soon",
  "trial-expired": "Trial ended",
  subscribed: "Subscribed",
  comped: "Complimentary access",
  staff: "Team access",
  "payment-failed": "Payment problem",
  "payment-failed-final": "Payment problem",
  cancelled: "Subscription ended",
  unknown: "No subscription",
};

export function BillingPanel({
  access,
  signedIn,
  hasStripeCustomer,
}: {
  access: AccessState;
  signedIn: boolean;
  hasStripeCustomer: boolean;
}) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localAccount = useGame((state) => state.account);
  const nowMs = useNowMs();
  const shownAccess =
    !signedIn && nowMs > 0
      ? evaluateAccess(localAccountRow(localAccount), nowMs)
      : access;
  const shouldOpenPortal =
    hasStripeCustomer &&
    (shownAccess.reason === "subscribed" ||
      shownAccess.reason === "payment-failed" ||
      shownAccess.reason === "payment-failed-final");
  const planPrice = usePlanPrice(signedIn && !shouldOpenPortal);
  const planPriceLabel = formatPlanPrice(planPrice);

  const go = async (kind: "checkout" | "portal") => {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(`/api/billing/${kind}`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError(result.message ?? "That didn't open. Try again shortly.");
    } catch {
      setError("Couldn't reach the payment provider.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-ink">
          {shownAccess.reason === "comped" || shownAccess.reason === "staff" ? (
            <ShieldCheck className="size-4.5" />
          ) : (
            <CreditCard className="size-4.5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{LABEL[shownAccess.reason]}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            {shownAccess.message ||
              (shownAccess.daysLeft != null
                ? `${shownAccess.daysLeft} days remaining.`
                : "Nothing to do here.")}
          </p>

          {!signedIn ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/auth/sign-up?next=%2Faccount" className={buttonClasses({ size: "sm" })}>
                Create an account
              </Link>
              <Link
                href="/auth/sign-in?next=%2Faccount"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Sign in
              </Link>
            </div>
          ) : shownAccess.reason !== "comped" && shownAccess.reason !== "staff" ? (
            <div className="mt-3">
              {!shouldOpenPortal && (
                <p className="mb-2.5 text-2xs leading-relaxed text-ink-faint">
                  {planPriceLabel
                    ? `${planPriceLabel}. You'll review the plan in Stripe before confirming.`
                    : "Price and billing cadence are shown in Stripe before you confirm."}
                </p>
              )}
                <div className="flex flex-wrap gap-2">
                  {shouldOpenPortal ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === "portal"}
                      onClick={() => go("portal")}
                    >
                      <ExternalLink className="size-3.5" />
                      Manage subscription
                    </Button>
                  ) : (
                  <Button size="sm" loading={busy === "checkout"} onClick={() => go("checkout")}>
                    <CreditCard className="size-3.5" />
                    Choose a subscription
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {error && (
            <p className="mt-2.5 text-2xs text-warn" role="alert">
              {error}
            </p>
          )}

          {!signedIn && (
            <p className="mt-2.5 text-2xs text-ink-faint">
              A subscription belongs to an account. Price and billing cadence are
              shown before you confirm anything.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
