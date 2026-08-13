"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useCompanion } from "@/lib/companion";
import { useGame, useHydrated } from "@/lib/store";
import { cn } from "@/lib/cn";
import { MascotAvatar } from "./mascot-avatar";
import { Celebration } from "./celebration";

const AUTO_HIDE_MS = 7000;
const GREET_DELAY_MS = 1200;
const PULSE_MS = 2000;
const MOOD_MS = 3200;
const XP_FLASH_MS = 1600;

/**
 * Lumen, the persistent companion.
 *
 * All of this component's state arrives from the companion store, pushed by
 * whatever caused it (a completed quest, a tap). Nothing here derives a
 * message from game state during render, which is what keeps the cooldown
 * bookkeeping from feeding back into message selection.
 */
export function Mascot() {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useGame((s) => s.onboardingComplete);

  const bubble = useCompanion((s) => s.bubble);
  const pulse = useCompanion((s) => s.pulse);
  const hide = useCompanion((s) => s.hide);
  const speakUp = useCompanion((s) => s.speakUp);
  const sayStatus = useCompanion((s) => s.sayStatus);
  const clearPulse = useCompanion((s) => s.clearPulse);

  const [tapMood, setTapMood] = useState<"curious" | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --- Greet shortly after arriving --------------------------------- */
  useEffect(() => {
    if (!hydrated || !onboarded) return;
    // A short beat so it feels like the companion noticed you, not like a modal.
    const timer = setTimeout(() => speakUp(), GREET_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hydrated, onboarded, speakUp]);

  /* --- Auto-hide whatever is currently being said -------------------- */
  useEffect(() => {
    if (!bubble) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, AUTO_HIDE_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [bubble, hide]);

  /* --- Let a celebration play out, then reset ------------------------ */
  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(clearPulse, MOOD_MS);
    return () => clearTimeout(timer);
  }, [pulse, clearPulse]);

  /* --- Tap feedback --------------------------------------------------- */
  useEffect(() => {
    if (!tapMood) return;
    const timer = setTimeout(() => setTapMood(null), 1800);
    return () => clearTimeout(timer);
  }, [tapMood]);

  const handleTap = () => {
    if (bubble) {
      hide();
      return;
    }
    setTapMood("curious");
    if (!speakUp()) {
      // Everything's on cooldown — a quiet companion is the intended default,
      // but a direct tap always deserves an answer.
      sayStatus();
    }
  };

  const runAction = () => {
    const action = bubble?.action;
    hide();
    if (!action) return;
    switch (action.kind) {
      case "open-today":
        router.push("/dashboard");
        break;
      case "open-domain":
        if (action.payload) router.push(`/domains/${action.payload}`);
        break;
      case "open-journey":
        router.push("/journey");
        break;
      case "log-quest":
        router.push(`/dashboard?focus=${action.payload ?? ""}`);
        break;
      case "dismiss":
        break;
    }
  };

  if (!hydrated || !onboarded) return null;

  const mood = tapMood ?? pulse?.mood ?? "idle";
  const showXp = pulse != null && pulse.xp > 0;

  return (
    <>
      <AnimatePresence>
        {pulse && (
          <Celebration key={pulse.id} intensity={pulse.intensity} duration={PULSE_MS} />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed right-4 bottom-[calc(var(--nav-h)+var(--safe-bottom)+0.75rem)] z-50 flex flex-col items-end gap-2.5 md:bottom-6">
        {/* Speech bubble */}
        <AnimatePresence>
          {bubble && (
            <motion.div
              key={bubble.id}
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className="panel pointer-events-auto relative max-w-[17rem] rounded-2xl rounded-br-md p-3.5 sm:max-w-xs"
            >
              <button
                type="button"
                onClick={hide}
                aria-label="Dismiss"
                className="tappable absolute -top-4 -left-4 grid size-11 place-items-center rounded-full text-ink-faint"
              >
                <span className="grid size-6 place-items-center rounded-full border border-edge bg-surface-2">
                  <X className="size-3" strokeWidth={2.5} />
                </span>
              </button>

              <p className="text-sm leading-relaxed text-ink text-pretty">{bubble.text}</p>

              {bubble.action && (
                <button
                  type="button"
                  onClick={runAction}
                  className="tappable mt-2.5 min-h-11 w-full rounded-xl bg-violet/18 px-3 py-2 text-xs font-semibold text-violet-soft transition-colors hover:bg-violet/28"
                >
                  {bubble.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* The companion */}
        <div className="relative">
          <AnimatePresence>
            {showXp && (
              <motion.span
                key={pulse.id}
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: [0, 1, 1, 0], y: -34, scale: 1 }}
                transition={{ duration: XP_FLASH_MS / 1000, times: [0, 0.15, 0.7, 1] }}
                className="pointer-events-none absolute -top-2 right-14 font-display text-lg font-extrabold whitespace-nowrap text-gold-ink"
                style={{ textShadow: "0 0 18px var(--color-gold)" }}
              >
                +{pulse.xp} XP
              </motion.span>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={handleTap}
            aria-label={bubble ? "Dismiss companion message" : "Ask your companion"}
            className={cn(
              "tappable pointer-events-auto grid size-14 place-items-center rounded-full",
              "border border-cyan/30 bg-surface/80 backdrop-blur-md",
              "shadow-[0_10px_35px_-12px_var(--color-cyan)]",
            )}
          >
            <MascotAvatar mood={mood} size={40} />
          </button>
        </div>
      </div>

      {/* Screen-reader mirror of whatever the companion is saying. */}
      <p className="sr-only" aria-live="polite">
        {bubble?.text ?? ""}
      </p>
    </>
  );
}
