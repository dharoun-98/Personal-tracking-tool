import type { MotivationStyle } from "@/lib/types";

/* ==================================================================== *
 * Reminder copy.
 *
 * Separate from the in-app coach because a notification is a different act.
 * The companion speaks when you have already opened the app; this interrupts
 * you. That earns a much higher bar: it must be short, it must be useful, and
 * it must never manufacture urgency about a habit tracker.
 *
 * Rules encoded here:
 *   - Nothing at all if the board is already clear. Congratulating someone via
 *     a push notification for finishing is just buzzing them for no reason.
 *   - Never mention a streak being "at risk". That is the mechanic every
 *     habit app abuses and the one this product promised not to.
 *   - Under ~60 characters for the body, because Android truncates and a
 *     half-sentence reads worse than a short one.
 * ==================================================================== */

export interface ReminderInput {
  style: MotivationStyle;
  remaining: number;
  window: "morning" | "evening";
  firstName: string;
}

export interface ReminderCopy {
  title: string;
  body: string;
}

/** Deterministic pick, so the same day doesn't produce different wording. */
function pick<T>(options: T[], seed: string): T {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return options[Math.abs(hash) % options.length];
}

const MORNING: Record<MotivationStyle, string[]> = {
  cheerleader: ["Fresh day, blank board.", "Morning! Ready when you are.", "New day, new orbs to light."],
  coach: ["Board's set for today.", "Today's list is ready.", "Right — today."],
  sage: ["A new day, unhurried.", "Today is open.", "Whenever you're ready."],
  rival: ["Yesterday's you is watching.", "New day. Beat it.", "Think you can top yesterday?"],
};

const EVENING: Record<MotivationStyle, string[]> = {
  cheerleader: ["Anything left you fancy?", "Evening! One more?", "Still time for a small win."],
  coach: ["Anything left on the board?", "Quick check before the day's out.", "Still time."],
  sage: ["A quiet moment, if you'd like one.", "The day isn't finished yet.", "No rush, just checking."],
  rival: ["Finishing, or calling it?", "One left in you?", "Going to leave it there?"],
};

/**
 * Builds the notification, or returns null when we should stay silent.
 *
 * Returning null is the common case in the evening and that is intentional —
 * the best notification is very often none.
 */
export function buildReminder(input: ReminderInput): ReminderCopy | null {
  // Board already clear. Say nothing.
  if (input.remaining <= 0) return null;

  const seed = `${input.window}-${input.style}-${new Date().toISOString().slice(0, 10)}`;
  const title = pick(input.window === "morning" ? MORNING[input.style] : EVENING[input.style], seed);

  const body =
    input.remaining === 1
      ? "One thing left on your board."
      : `${input.remaining} things on your board today.`;

  return { title, body };
}
