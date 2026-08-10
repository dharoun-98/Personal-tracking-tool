"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Mail, Sparkles } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authRedirectUrl } from "@/lib/supabase/config";
import { useGame } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

type Mode = "sign-in" | "sign-up";
type Method = "password" | "link";

/**
 * Sign-in and sign-up, in one component.
 *
 * The two flows differ by a single Supabase call and some copy; splitting them
 * into separate components duplicated every piece of error handling.
 *
 * An account is optional in this product — the game runs entirely on the
 * device without one. That framing is deliberate throughout the copy here:
 * signing up is for backup and for getting your documents by email, not a toll
 * gate.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const profileName = useGame((s) => s.profile?.displayName);

  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const isSignUp = mode === "sign-up";

  if (!supabase) {
    return (
      <Panel className="p-5 text-center">
        <p className="text-sm font-semibold">Accounts aren&apos;t switched on here</p>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-ink-mute">
          This deployment has no Supabase configuration, so there&apos;s nothing to
          sign in to. The game still works completely — everything lives on this
          device.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex text-xs font-semibold text-violet-soft"
        >
          Back to your board
        </Link>
      </Panel>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (method === "link") {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: authRedirectUrl(),
            shouldCreateUser: isSignUp,
            data: profileName ? { display_name: profileName } : undefined,
          },
        });
        if (error) throw error;
        setSent(true);
        return;
      }

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: authRedirectUrl(),
            data: profileName ? { display_name: profileName } : undefined,
          },
        });
        if (error) throw error;
        // With email confirmation on, there's no session yet — say so rather
        // than dumping them on a dashboard that will bounce them back.
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }

      router.push("/account?welcome=1");
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "That didn't work. Try again?";
      setError(friendlyError(message));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Panel className="p-6 text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-cyan/15 text-cyan-ink">
          <Mail className="size-5" />
        </span>
        <p className="text-sm font-semibold">Check your email</p>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-ink-mute">
          We&apos;ve sent a link to <span className="text-ink">{email.trim()}</span>.
          Open it on this device and you&apos;ll be signed straight in.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-2xs font-semibold text-violet-soft underline underline-offset-2"
        >
          Use a different address
        </button>
      </Panel>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {(["password", "link"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMethod(option);
              setError(null);
            }}
            className={cn(
              "tappable flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors",
              method === option ? "bg-surface text-ink shadow-sm" : "text-ink-mute",
            )}
          >
            {option === "password" ? "Password" : "Email me a link"}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
          Email
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet"
        />
      </div>

      {method === "password" && (
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet"
          />
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-danger/12 px-3.5 py-2.5 text-xs text-danger">{error}</p>
      )}

      <Button type="submit" size="lg" fullWidth loading={busy}>
        {isSignUp ? "Create your account" : "Sign in"}
        {!busy && <ArrowRight className="size-4" />}
      </Button>

      <p className="text-center text-2xs text-ink-faint">
        {isSignUp ? (
          <>
            Already have one?{" "}
            <Link href="/auth/sign-in" className="font-semibold text-violet-soft">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/auth/sign-up" className="font-semibold text-violet-soft">
              Create one
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

/** Supabase's messages are accurate and unfriendly. Soften the common ones. */
function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "That email and password don't match. Worth trying the email link instead?";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "There's already an account with that address — try signing in.";
  }
  if (lower.includes("password should be")) {
    return "Passwords need to be at least 8 characters.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "That's a lot of attempts in a row. Give it a minute.";
  }
  if (lower.includes("email not confirmed")) {
    return "Check your inbox first — there's a confirmation link waiting.";
  }
  return message;
}

/** Small header used above the form on both pages. */
export function AuthHeader({ mode }: { mode: Mode }) {
  return (
    <header className="mb-7 text-center">
      <div className="relative mx-auto mb-5 size-14">
        <div className="absolute inset-0 animate-pulse-glow rounded-full bg-violet/40 blur-xl" />
        <div className="relative grid size-14 place-items-center rounded-full border border-violet/40 bg-surface">
          {mode === "sign-up" ? (
            <Sparkles className="size-6 text-gold-ink" strokeWidth={1.5} />
          ) : (
            <Check className="size-6 text-gold-ink" strokeWidth={2} />
          )}
        </div>
      </div>
      <h1 className="font-display text-2xl font-bold text-balance">
        {mode === "sign-up" ? "Keep your world safe" : "Welcome back"}
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-mute text-pretty">
        {mode === "sign-up"
          ? "An account backs up your progress and gets your report and promise letter by email. The game works without one."
          : "Sign in to restore your progress on this device."}
      </p>
    </header>
  );
}
