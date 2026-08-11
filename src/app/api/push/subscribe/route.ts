import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isPushConfigured } from "@/lib/push/send";

export const runtime = "nodejs";

const NOT_CONFIGURED = {
  ok: false as const,
  reason: "not-configured" as const,
  message: "Notifications aren't switched on for this deployment yet.",
};

/** Whether the client should offer notifications at all. */
export async function GET() {
  return NextResponse.json({ configured: isPushConfigured() });
}

/** Stores (or refreshes) this device's push subscription. */
export async function POST(request: Request) {
  if (!isPushConfigured()) return NextResponse.json(NOT_CONFIGURED, { status: 503 });

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json(NOT_CONFIGURED, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "signed-out", message: "Sign in to enable notifications." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  const { endpoint, keys } = (body ?? {}) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };

  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    typeof keys?.p256dh !== "string" ||
    typeof keys?.auth !== "string"
  ) {
    return NextResponse.json(
      { ok: false, reason: "bad-subscription", message: "That subscription looks malformed." },
      { status: 400 },
    );
  }

  // Upsert on endpoint: re-subscribing on the same device returns the same
  // endpoint, and duplicates would mean one device buzzing several times.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "store-failed", message: error.message },
      { status: 500 },
    );
  }

  await supabase.from("profiles").update({ notifications_enabled: true }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}

/** Removes this device's subscription and, if it was the last, turns them off. */
export async function DELETE(request: Request) {
  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json(NOT_CONFIGURED, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: "signed-out" }, { status: 401 });

  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (endpoint) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
  } else {
    await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  }

  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) === 0) {
    await supabase.from("profiles").update({ notifications_enabled: false }).eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
