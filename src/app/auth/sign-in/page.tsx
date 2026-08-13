import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthForm, AuthHeader } from "@/components/auth/auth-form";
import { safeInternalReturnPath } from "@/lib/safe-return";

export const metadata = { title: "Sign in" };

/**
 * Human-readable reasons.
 *
 * Every unrecognised reason falls through to the raw `detail` from Supabase
 * rather than a friendly guess. An earlier version reported *every* callback
 * failure as "that link expired", which sent someone hunting a timeout when
 * the real cause was a missing PKCE verifier — the link was two minutes old.
 * A confidently wrong error message is worse than a blunt accurate one.
 */
const ERRORS: Record<string, string> = {
  "missing-code": "That link was incomplete. Try requesting a fresh one.",
  "not-configured": "Accounts aren't switched on for this deployment yet.",
  otp_expired: "That link has expired. Request another below.",
  access_denied: "That link has already been used. Request another below.",
  "exchange-failed":
    "That link couldn't be completed on this browser. Email links have to be opened in the same browser that asked for them — or use a password below, which works anywhere.",
  "verify-failed": "That link is no longer valid. Request another below.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string; next?: string }>;
}) {
  const { error, detail, next } = await searchParams;
  const safeNext = safeInternalReturnPath(next);
  const backHref = next ? safeNext : "/";
  const message = error ? (ERRORS[error] ?? detail ?? "That didn't work. Try again below.") : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 pad-safe-top">
      <Link
        href={backHref}
        className="tappable mb-8 inline-flex min-h-11 items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <AuthHeader mode="sign-in" />

      {message && (
        <div className="mb-4 rounded-xl bg-warn/12 px-3.5 py-2.5">
          <p className="text-xs leading-relaxed text-warn">{message}</p>
          {/* The raw provider message, when we also had something friendlier. */}
          {detail && ERRORS[error ?? ""] && (
            <p className="mt-1.5 text-2xs text-ink-mute">{detail}</p>
          )}
        </div>
      )}

      <AuthForm mode="sign-in" next={safeNext} />
    </main>
  );
}
