import type { AccountState } from "@/lib/store";
import type { AccountRow } from "@/lib/supabase/types";

/**
 * Adapts the on-device account snapshot to the shape `evaluateAccess` expects.
 *
 * Used when nobody is signed in, so the trial still counts down for local-only
 * players rather than running forever. This is client-side and therefore not
 * authoritative — clearing site data resets it. That's inherent to any trial on
 * a device that works offline; the server-backed check takes over the moment
 * someone signs in, which is where the money actually is.
 */
export function localAccountRow(account: AccountState): AccountRow | null {
  if (!account.trialStartedAt) return null;

  return {
    id: "local",
    email: account.email ?? null,
    trial_started_at: account.trialStartedAt,
    trial_days: account.trialDays,
    status: account.status,
    plan: account.plan ?? null,
    past_due_since: null,
    role: "player",
    bypass_billing: account.bypassBilling ?? false,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null,
    documents_sent_at: null,
    created_at: account.trialStartedAt,
    updated_at: account.trialStartedAt,
  };
}
