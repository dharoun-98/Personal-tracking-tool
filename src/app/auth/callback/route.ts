import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Where Supabase sends people back after a magic link or email confirmation.
 *
 * Exchanges the one-time code for a session cookie, then forwards them on.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  // Only ever redirect within our own app: an attacker-supplied `next` is a
  // textbook open-redirect otherwise.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=missing-code", url.origin));
  }

  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=not-configured", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=link-expired", url.origin));
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
