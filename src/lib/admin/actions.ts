"use server";

import { revalidatePath } from "next/cache";
import {
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
  verifyPassword,
} from "./session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AccountRole, AccountStatus } from "@/lib/supabase/types";

const ADMIN_PATH = "/command-deck";

export interface AdminActionState {
  error?: string;
  ok?: boolean;
}

/**
 * Every mutating action re-checks the session itself.
 *
 * Server actions are ordinary POST endpoints with a stable id — a page-level
 * check protects the render, not the action. Anything that writes has to
 * authenticate on its own.
 */
async function requireAdmin(): Promise<boolean> {
  return isAdminAuthenticated();
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

export async function setAccountStatus(
  userId: string,
  status: AccountStatus,
): Promise<void> {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  await admin
    .from("accounts")
    .update({
      status,
      // Clearing the dunning stamp matters: leaving it set would restart a
      // grace period the moment the account went past_due again.
      past_due_since: status === "past_due" ? new Date().toISOString() : null,
    })
    .eq("id", userId);

  revalidatePath(ADMIN_PATH);
}

export async function setAccountRole(
  userId: string,
  role: AccountRole,
): Promise<void> {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("accounts").update({ role }).eq("id", userId);
  revalidatePath(ADMIN_PATH);
}

export async function toggleBypassBilling(
  userId: string,
  bypass: boolean,
): Promise<void> {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("accounts").update({ bypass_billing: bypass }).eq("id", userId);
  revalidatePath(ADMIN_PATH);
}

export async function extendTrial(userId: string, extraDays: number): Promise<void> {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { data } = await admin
    .from("accounts")
    .select("trial_days")
    .eq("id", userId)
    .maybeSingle();

  const current = data?.trial_days ?? 16;
  await admin
    .from("accounts")
    .update({
      trial_days: Math.max(0, current + extraDays),
      // An extension is meaningless if the account is already marked expired.
      status: "trialing",
    })
    .eq("id", userId);

  revalidatePath(ADMIN_PATH);
}
