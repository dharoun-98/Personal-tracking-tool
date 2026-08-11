import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isPushConfigured, sendToUser } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================================== *
 * Broadcast a notification from the command deck.
 *
 * Gated on the admin session, checked here rather than only on the page —
 * this is a plain POST endpoint and a page-level check protects the render,
 * not the route.
 *
 * Only ever reaches people who actually opted into notifications: the query
 * requires a push subscription to exist, which is the record of consent.
 * ==================================================================== */

export type Segment = "all" | "trialing" | "active" | "lapsed" | "quiet";

const MAX_TITLE = 60;
const MAX_BODY = 140;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "not-configured", message: "Push isn't configured." },
      { status: 503 },
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, reason: "no-service-role" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  const {
    title,
    message,
    url,
    segment = "all",
    dryRun = false,
  } = (body ?? {}) as Record<string, unknown>;

  if (typeof title !== "string" || !title.trim() || title.length > MAX_TITLE) {
    return NextResponse.json(
      { ok: false, reason: "bad-title", message: `A title is required, up to ${MAX_TITLE} characters.` },
      { status: 400 },
    );
  }
  if (typeof message !== "string" || !message.trim() || message.length > MAX_BODY) {
    return NextResponse.json(
      { ok: false, reason: "bad-message", message: `A message is required, up to ${MAX_BODY} characters.` },
      { status: 400 },
    );
  }
  if (url !== undefined && (typeof url !== "string" || !url.startsWith("/"))) {
    return NextResponse.json(
      { ok: false, reason: "bad-url", message: "The link must be an in-app path starting with /." },
      { status: 400 },
    );
  }

  /* --- Work out who it goes to ------------------------------------- */
  let query = admin.from("accounts").select("id, status");

  switch (segment as Segment) {
    case "trialing":
      query = query.eq("status", "trialing");
      break;
    case "active":
      query = query.in("status", ["active", "comped"]);
      break;
    case "lapsed":
      query = query.in("status", ["past_due", "expired"]);
      break;
    case "quiet":
    case "all":
    default:
      break;
  }

  const { data: accounts, error } = await query;
  if (error || !accounts) {
    return NextResponse.json(
      { ok: false, reason: "query-failed", message: error?.message ?? "Couldn't load recipients." },
      { status: 500 },
    );
  }

  // Consent check: only people with a live subscription.
  const { data: subscribed } = await admin.from("push_subscriptions").select("user_id");
  const reachable = new Set((subscribed ?? []).map((row) => (row as { user_id: string }).user_id));

  let targets = (accounts as Array<{ id: string }>)
    .map((a) => a.id)
    .filter((id) => reachable.has(id));

  // "Quiet" means nobody has checked in for a week — the segment worth a
  // gentle "still here?" and the one most likely to be abused, so it stays
  // explicit rather than being the default.
  if (segment === "quiet") {
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: recent } = await admin.from("logs").select("user_id").gte("day", cutoff);
    const active = new Set((recent ?? []).map((row) => (row as { user_id: string }).user_id));
    targets = targets.filter((id) => !active.has(id));
  }

  if (dryRun === true) {
    return NextResponse.json({ ok: true, dryRun: true, recipients: targets.length });
  }

  if (targets.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "no-recipients", message: "Nobody in that segment has notifications on." },
      { status: 400 },
    );
  }

  let sent = 0;
  let failed = 0;

  // Sequential rather than Promise.all: a broadcast to thousands would
  // otherwise open thousands of sockets at once and get us rate-limited by
  // the push services.
  for (const id of targets) {
    const result = await sendToUser(
      id,
      {
        title: title.trim(),
        body: message.trim(),
        url: typeof url === "string" ? url : "/dashboard",
        tag: "lifequest-broadcast",
      },
      "broadcast",
    );
    if (result.sent > 0) sent++;
    else failed++;
  }

  return NextResponse.json({ ok: true, recipients: targets.length, sent, failed });
}
