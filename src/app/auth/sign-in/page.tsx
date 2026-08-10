import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthForm, AuthHeader } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "missing-code": "That link was incomplete. Try requesting a fresh one.",
  "link-expired": "That link has expired — they only last an hour. Request another?",
  "not-configured": "Accounts aren't switched on for this deployment yet.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 pad-safe-top">
      <Link
        href="/"
        className="tappable mb-8 inline-flex items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <AuthHeader mode="sign-in" />

      {message && (
        <p className="mb-4 rounded-xl bg-warn/12 px-3.5 py-2.5 text-xs text-warn">
          {message}
        </p>
      )}

      <AuthForm mode="sign-in" />
    </main>
  );
}
