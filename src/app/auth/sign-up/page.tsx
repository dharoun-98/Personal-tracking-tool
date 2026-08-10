import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthForm, AuthHeader } from "@/components/auth/auth-form";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 pad-safe-top">
      <Link
        href="/"
        className="tappable mb-8 inline-flex items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <AuthHeader mode="sign-up" />
      <AuthForm mode="sign-up" />

      <p className="mt-6 text-center text-2xs leading-relaxed text-ink-faint">
        16 days free, no card. Your quests, logs and streaks stay on your device
        unless you choose to back them up.
      </p>
    </main>
  );
}
