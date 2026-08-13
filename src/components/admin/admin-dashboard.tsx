"use client";

import { startTransition, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Gift,
  Loader2,
  LogOut,
  Search,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { evaluateAccess, type AccessState } from "@/lib/billing/access";
import {
  adminSignOut,
  extendTrial,
  setFreeAccess,
  type AdminMutationResult,
} from "@/lib/admin/actions";
import type { AdminUserOverviewRow } from "@/lib/supabase/types";
import { prettyDay } from "@/lib/date";
import { useNowMs } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { BroadcastPanel } from "@/components/admin/broadcast-panel";

interface ActionNotice {
  tone: "success" | "error";
  message: string;
}

interface AccessDisplay {
  label: string;
  tone: string;
}

type AccessFilter = "all" | "trial" | "paid" | "free" | "attention";
type OnboardingFilter = "all" | "complete" | "incomplete";
type ActivityFilter = "all" | "recent" | "quiet" | "never";

const ADMIN_DATE_FORMAT = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatAdminDate(value: string | null, fallback = "Not set"): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : ADMIN_DATE_FORMAT.format(date);
}

function formatPlan(plan: string | null): string {
  if (!plan) return "No paid plan";
  return plan
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function accessFilterFor(
  user: AdminUserOverviewRow,
  access: AccessState,
): Exclude<AccessFilter, "all"> {
  if (
    user.role === "admin" ||
    user.role === "staff" ||
    user.bypass_billing ||
    user.status === "comped"
  ) {
    return "free";
  }
  if (access.reason === "subscribed") return "paid";
  if (access.reason === "trialing" || access.reason === "trial-ending") return "trial";
  return "attention";
}

function activityFilterFor(
  lastActiveDay: string | null,
  nowMs: number,
): Exclude<ActivityFilter, "all"> {
  if (!lastActiveDay) return "never";
  const lastActiveMs = new Date(lastActiveDay).getTime();
  if (Number.isNaN(lastActiveMs) || nowMs === 0) return "quiet";
  return nowMs - lastActiveMs <= 7 * 86_400_000 ? "recent" : "quiet";
}

/** The overview row carries everything `evaluateAccess` needs. */
function accessFor(user: AdminUserOverviewRow, nowMs: number): AccessState {
  return evaluateAccess(
    {
      id: user.id,
      email: user.email,
      trial_started_at: user.trial_started_at,
      trial_days: user.trial_days,
      status: user.status,
      plan: user.plan,
      past_due_since: user.past_due_since,
      role: user.role,
      bypass_billing: user.bypass_billing,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: user.current_period_end,
      documents_sent_at: null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    nowMs,
  );
}

function accessDisplay(user: AdminUserOverviewRow, access: AccessState): AccessDisplay {
  if (user.role === "admin" || user.role === "staff") {
    return {
      label: `${user.role === "admin" ? "Admin" : "Staff"} access`,
      tone: "bg-violet/15 text-violet-soft",
    };
  }

  if (user.bypass_billing || user.status === "comped") {
    return { label: "Free access", tone: "bg-gold/15 text-gold-ink" };
  }

  switch (access.reason) {
    case "subscribed":
      return { label: "Paid", tone: "bg-success/15 text-success" };
    case "trialing":
    case "trial-ending":
      return {
        label: `Trial · ${access.daysLeft ?? 0} ${access.daysLeft === 1 ? "day" : "days"} left`,
        tone: "bg-cyan/15 text-cyan-ink",
      };
    case "payment-failed":
      return {
        label: `Payment issue · ${access.daysLeft ?? 0} ${access.daysLeft === 1 ? "day" : "days"} grace`,
        tone: "bg-warn/15 text-warn",
      };
    case "trial-expired":
      return { label: "Trial ended", tone: "bg-danger/15 text-danger" };
    case "payment-failed-final":
      return { label: "Locked · payment issue", tone: "bg-danger/15 text-danger" };
    case "cancelled":
      return { label: "Subscription ended", tone: "bg-danger/15 text-danger" };
    default:
      return access.level === "locked"
        ? { label: "Locked", tone: "bg-danger/15 text-danger" }
        : { label: "Access available", tone: "bg-success/15 text-success" };
  }
}

export function AdminDashboard({
  users,
  dbError,
}: {
  users: AdminUserOverviewRow[];
  dbError: string | null;
}) {
  const [query, setQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [onboardingFilter, setOnboardingFilter] =
    useState<OnboardingFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [notices, setNotices] = useState<Record<string, ActionNotice>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copyNotices, setCopyNotices] = useState<Record<string, string>>({});
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const nowMs = useNowMs();

  const rows = useMemo(
    () =>
      users.map((user) => ({
        user,
        access: accessFor(user, nowMs || Date.parse(user.created_at)),
      })),
    [users, nowMs],
  );

  const stats = useMemo(() => {
    const locked = nowMs === 0 ? null : rows.filter((row) => row.access.level === "locked").length;
    const checkedInWeek =
      nowMs === 0
        ? null
        : rows.filter((row) => {
            if (!row.user.last_active_day) return false;
            const days =
              (nowMs - new Date(row.user.last_active_day).getTime()) / 86_400_000;
            return days <= 7;
          }).length;

    return {
      total: rows.length,
      trials: rows.filter(
        (row) => row.access.reason === "trialing" || row.access.reason === "trial-ending",
      ).length,
      paid: rows.filter((row) => row.access.reason === "subscribed").length,
      free: rows.filter((row) => row.access.reason === "comped").length,
      locked,
      checkedInWeek,
    };
  }, [rows, nowMs]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter(({ user, access }) => {
      const matchesSearch =
        !normalized ||
        user.email?.toLowerCase().includes(normalized) ||
        user.display_name?.toLowerCase().includes(normalized) ||
        user.id.toLowerCase().includes(normalized);
      const matchesAccess =
        accessFilter === "all" || accessFilterFor(user, access) === accessFilter;
      const matchesOnboarding =
        onboardingFilter === "all" ||
        (onboardingFilter === "complete"
          ? user.onboarding_complete === true
          : user.onboarding_complete !== true);
      const matchesActivity =
        activityFilter === "all" ||
        activityFilterFor(user.last_active_day, nowMs) === activityFilter;

      return matchesSearch && matchesAccess && matchesOnboarding && matchesActivity;
    });
  }, [rows, query, accessFilter, onboardingFilter, activityFilter, nowMs]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    accessFilter !== "all" ||
    onboardingFilter !== "all" ||
    activityFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setAccessFilter("all");
    setOnboardingFilter("all");
    setActivityFilter("all");
  };

  const copyAccountField = async (
    userId: string,
    field: "email" | "id",
    value: string,
  ) => {
    const fieldName = field === "email" ? "Email" : "Account ID";

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Clipboard unavailable");
      }

      setCopiedField(`${userId}:${field}`);
      setCopyNotices((current) => ({
        ...current,
        [userId]: `${fieldName} copied.`,
      }));
    } catch {
      setCopiedField(null);
      setCopyNotices((current) => ({
        ...current,
        [userId]: `Could not copy ${fieldName.toLowerCase()} automatically. Select the value to copy it.`,
      }));
    }
  };

  const runAction = (
    userId: string,
    actionName: "free-access" | "extend-trial",
    action: () => Promise<AdminMutationResult>,
  ) => {
    const key = `${userId}:${actionName}`;
    setPendingActions((current) => ({ ...current, [key]: true }));
    setNotices((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });

    startTransition(async () => {
      try {
        const result = await action();
        setNotices((current) => ({
          ...current,
          [userId]: result.ok
            ? { tone: "success", message: result.message }
            : { tone: "error", message: result.error },
        }));
        if (result.ok) setConfirmingRemoval(null);
      } catch {
        setNotices((current) => ({
          ...current,
          [userId]: {
            tone: "error",
            message: "That change could not be completed. Please try again.",
          },
        }));
      } finally {
        setPendingActions((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    });
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pt-[calc(2rem+var(--safe-top))] pb-8">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin dashboard</h1>
          <p className="mt-1 text-sm text-ink-mute">
            Manage account access and support your players.
          </p>
        </div>
        <form action={adminSignOut}>
          <Button type="submit" variant="ghost">
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </form>
      </header>

      {dbError ? (
        <Panel className="border-danger/35 bg-danger/8 p-5" role="alert">
          <p className="text-sm font-semibold text-danger">Account management is unavailable</p>
          <p className="mt-1 text-sm text-ink-dim">{dbError}</p>
          <p className="mt-2 text-xs text-ink-mute">Refresh after the database is available again.</p>
        </Panel>
      ) : (
        <>
          <div className="mb-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total" value={stats.total} />
            <Stat label="On trial" value={stats.trials} tone="text-cyan-ink" />
            <Stat label="Paid" value={stats.paid} tone="text-success" />
            <Stat label="Free access" value={stats.free} tone="text-gold-ink" />
            <Stat label="Locked" value={stats.locked} tone="text-danger" />
            <Stat label="Checked in · 7d" value={stats.checkedInWeek} tone="text-gold-ink" />
          </div>

          <section aria-labelledby="accounts-heading">
            <div className="mb-4">
              <h2 id="accounts-heading" className="font-display text-lg font-bold">
                Accounts
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-mute">
                Free access bypasses the paywall indefinitely. It does not cancel or change
                Stripe billing.
              </p>
              {users.length === 500 && (
                <p className="mt-3 max-w-2xl rounded-xl border border-warn/25 bg-warn/8 px-3.5 py-2.5 text-xs leading-relaxed text-ink-dim">
                  Showing the 500 newest accounts. Search and filters apply to this set.
                </p>
              )}
            </div>

            <label
              htmlFor="admin-account-search"
              className="mb-1.5 block text-xs font-semibold text-ink-mute"
            >
              Search accounts
            </label>
            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-edge bg-surface px-3.5 focus-within:border-violet focus-within:ring-2 focus-within:ring-violet/25">
              <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
              <input
                id="admin-account-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, or account ID"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-ink-faint"
              />
            </div>

            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <label htmlFor="admin-access-filter" className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-mute">
                  Effective access
                </span>
                <select
                  id="admin-access-filter"
                  value={accessFilter}
                  onChange={(event) => setAccessFilter(event.target.value as AccessFilter)}
                  className="min-h-11 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:border-violet focus-visible:ring-2 focus-visible:ring-violet/25"
                >
                  <option value="all">All access</option>
                  <option value="trial">Trial</option>
                  <option value="paid">Paid</option>
                  <option value="free">Free or team</option>
                  <option value="attention">Needs attention</option>
                </select>
              </label>

              <label htmlFor="admin-onboarding-filter" className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-mute">
                  Onboarding
                </span>
                <select
                  id="admin-onboarding-filter"
                  value={onboardingFilter}
                  onChange={(event) =>
                    setOnboardingFilter(event.target.value as OnboardingFilter)
                  }
                  className="min-h-11 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:border-violet focus-visible:ring-2 focus-visible:ring-violet/25"
                >
                  <option value="all">All onboarding</option>
                  <option value="complete">Complete</option>
                  <option value="incomplete">Incomplete or not recorded</option>
                </select>
              </label>

              <label htmlFor="admin-activity-filter" className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-mute">
                  Activity
                </span>
                <select
                  id="admin-activity-filter"
                  value={activityFilter}
                  onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
                  className="min-h-11 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:border-violet focus-visible:ring-2 focus-visible:ring-violet/25"
                >
                  <option value="all">All activity</option>
                  <option value="recent">Checked in within 7 days</option>
                  <option value="quiet">Last check-in over 7 days ago</option>
                  <option value="never">Never checked in</option>
                </select>
              </label>
            </div>

            <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
              <p role="status" aria-live="polite" className="text-xs text-ink-mute">
                Showing {filtered.length} of {rows.length} accounts
              </p>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {filtered.length === 0 && (
                <Panel className="p-6 text-center">
                  <p className="text-sm text-ink-mute">
                    {rows.length === 0 ? "No accounts yet." : "No accounts match those filters."}
                  </p>
                </Panel>
              )}

              {filtered.map(({ user, access }) => {
                const display = accessDisplay(user, access);
                const notice = notices[user.id];
                const freeAccessPending = !!pendingActions[`${user.id}:free-access`];
                const trialPending = !!pendingActions[`${user.id}:extend-trial`];
                const rowPending = freeAccessPending || trialPending;
                const hasFreeAccess = user.bypass_billing || user.status === "comped";
                const legacyFreeAccess = user.status === "comped";
                const canManageFreeAccess = user.role === "player";
                const canExtendTrial =
                  user.role === "player" &&
                  user.status === "trialing" &&
                  !user.bypass_billing;
                const userEmail = user.email;
                const onboardingLabel =
                  user.onboarding_complete === true
                    ? "Complete"
                    : user.onboarding_complete === false
                      ? "Incomplete"
                      : "Not recorded";

                return (
                  <Panel key={user.id} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold">
                            {user.display_name || "Unnamed player"}
                          </p>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-semibold",
                              display.tone,
                            )}
                          >
                            {display.label}
                          </span>
                          {user.role !== "player" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet/15 px-2.5 py-1 text-xs font-semibold text-violet-soft">
                              <ShieldCheck className="size-3.5" aria-hidden />
                              {user.role === "admin" ? "Admin role" : "Staff role"}
                            </span>
                          )}
                          {user.onboarding_complete === false && (
                            <span className="rounded-full bg-warn/12 px-2.5 py-1 text-xs font-semibold text-warn">
                              Onboarding incomplete
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-ink-mute">
                          {user.email ?? "No email address"}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                          {user.quest_count} {user.quest_count === 1 ? "quest" : "quests"} ·{" "}
                          {user.log_count} {user.log_count === 1 ? "check-in" : "check-ins"} ·{" "}
                          {user.last_active_day
                            ? `last check-in ${prettyDay(user.last_active_day)}`
                            : "no check-ins yet"}
                        </p>
                      </div>

                      {(canManageFreeAccess || canExtendTrial) && (
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-52">
                          {canManageFreeAccess && (
                            <Button
                              type="button"
                              variant={hasFreeAccess ? "danger" : "secondary"}
                              loading={freeAccessPending}
                              disabled={rowPending || confirmingRemoval === user.id}
                              onClick={() => {
                                if (hasFreeAccess) {
                                  setConfirmingRemoval(user.id);
                                  return;
                                }
                                runAction(user.id, "free-access", () =>
                                  setFreeAccess(user.id, true),
                                );
                              }}
                            >
                              <Gift className="size-4" aria-hidden />
                              {hasFreeAccess ? "Remove free access" : "Grant free access"}
                            </Button>
                          )}
                          {canExtendTrial && (
                            <Button
                              type="button"
                              variant="secondary"
                              loading={trialPending}
                              disabled={rowPending}
                              onClick={() =>
                                runAction(user.id, "extend-trial", () => extendTrial(user.id))
                              }
                            >
                              <Timer className="size-4" aria-hidden />
                              Extend trial 14 days
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {confirmingRemoval === user.id && (
                      <div className="mt-4 rounded-2xl border border-danger/35 bg-danger/8 p-4">
                        <p className="text-sm font-semibold text-danger">Remove free access?</p>
                        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
                          {legacyFreeAccess
                            ? "This older free-access account will return to its stored trial if it is still open. Otherwise it will be marked expired and locked. Stripe billing will not change."
                            : "The account will immediately fall back to its billing or trial status and may become locked. Stripe billing will not change."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="danger"
                            loading={freeAccessPending}
                            onClick={() =>
                              runAction(user.id, "free-access", () =>
                                setFreeAccess(user.id, false),
                              )
                            }
                          >
                            Remove free access
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={freeAccessPending}
                            onClick={() => setConfirmingRemoval(null)}
                          >
                            Keep free access
                          </Button>
                        </div>
                      </div>
                    )}

                    {notice && (
                      <p
                        role={notice.tone === "error" ? "alert" : "status"}
                        aria-live="polite"
                        className={cn(
                          "mt-4 rounded-xl px-3.5 py-2.5 text-sm",
                          notice.tone === "error"
                            ? "bg-danger/12 text-danger"
                            : "bg-success/12 text-success",
                        )}
                      >
                        {notice.message}
                      </p>
                    )}

                    <details className="group mt-4 border-t border-hairline/70 pt-2">
                      <summary className="tappable flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 text-sm font-semibold text-ink-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-soft [&::-webkit-details-marker]:hidden">
                        <span>Manage account</span>
                        <ChevronDown
                          className="size-4 shrink-0 text-ink-mute transition-transform group-open:rotate-180"
                          aria-hidden
                        />
                      </summary>

                      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                        <DetailItem
                          label="Created"
                          value={formatAdminDate(user.created_at, "Not available")}
                        />
                        <DetailItem label="Onboarding" value={onboardingLabel} />
                        <DetailItem label="Plan" value={formatPlan(user.plan)} />
                        <DetailItem
                          label="Current period ends"
                          value={formatAdminDate(user.current_period_end)}
                        />
                        <CopyDetail
                          label="Email"
                          value={userEmail ?? "No email address"}
                          copied={copiedField === `${user.id}:email`}
                          onCopy={
                            userEmail
                              ? () => void copyAccountField(user.id, "email", userEmail)
                              : undefined
                          }
                        />
                        <CopyDetail
                          label="Account ID"
                          value={user.id}
                          copied={copiedField === `${user.id}:id`}
                          onCopy={() => void copyAccountField(user.id, "id", user.id)}
                        />
                      </dl>

                      {copyNotices[user.id] && (
                        <p
                          role="status"
                          aria-live="polite"
                          className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs text-ink-dim"
                        >
                          {copyNotices[user.id]}
                        </p>
                      )}
                    </details>
                  </Panel>
                );
              })}
            </div>
          </section>

          <details className="group mt-8">
            <summary className="panel tappable flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-3xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-soft [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-sm font-semibold">Broadcast notifications</p>
                <p className="mt-0.5 text-xs text-ink-mute">
                  Compose and confirm a push notification to an audience.
                </p>
              </div>
              <ChevronDown
                className="size-5 shrink-0 text-ink-mute transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="mt-3">
              <BroadcastPanel />
            </div>
          </details>

          <p className="mt-8 text-center text-xs text-ink-faint">
            Reminders send hourly in each player&apos;s timezone.
          </p>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone?: string;
}) {
  return (
    <Panel className="p-3.5 text-center">
      <p className={cn("font-display text-xl font-extrabold tabular-nums", tone)}>
        {value ?? <Loader2 className="mx-auto size-4 animate-spin" aria-label="Loading" />}
      </p>
      <p className="mt-0.5 text-xs text-ink-faint">{label}</p>
    </Panel>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3.5">
      <dt className="text-xs font-semibold text-ink-faint">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

function CopyDetail({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3.5 sm:col-span-2">
      <dt className="text-xs font-semibold text-ink-faint">{label}</dt>
      <dd className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 select-text break-all text-sm text-ink">{value}</span>
        {onCopy && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0 self-start sm:self-auto"
            aria-label={copied ? `${label} copied` : `Copy ${label}`}
            onClick={onCopy}
          >
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </dd>
    </div>
  );
}
