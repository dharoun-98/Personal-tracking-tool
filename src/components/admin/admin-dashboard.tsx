"use client";

import { useMemo, useState, useTransition } from "react";
import { LogOut, Search, ShieldCheck, Timer } from "lucide-react";
import { evaluateAccess, type AccessState } from "@/lib/billing/access";
import {
  adminSignOut,
  extendTrial,
  setAccountStatus,
  toggleBypassBilling,
} from "@/lib/admin/actions";
import type { AccountStatus, AdminUserOverviewRow } from "@/lib/supabase/types";
import { prettyDay } from "@/lib/date";
import { useNowMs } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

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
      updated_at: user.created_at,
    },
    nowMs,
  );
}

const STATUS_TONE: Record<AccountStatus, string> = {
  active: "bg-success/15 text-success",
  trialing: "bg-cyan/15 text-cyan-ink",
  past_due: "bg-warn/15 text-warn",
  expired: "bg-danger/15 text-danger",
  comped: "bg-purpose/15 text-purpose-ink",
};

export function AdminDashboard({
  users,
  dbError,
}: {
  users: AdminUserOverviewRow[];
  dbError: string | null;
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const nowMs = useNowMs();

  const rows = useMemo(
    () => users.map((user) => ({ user, access: accessFor(user, nowMs || Date.parse(user.created_at)) })),
    [users, nowMs],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const by = (status: AccountStatus) =>
      rows.filter((r) => r.user.status === status).length;
    const locked = nowMs === 0 ? null : rows.filter((r) => r.access.level === "locked").length;
    // Reads 0 until the shared clock's first tick, so this shows "—" for a
    // moment rather than a number computed from a server-rendered timestamp.
    const activeWeek =
      nowMs === 0
        ? null
        : rows.filter((r) => {
            if (!r.user.last_active_day) return false;
            const days =
              (nowMs - new Date(r.user.last_active_day).getTime()) / 86_400_000;
            return days <= 7;
          }).length;
    return { total, trialing: by("trialing"), active: by("active"), locked, activeWeek };
  }, [rows, nowMs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.user.email?.toLowerCase().includes(q) ||
        r.user.display_name?.toLowerCase().includes(q) ||
        r.user.id.includes(q),
    );
  }, [rows, query]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 pad-safe-top">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Command deck</h1>
          <p className="mt-1 text-xs text-ink-mute">
            {stats.total} {stats.total === 1 ? "account" : "accounts"}
          </p>
        </div>
        <form action={adminSignOut}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </form>
      </header>

      {dbError && (
        <Panel className="mb-6 border-danger/35 bg-danger/8 p-4">
          <p className="text-sm font-semibold text-danger">Can&apos;t reach the database</p>
          <p className="mt-1 text-xs text-ink-dim">{dbError}</p>
        </Panel>
      )}

      <div className="mb-7 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Stat label="Total" value={stats.total} />
        <Stat label="On trial" value={stats.trialing} tone="text-cyan-ink" />
        <Stat label="Subscribed" value={stats.active} tone="text-success" />
        <Stat label="Locked out" value={stats.locked} tone="text-danger" />
        <Stat label="Active this week" value={stats.activeWeek} tone="text-gold-ink" />

      </div>

      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-edge bg-surface px-3.5">
        <Search className="size-4 shrink-0 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, name or id"
          className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-ink-faint"
        />
      </div>

      <div className="space-y-2.5">
        {filtered.length === 0 && (
          <Panel className="p-6 text-center">
            <p className="text-sm text-ink-mute">
              {rows.length === 0 ? "No accounts yet." : "Nothing matches that."}
            </p>
          </Panel>
        )}

        {filtered.map(({ user, access }) => (
          <Panel key={user.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {user.display_name || "Unnamed"}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-2xs font-bold",
                      STATUS_TONE[user.status],
                    )}
                  >
                    {user.status}
                  </span>
                  {user.role !== "player" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet/15 px-2 py-0.5 text-2xs font-bold text-violet-soft">
                      <ShieldCheck className="size-3" />
                      {user.role}
                    </span>
                  )}
                  {user.bypass_billing && (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-2xs font-bold text-gold-ink">
                      comped
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-2xs text-ink-mute">
                  {user.email ?? "no email"}
                </p>
                <p className="mt-1.5 text-2xs text-ink-faint">
                  {user.quest_count} quests · {user.log_count} check-ins ·{" "}
                  {user.last_active_day
                    ? `last active ${prettyDay(user.last_active_day)}`
                    : "never active"}
                  {access.daysLeft != null && ` · ${access.daysLeft}d left`}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Action
                  label={user.bypass_billing ? "Revoke comp" : "Comp"}
                  pending={pending}
                  onClick={() =>
                    startTransition(() =>
                      toggleBypassBilling(user.id, !user.bypass_billing),
                    )
                  }
                />
                <Action
                  label="+14 days"
                  icon={<Timer className="size-3" />}
                  pending={pending}
                  onClick={() => startTransition(() => extendTrial(user.id, 14))}
                />
                {user.status !== "active" && (
                  <Action
                    label="Mark active"
                    pending={pending}
                    onClick={() => startTransition(() => setAccountStatus(user.id, "active"))}
                  />
                )}
                {user.status !== "expired" && (
                  <Action
                    label="Expire"
                    tone="danger"
                    pending={pending}
                    onClick={() => startTransition(() => setAccountStatus(user.id, "expired"))}
                  />
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <p className="mt-8 text-center text-2xs text-ink-faint">
        Push notifications and broadcast messaging arrive with Stage 4.
      </p>
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
        {value ?? "—"}
      </p>
      <p className="mt-0.5 text-2xs text-ink-faint">{label}</p>
    </Panel>
  );
}

function Action({
  label,
  onClick,
  pending,
  tone,
  icon,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
  tone?: "danger";
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={cn(
        "tappable inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-2xs font-semibold transition-colors disabled:opacity-45",
        tone === "danger"
          ? "bg-danger/12 text-danger hover:bg-danger/20"
          : "bg-surface-2 text-ink-dim hover:bg-surface-3 hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
