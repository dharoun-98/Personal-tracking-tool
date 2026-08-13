"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleX, RefreshCw } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

export type CheckoutOutcome = "done" | "cancelled" | null;

/** Gives the billing webhook a short window to update access after Checkout. */
export function CheckoutReturnNotice({
  outcome,
  confirmed,
}: {
  outcome: CheckoutOutcome;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    if (outcome !== "done" || confirmed) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const check = () => {
      if (stopped) return;
      attempt += 1;
      setChecks(attempt);
      startRefresh(() => router.refresh());
      if (attempt < 3) timer = setTimeout(check, 2000);
    };

    timer = setTimeout(check, 900);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [confirmed, outcome, router]);

  if (!outcome) return null;

  if (outcome === "cancelled") {
    return (
      <Panel className="border-edge bg-surface-2/70 p-4" role="status">
        <div className="flex items-start gap-3">
          <CircleX className="mt-0.5 size-5 shrink-0 text-ink-mute" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Checkout closed</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-mute">
              Checkout wasn&apos;t completed, so no subscription change was confirmed. You
              can choose a subscription whenever you&apos;re ready.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      className={confirmed ? "border-success/35 bg-success/8 p-4" : "border-cyan/30 bg-cyan/8 p-4"}
      role="status"
      aria-live="polite"
      aria-busy={!confirmed && refreshing}
    >
      <div className="flex items-start gap-3">
        {confirmed ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        ) : (
          <RefreshCw
            className={`mt-0.5 size-5 shrink-0 text-cyan-ink ${refreshing ? "animate-spin" : ""}`}
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {confirmed ? "Subscription active" : "Checkout finished"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            {confirmed
              ? "You're all set. Your account access has been confirmed."
              : checks < 3
                ? "We're securely confirming the update. This usually takes only a few seconds."
                : "Confirmation is taking a little longer than usual. Your local data is safe; check again in a moment."}
          </p>
          {!confirmed && checks >= 3 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3"
              loading={refreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Check again
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
