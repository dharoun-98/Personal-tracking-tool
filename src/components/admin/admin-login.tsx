"use client";

import { useActionState } from "react";
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
            <KeyRound className="size-5" />
          </span>
          <h1 className="font-display text-xl font-bold">Command deck</h1>
          <p className="mt-1 text-xs text-ink-mute">Staff only.</p>
        </div>

        <form action={action} className="space-y-3">
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            placeholder="Password"
            className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet"
          />
          {state.error && (
            <p className="rounded-xl bg-danger/12 px-3.5 py-2.5 text-xs text-danger">
              {state.error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth loading={pending}>
            Enter
          </Button>
        </form>
      </Panel>
    </main>
  );
}
