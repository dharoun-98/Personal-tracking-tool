"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
import { useGame, useHydrated } from "@/lib/store";
import {
  resolveOnboardingEntry,
  type CloudWorldState,
} from "@/lib/onboarding-entry-state";
import { BootSplash } from "@/components/shell/boot-splash";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

/**
 * Opens setup only when the server has positively identified a new account.
 * An uncertain cloud lookup must never create a second world by accident.
 */
export function OnboardingEntry({
  cloudWorld,
}: {
  cloudWorld: CloudWorldState;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const complete = useGame((state) => state.onboardingComplete);
  const entry = resolveOnboardingEntry(cloudWorld, complete);
  const shouldOpenWorld = entry === "dashboard";

  useEffect(() => {
    if (hydrated && shouldOpenWorld) router.replace("/dashboard");
  }, [hydrated, router, shouldOpenWorld]);

  if (!hydrated) return <BootSplash />;
  if (shouldOpenWorld) return <BootSplash label="Opening your world…" />;

  if (entry === "blocked") {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center px-5 py-12 pad-safe-top">
        <Panel className="w-full p-6">
          <span className="mb-4 grid size-11 place-items-center rounded-2xl bg-warn/14 text-warn">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-xl font-bold">We couldn&apos;t check your world</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute" role="alert">
            You&apos;re signed in, but we couldn&apos;t confirm whether this account already
            has a world. We won&apos;t start another one until that check succeeds.
          </p>
          <div className="mt-5 space-y-2.5">
            <Button fullWidth onClick={() => router.refresh()}>
              <RefreshCw className="size-4" aria-hidden />
              Retry account check
            </Button>
            <form action="/auth/sign-out" method="post">
              <input type="hidden" name="next" value="/onboarding" />
              <Button type="submit" variant="ghost" fullWidth>
                <LogOut className="size-4" aria-hidden />
                Sign out and start locally
              </Button>
            </form>
          </div>
        </Panel>
      </main>
    );
  }

  return <OnboardingFlow showAccountEscape={cloudWorld === "signed-out"} />;
}
