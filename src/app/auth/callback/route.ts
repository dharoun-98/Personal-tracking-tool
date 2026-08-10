import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Where Supabase sends people back after a magic link or email confirmation.
 *
 * Handles both shapes of link, because which one you get depends on the email
 * template and they fail in completely different ways:
 *
 *   ?code=...                  PKCE. Requires the code-verifier cookie set by
 *                              the browser that *requested* the link. Open the
 *                              email in a different browser, a different
 *                              profile, or through a link-scanner and the
 *                              exchange fails — nothing has expired, the
 *                              verifier simply isn't there.
 *
 *   ?token_hash=...&type=...   Browser-independent. Verified server-side
 *                              against the auth server, so it works wherever
 *                              the link is opened. This is the more robust
 *                              option; see the note in README about switching
 *                              the Supabase email templates to `{{ .TokenHash }}`.
 *
 * Supabase can also bounce straight here with its own ?error=... params, which
 * are passed through rather than swallowed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const next = params.get("next") ?? "/dashboard";
  // Only ever redirect within our own app: an attacker-supplied `next` is a
  // textbook open redirect otherwise.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const fail = (reason: string, detail?: string | null) => {
    const target = new URL("/auth/sign-in", url.origin);
    target.searchParams.set("error", reason);
    if (detail) target.searchParams.set("detail", detail.slice(0, 160));
    return NextResponse.redirect(target);
  };

  // Supabase reporting its own failure (expired token, already used, etc).
  const providerError = params.get("error") ?? params.get("error_code");
  if (providerError) {
    return fail(providerError, params.get("error_description"));
  }

  const supabase = await getSupabaseServer();
  if (!supabase) return fail("not-configured");

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("verify-failed", error.message);
    return NextResponse.redirect(new URL(safeNext, url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("exchange-failed", error.message);
    return NextResponse.redirect(new URL(safeNext, url.origin));
  }

  return fail("missing-code");
}
