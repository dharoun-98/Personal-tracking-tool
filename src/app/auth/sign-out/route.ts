import { NextResponse } from "next/server";
import { safeInternalReturnPath } from "@/lib/safe-return";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Signs out and returns to the requested safe in-app destination, or the
 * landing page when none was supplied.
 *
 * POST only. A GET sign-out can be triggered by any image tag pointing at this
 * URL, which makes logging people out a trivial nuisance attack.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const next = safeInternalReturnPath(form?.get("next"), "/");
  const supabase = await getSupabaseServer();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL(next, new URL(request.url).origin), {
    status: 303,
  });
}
