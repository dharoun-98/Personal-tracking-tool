"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame, useHydrated } from "@/lib/store";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { BootSplash } from "@/components/shell/boot-splash";

export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const complete = useGame((s) => s.onboardingComplete);

  useEffect(() => {
    if (hydrated && complete) router.replace("/dashboard");
  }, [hydrated, complete, router]);

  if (!hydrated) return <BootSplash />;
  if (complete) return <BootSplash label="Opening your world…" />;

  return <OnboardingFlow />;
}
