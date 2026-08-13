"use server";

import { revalidatePath } from "next/cache";
import {
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
  verifyPassword,
} from "./session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const ADMIN_PATH = "/command-deck";
const TRIAL_EXTENSION_DAYS = 14;

export interface AdminActionState {
  error?: string;
  ok?: boolean;
}

export type AdminMutationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Every mutating action re-checks the session itself.
 *
 * Server actions are ordinary POST endpoints with a stable id — a page-level
 * check protects the render, not the action. Anything that writes has to
 * authenticate on its own.
 */
async function authenticatedAdmin() {
  if (!(await isAdminAuthenticated())) {
    return {
      ok: false as const,
      result: {
        ok: false as const,
        error: "Your admin session expired. Sign in again and retry.",
      },
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false as const,
      result: {
        ok: false as const,
        error: "Account management is not configured on this deployment.",
      },
    };
  }

  return { ok: true as const, admin };
}

export async function adminSignIn(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const password = String(formData.get("password") ?? "");

  // A uniform delay on failure blunts online password guessing without
  // pretending this is a hardened login.
  if (!verifyPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: "That's not the password." };
  }

  await createAdminSession();
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

export async function adminSignOut(): Promise<void> {
  await destroyAdminSession();
  revalidatePath(ADMIN_PATH);
}

export async function setFreeAccess(
  userId: string,
  enabled: boolean,
): Promise<AdminMutationResult> {
  if (!userId || typeof enabled !== "boolean") {
    return { ok: false, error: "That free-access request was invalid." };
  }

  const auth = await authenticatedAdmin();
  if (!auth.ok) return auth.result;

  const { data: account, error: readError } = await auth.admin
    .from("accounts")
    .select(
      "id, role, status, bypass_billing, trial_started_at, trial_days, stripe_subscription_id",
    )
    .eq("id", userId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!account) return { ok: false, error: "That account no longer exists." };
  if (account.role !== "player") {
    return { ok: false, error: "Team accounts already have access through their role." };
  }
  const hasFreeAccess = account.bypass_billing || account.status === "comped";
  if (hasFreeAccess === enabled) {
    return {
      ok: true,
      message: enabled ? "Free access is already enabled." : "Free access is already off.",
    };
  }

  let fallbackStatus: "trialing" | "expired" | null = null;
  if (!enabled && account.status === "comped") {
    if (account.stripe_subscription_id) {
      return {
        ok: false,
        error:
          "This legacy free-access account has a Stripe subscription attached. Resolve its billing status or refresh the Stripe webhook before removing access.",
      };
    }
    const trialStartedAt = new Date(account.trial_started_at).getTime();
    const trialDays = Math.max(0, Number(account.trial_days) || 0);
    if (!Number.isFinite(trialStartedAt)) {
      return {
        ok: false,
        error: "This legacy free-access account has an invalid trial start date.",
      };
    }
    fallbackStatus =
      trialStartedAt + trialDays * 86_400_000 > Date.now() ? "trialing" : "expired";
  }

  const patch = {
    bypass_billing: enabled,
    ...(fallbackStatus
      ? {
          status: fallbackStatus,
          past_due_since: null,
        }
      : {}),
  };

  const updateQuery = auth.admin
    .from("accounts")
    .update(patch)
    .eq("id", userId)
    // Protect against a stale dashboard or simultaneous change. In particular,
    // never overwrite a Stripe webhook status we did not just inspect.
    .eq("role", account.role)
    .eq("status", account.status)
    .eq("bypass_billing", account.bypass_billing);
  const guardedUpdate = fallbackStatus
    ? updateQuery
        .is("stripe_subscription_id", null)
        .eq("trial_started_at", account.trial_started_at)
        .eq("trial_days", account.trial_days)
    : updateQuery;
  const { data: updated, error: updateError } = await guardedUpdate
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) {
    return {
      ok: false,
      error: "That account changed while you were reviewing it. Refresh and try again.",
    };
  }

  revalidatePath(ADMIN_PATH);

  return {
    ok: true,
    message: enabled
      ? "Free access granted. Stripe billing was not changed."
      : fallbackStatus === "trialing"
        ? "Free access removed. The account returned to its still-open trial."
        : fallbackStatus === "expired"
          ? "Free access removed. Its stored trial has ended, so the account is now locked."
          : "Free access removed. Billing or trial status now controls access.",
  };
}

export async function extendTrial(userId: string): Promise<AdminMutationResult> {
  if (!userId) return { ok: false, error: "That trial-extension request was invalid." };

  const auth = await authenticatedAdmin();
  if (!auth.ok) return auth.result;

  const { data: account, error: readError } = await auth.admin
    .from("accounts")
    .select(
      "id, trial_started_at, trial_days, status, role, bypass_billing, stripe_subscription_id",
    )
    .eq("id", userId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!account) return { ok: false, error: "That account no longer exists." };
  if (
    account.role !== "player" ||
    account.bypass_billing ||
    account.status !== "trialing" ||
    account.stripe_subscription_id
  ) {
    return {
      ok: false,
      error: "Only player accounts that are currently using their trial can be extended.",
    };
  }

  const startedAt = new Date(account.trial_started_at).getTime();
  if (!Number.isFinite(startedAt)) {
    return { ok: false, error: "This account has an invalid trial start date." };
  }

  // Trial length is stored as whole days from the original start. Extending
  // from the later of the current end or today means an already-ended trial
  // receives a real new window instead of remaining locked after “+14 days”.
  const elapsedDays = Math.max(0, Math.ceil((Date.now() - startedAt) / 86_400_000));
  const currentDays = Math.max(0, Number(account.trial_days) || 0);
  const trialDays = Math.max(currentDays, elapsedDays) + TRIAL_EXTENSION_DAYS;

  const { data: updated, error: updateError } = await auth.admin
    .from("accounts")
    .update({ trial_days: trialDays })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) return { ok: false, error: "That trial could not be updated." };

  revalidatePath(ADMIN_PATH);
  return { ok: true, message: `Trial extended by ${TRIAL_EXTENSION_DAYS} days.` };
}
