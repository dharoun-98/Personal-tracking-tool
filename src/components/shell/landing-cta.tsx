"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useGame, useHydrated } from "@/lib/store";
import { isCloudEnabled } from "@/lib/supabase/config";
import { buttonClasses } from "@/components/ui/button-styles";

/**
 * The hero call to action.
 *
 * Reads local state so a returning player is offered "continue" rather than
 * being invited to start over — the single most annoying thing a landing page
 * can do to someone who already uses the product.
 *
 * The sign-in link matters just as much and is easy to forget: somebody
 * opening this on a new phone has an empty device but a full account, and
 * without a way in from here their only route is to fake an onboarding they
 * have already done.
 */
export function LandingCta() {
  const hydrated = useHydrated();
  const complete = useGame((s) => s.onboardingComplete);
  const name = useGame((s) => s.profile?.displayName);

  const returning = hydrated && complete;
  const first = name?.split(" ")[0];
  const cloud = isCloudEnabled();

  return (
    <div className="flex flex-col items-center gap-3">
      <Link
        href={returning ? "/dashboard" : "/onboarding"}
        className={buttonClasses({ variant: "gold", size: "xl" })}
      >
        {returning ? `Continue${first ? `, ${first}` : ""}` : "Start your game"}
        <ArrowRight className="size-5" />
      </Link>

      {!returning && (
        <p className="text-2xs text-ink-faint">
          16 days free · no card required · about 3 minutes to set up
        </p>
      )}

      {cloud && !returning && (
        <p className="mt-1 text-xs text-ink-mute">
          Already playing?{" "}
          <Link
            href="/auth/sign-in"
            className="font-semibold text-violet-soft underline underline-offset-2"
          >
            Sign in
          </Link>{" "}
          and your world comes with you.
        </p>
      )}
    </div>
  );
}
