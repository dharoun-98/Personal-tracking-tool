"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame, useHydrated } from "@/lib/store";
import { BottomNav, SideRail } from "@/components/shell/app-nav";
import { BootSplash } from "@/components/shell/boot-splash";
import { Mascot } from "@/components/mascot/mascot";

/**
 * Shell for every in-game screen.
 *
 * Navigation is duplicated rather than adaptive: a bottom tab bar on phones
 * (thumb reach, standard app grammar) and a left rail on laptops (no wasted
 * vertical space). One component trying to be both ends up good at neither.
 */
export default function GameLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useGame((s) => s.onboardingComplete);

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/onboarding");
  }, [hydrated, onboarded, router]);

  if (!hydrated) return <BootSplash />;
  if (!onboarded) return <BootSplash label="Setting things up…" />;

  return (
    <div className="md:pl-60">
      <SideRail />
      <div className="mx-auto w-full max-w-2xl px-5 pb-[calc(var(--nav-h)+var(--safe-bottom)+2rem)] pad-safe-top md:pb-14">
        {children}
      </div>
      <BottomNav />
      <Mascot />
    </div>
  );
}
