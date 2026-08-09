"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useGame, useHydrated } from "@/lib/store";
import { buttonClasses } from "@/components/ui/button";

/**
 * The hero call to action.
 *
 * Reads local state so a returning player is offered "continue" rather than
 * being invited to start over — the single most annoying thing a landing page
 * can do to someone who already uses the product.
 */
export function LandingCta() {
  const hydrated = useHydrated();
  const complete = useGame((s) => s.onboardingComplete);
  const name = useGame((s) => s.profile?.displayName);

  const returning = hydrated && complete;
  const first = name?.split(" ")[0];

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
    </div>
  );
}
