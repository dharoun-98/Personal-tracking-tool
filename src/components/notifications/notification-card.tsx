"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Send, Share, SquarePlus } from "lucide-react";
import {
  detectSupport,
  disablePush,
  enablePush,
  isSubscribed,
  type PushSupport,
} from "@/lib/push/client";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

/**
 * Turning notifications on.
 *
 * The permission prompt can only be shown once — deny it and JavaScript can
 * never ask again. So this never fires it on page load, only from a deliberate
 * tap, and it explains what will actually arrive first. A player who knows
 * what they're agreeing to says yes more often than one who's ambushed.
 */
export function NotificationCard({ signedIn }: { signedIn: boolean }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState<"enable" | "disable" | "test" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "error">("info");

  useEffect(() => {
    let cancelled = false;

    // Everything resolves together and lands in one batch. Reading support
    // synchronously here would be a setState in the effect body, and doing it
    // during render would disagree with the server, where there's no
    // `navigator` to inspect.
    void (async () => {
      const configuredPromise = fetch("/api/push/subscribe")
        .then((r) => r.json())
        .then((r) => !!r.configured)
        .catch(() => false);

      const [isConfigured, alreadySubscribed] = await Promise.all([
        configuredPromise,
        isSubscribed(),
      ]);

      if (cancelled) return;
      setSupport(detectSupport());
      setConfigured(isConfigured);
      setSubscribed(alreadySubscribed);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to offer: no VAPID keys, or a browser with no Push API at all.
  if (configured === false || support === "unsupported") return null;
  if (support === null || configured === null) return null;

  const say = (text: string, kind: "info" | "error" = "info") => {
    setTone(kind);
    setMessage(text);
  };

  /* --- iOS in a tab: install first ---------------------------------- */
  if (support === "needs-install") {
    return (
      <Panel className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet-soft">
            <Bell className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Add to your Home Screen first</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-mute">
              iPhone only delivers notifications to installed apps — Safari tabs
              can&apos;t receive them. Two taps and you&apos;re done:
            </p>
            <ol className="mt-3 space-y-2.5 text-xs text-ink-dim">
              <li className="flex items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-cyan-ink">
                  <Share className="size-3.5" />
                </span>
                Tap Share in the Safari toolbar
              </li>
              <li className="flex items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-cyan-ink">
                  <SquarePlus className="size-3.5" />
                </span>
                Choose &ldquo;Add to Home Screen&rdquo;, then open it from there
              </li>
            </ol>
          </div>
        </div>
      </Panel>
    );
  }

  /* --- Blocked in browser settings ----------------------------------- */
  if (support === "denied") {
    return (
      <Panel className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-faint">
            <BellOff className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Notifications are blocked</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-mute">
              This was turned off for the site, and only you can turn it back on
              — browsers don&apos;t let us ask twice. It&apos;s under the padlock
              in the address bar, or Site Settings on mobile.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  /* --- Normal ---------------------------------------------------------- */
  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            subscribed ? "bg-success/15 text-success" : "bg-violet/15 text-violet-soft",
          )}
        >
          {subscribed ? <Check className="size-4.5" strokeWidth={2.5} /> : <Bell className="size-4.5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {subscribed ? "Nudges are on" : "A quiet nudge, when it helps"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            {subscribed
              ? "At most one a day, in your check-in window, never during your quiet hours."
              : "One reminder a day at most, timed to the rhythm you chose — and nothing at all during your quiet hours. No streak-guilt, no marketing."}
          </p>

          {!signedIn && (
            <p className="mt-2 text-2xs text-ink-faint">
              You&apos;ll need to be signed in — reminders are sent from the server.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {subscribed ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === "test"}
                  onClick={async () => {
                    setBusy("test");
                    const response = await fetch("/api/push/test", { method: "POST" });
                    const result = await response.json().catch(() => ({}));
                    setBusy(null);
                    say(
                      result.ok ? "Sent — it should arrive in a moment." : (result.message ?? "Couldn't send."),
                      result.ok ? "info" : "error",
                    );
                  }}
                >
                  <Send className="size-3.5" />
                  Send a test
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === "disable"}
                  onClick={async () => {
                    setBusy("disable");
                    await disablePush();
                    setSubscribed(false);
                    setBusy(null);
                    say("Turned off. Nothing more will arrive.");
                  }}
                >
                  Turn off
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={!signedIn}
                loading={busy === "enable"}
                onClick={async () => {
                  setBusy("enable");
                  const result = await enablePush();
                  setBusy(null);
                  if (result.ok) {
                    setSubscribed(true);
                    say("Done. Try a test to see how it looks.");
                  } else {
                    setSupport(detectSupport());
                    say(result.message ?? "Couldn't turn them on.", "error");
                  }
                }}
              >
                <Bell className="size-3.5" />
                Turn on notifications
              </Button>
            )}
          </div>

          {message && (
            <p className={cn("mt-2.5 text-2xs", tone === "error" ? "text-danger" : "text-success")}>
              {message}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
