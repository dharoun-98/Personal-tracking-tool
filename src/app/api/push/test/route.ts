import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isPushConfigured, sendToUser } from "@/lib/push/send";

export const runtime = "nodejs";

/**
 * Sends the player a single test notification to their own devices.
 *
 * Only ever targets the caller — there is no user id parameter, deliberately.
 * An endpoint that takes a target is an endpoint someone will eventually point
 * at everybody.
 */
export async function POST() {
  if (!isPushConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        reason: "not-configured",
        message: "Notifications aren't switched on for this deployment yet.",
      },
      { status: 503 },
    );
  }

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: "signed-out" }, { status: 401 });

  const result = await sendToUser(
    user.id,
    {
      title: "That's working",
      body: "This is what a nudge looks like. They stay this quiet.",
      url: "/dashboard",
      tag: "lifequest-test",
    },
    "test",
  );

  if (result.sent === 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: "no-devices",
        message:
          result.pruned > 0
            ? "That device's subscription had expired — try switching notifications off and on again."
            : "No device is set up to receive notifications yet.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
