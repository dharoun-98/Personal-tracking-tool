"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import type { AccessState } from "@/lib/billing/access";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

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
          {access.reason === "comped" || access.reason === "staff" ? (
            <ShieldCheck className="size-4.5" />
          ) : (
            <CreditCard className="size-4.5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{LABEL[access.reason]}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            {access.message ||
              (access.daysLeft != null
                ? `${access.daysLeft} days remaining.`
                : "Nothing to do here.")}
          </p>

          {access.reason !== "comped" && access.reason !== "staff" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {access.reason === "subscribed" || hasStripeCustomer ? (
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
                  Add a payment method
                </Button>
              )}
            </div>
          )}

          {error && <p className="mt-2.5 text-2xs text-warn">{error}</p>}

          {!signedIn && (
            <p className="mt-2.5 text-2xs text-ink-faint">
              You&apos;ll need an account before you can subscribe.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
