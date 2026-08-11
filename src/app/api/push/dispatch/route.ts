import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { buildToday } from "@/lib/game";
import { todayKey } from "@/lib/date";
import { rowToLog, rowToQuest } from "@/lib/sync/mapping";
import type { LogRow, QuestRow } from "@/lib/supabase/types";
import type { MotivationStyle } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isPushConfigured, sendToUser } from "@/lib/push/send";
import { buildReminder } from "@/lib/push/reminder";

export const runtime = "nodejs";
// Reads live data and sends mail; must never be cached or prerendered.
export const dynamic = "force-dynamic";

/* ==================================================================== *
 * The reminder dispatcher.
 *
 * Called on a schedule by pg_cron (see migration 0004). Runs hourly and lets
 * the database work out who is actually inside their morning or evening
 * window *in their own timezone* — which is why one hourly job covers every
 * player on earth rather than needing a cron per region.
 *
 * Authenticated by a shared secret. Without it, anyone who found the URL
 * could spam every user's phone.
 * ==================================================================== */

function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const provided =
    request.headers.get("x-cron-secret")?.trim() ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    "";

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

interface DueRow {
  user_id: string;
  timezone: string | null;
  local_hour: number;
  rhythm: string;
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, reason: "no-service-role" }, { status: 500 });
  }

  const summary = { considered: 0, sent: 0, silent: 0, failed: 0 };
  const day = todayKey();

  for (const window of ["morning", "evening"] as const) {
    const { data, error } = await admin.rpc("players_due_for_reminder", {
      window_label: window,
    });
    if (error || !data) continue;

    for (const row of data as DueRow[]) {
      summary.considered++;

      try {
        const [profileResult, questResult, logResult] = await Promise.all([
          admin
            .from("profiles")
            .select("display_name, motivation_style")
            .eq("id", row.user_id)
            .maybeSingle(),
          admin.from("quests").select("*").eq("user_id", row.user_id).is("archived_at", null),
          // Only today's logs are needed to know what's still outstanding.
          admin.from("logs").select("*").eq("user_id", row.user_id).eq("day", day),
        ]);

        const quests = ((questResult.data ?? []) as QuestRow[]).map(rowToQuest);
        const logs = ((logResult.data ?? []) as LogRow[]).map(rowToLog);

        const remaining = buildToday(quests, logs, day).filter(
          (item) => item.due && (!item.log || item.log.status === "skipped"),
        ).length;

        const profile = profileResult.data as
          | { display_name?: string; motivation_style?: MotivationStyle }
          | null;

        const copy = buildReminder({
          style: profile?.motivation_style ?? "cheerleader",
          remaining,
          window,
          firstName: (profile?.display_name ?? "").split(" ")[0] || "there",
        });

        // Board already clear — the right number of notifications is zero.
        if (!copy) {
          summary.silent++;
          continue;
        }

        const result = await sendToUser(
          row.user_id,
          { title: copy.title, body: copy.body, url: "/dashboard", tag: "lifequest-reminder" },
          `reminder-${window}`,
        );

        if (result.sent > 0) summary.sent++;
        else summary.failed++;
      } catch {
        summary.failed++;
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

/** Health check, so the cron job can be verified without sending anything. */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, configured: isPushConfigured() });
}
