import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Signs out and returns to the landing page.
 *
 * POST only. A GET sign-out can be triggered by any image tag pointing at this
 * URL, which makes logging people out a trivial nuisance attack.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServer();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", new URL(request.url).origin), {
    status: 303,
  });
}
