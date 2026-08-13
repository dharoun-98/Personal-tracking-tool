import type { AccountRow } from "@/lib/supabase/types";

/* ==================================================================== *
 * Who gets to play, and what they should be told.
 *
 * Pure and server-authoritative. The browser copy of account status is a
 * cache for rendering; this function is the decision, and it runs where the
 * player can't reach it.
 *
 * The tone rules matter as much as the logic: nothing here nags during a
 * trial that's going fine, the first payment failure gets a week of quiet
 * grace rather than an instant lockout, and the lock screen is an invitation
 * rather than a punishment.
 * ==================================================================== */

/** How long a failed payment is tolerated before the app locks. */
export const DUNNING_GRACE_DAYS = 7;

/** Start mentioning the trial only inside this many days of the end. */
export const TRIAL_NUDGE_WINDOW_DAYS = 5;

export type AccessLevel =
  /** Full access, say nothing. */
  | "open"
  /** Full access, but surface a gentle, dismissible notice. */
  | "notice"
  /** Full access, surface a notice that can't be dismissed for the session. */
  | "warning"
  /** No access. The paywall replaces the app. */
  | "locked";

export type AccessReason =
  | "trialing"
  | "trial-ending"
  | "trial-expired"
  | "subscribed"
  | "comped"
  | "staff"
  | "payment-failed"
  | "payment-failed-final"
  | "cancelled"
  | "unknown";

export interface AccessState {
  level: AccessLevel;
  reason: AccessReason;
  /** Whole days remaining, floored at 0. Null when it doesn't apply. */
  daysLeft: number | null;
  /** Short line for banners. Empty when level is "open". */
  message: string;
  /** True when the player has never had a paid subscription. */
  isTrial: boolean;
}

function daysBetween(fromIso: string, now: number): number {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return 0;
  return (now - from) / 86_400_000;
}

/**
 * Decide access for an account.
 *
 * `now` is injected so this stays pure and testable, and so the server's clock
 * is the one that counts.
 */
export function evaluateAccess(
  account: AccountRow | null,
  now: number = Date.now(),
): AccessState {
  // No account row yet (mid-signup, or running local-only). Let them in —
  // locking someone out because a row hasn't been written is indefensible.
  if (!account) {
    return {
      level: "open",
      reason: "unknown",
      daysLeft: null,
      message: "",
      isTrial: true,
    };
  }

  // --- Unconditional passes -------------------------------------------
  if (account.role === "admin" || account.role === "staff") {
    return {
      level: "open",
      reason: "staff",
      daysLeft: null,
      message: "",
      isTrial: false,
    };
  }

  if (account.bypass_billing || account.status === "comped") {
    return {
      level: "open",
      reason: "comped",
      daysLeft: null,
      message: "",
      isTrial: false,
    };
  }

  if (account.status === "active") {
    return {
      level: "open",
      reason: "subscribed",
      daysLeft: null,
      message: "",
      isTrial: false,
    };
  }

  // --- Failed payment: grace, then lock --------------------------------
  if (account.status === "past_due") {
    const since = account.past_due_since ?? account.updated_at;
    const elapsed = daysBetween(since, now);
    const left = Math.max(0, Math.ceil(DUNNING_GRACE_DAYS - elapsed));

    if (left <= 0) {
      return {
        level: "locked",
        reason: "payment-failed-final",
        daysLeft: 0,
        message: "We couldn't take payment, and the grace period has run out.",
        isTrial: false,
      };
    }

    return {
      // The last two days get the louder treatment.
      level: left <= 2 ? "warning" : "notice",
      reason: "payment-failed",
      daysLeft: left,
      message:
        left === 1
          ? "Your payment didn't go through. One day left to update your card."
          : `Your payment didn't go through. ${left} days to update your card.`,
      isTrial: false,
    };
  }

  if (account.status === "expired") {
    return {
      level: "locked",
      reason: "cancelled",
      daysLeft: 0,
      message: "Your subscription has ended.",
      isTrial: false,
    };
  }

  // --- Trial ------------------------------------------------------------
  const elapsed = daysBetween(account.trial_started_at, now);
  const left = Math.max(0, Math.ceil(account.trial_days - elapsed));

  if (left <= 0) {
    return {
      level: "locked",
      reason: "trial-expired",
      daysLeft: 0,
      message: "Your free trial has ended.",
      isTrial: true,
    };
  }

  if (left > TRIAL_NUDGE_WINDOW_DAYS) {
    // Most of the trial: say nothing at all.
    return {
      level: "open",
      reason: "trialing",
      daysLeft: left,
      message: "",
      isTrial: true,
    };
  }

  return {
    level: left <= 2 ? "warning" : "notice",
    reason: "trial-ending",
    daysLeft: left,
    message:
      left === 1
        ? "Last day of your trial."
        : `${left} days left in your trial.`,
    isTrial: true,
  };
}

/** Whether the app should be replaced by the paywall. */
export function isLocked(state: AccessState): boolean {
  return state.level === "locked";
}
