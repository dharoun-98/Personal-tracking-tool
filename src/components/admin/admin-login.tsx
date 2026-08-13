"use client";

import { useActionState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { adminSignIn, type AdminActionState } from "@/lib/admin/actions";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

export function AdminLogin() {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    adminSignIn,
    {},
  );

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <Panel className="w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-violet/15 text-violet-soft">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-xl font-bold">Admin sign in</h1>
          <p className="mt-1 text-sm text-ink-mute">Use the shared admin password.</p>
        </div>

        <form action={action} className="space-y-3">
          <label htmlFor="admin-password" className="block text-sm font-semibold text-ink-dim">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            placeholder="Password"
            aria-describedby={state.error ? "admin-password-error" : undefined}
            className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet focus:ring-2 focus:ring-violet/25"
          />
          {state.error && (
            <p
              id="admin-password-error"
              role="alert"
              className="rounded-xl bg-danger/12 px-3.5 py-2.5 text-sm text-danger"
            >
              {state.error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth loading={pending}>
            Sign in
          </Button>
        </form>

        <Link
          href="/"
          className="mt-5 block rounded-lg py-2 text-center text-sm text-ink-mute hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-soft"
        >
          Back to the app
        </Link>
      </Panel>
    </main>
  );
}
