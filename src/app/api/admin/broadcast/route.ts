import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isAdminAuthenticated } from "@/lib/admin/session";
import { evaluateAccess, type AccessState } from "@/lib/billing/access";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AccountRow } from "@/lib/supabase/types";
import { isPushConfigured, sendToUser } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================================== *
 * Broadcast a notification from the Admin dashboard.
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
const PAGE_SIZE = 500;
const REVIEW_TTL_MS = 10 * 60 * 1000;
const SEGMENTS = new Set<Segment>(["all", "trialing", "active", "lapsed", "quiet"]);
const DESTINATIONS = new Set(["/dashboard", "/journey", "/map", "/profile", "/account"]);

type AccountTarget = Pick<
  AccountRow,
  | "id"
  | "status"
  | "role"
  | "bypass_billing"
  | "trial_started_at"
  | "trial_days"
  | "past_due_since"
  | "updated_at"
>;

interface PushSubscriptionTarget {
  id: string;
  user_id: string;
}

interface IdTarget {
  id: string;
}

interface PageResult<T> {
  data: T[] | null;
  count: number | null;
  error: string | null;
}

type AllRowsResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string };

function isSegment(value: unknown): value is Segment {
  return typeof value === "string" && SEGMENTS.has(value as Segment);
}

function reviewTokenFor(
  secret: string,
  issuedAt: number,
  draft: { segment: Segment; title: string; message: string; url: string },
  targets: string[],
): string {
  const reviewed = JSON.stringify([
    issuedAt,
    draft.segment,
    draft.title.trim(),
    draft.message.trim(),
    draft.url,
    [...targets].sort(),
  ]);
  const signature = createHmac("sha256", secret).update(reviewed).digest("hex");
  return `${issuedAt}.${signature}`;
}

function validReviewToken(
  token: unknown,
  secret: string,
  draft: { segment: Segment; title: string; message: string; url: string },
  targets: string[],
): boolean {
  if (typeof token !== "string") return false;
  const [issuedRaw, signature, ...extra] = token.split(".");
  const issuedAt = Number(issuedRaw);
  if (
    extra.length > 0 ||
    !signature ||
    !Number.isSafeInteger(issuedAt) ||
    issuedAt > Date.now() + 30_000 ||
    Date.now() - issuedAt > REVIEW_TTL_MS
  ) {
    return false;
  }

  const expected = reviewTokenFor(secret, issuedAt, draft, targets).split(".")[1];
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function loadAllRows<T extends { id: string }>(
  label: string,
  loadPage: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<AllRowsResult<T>> {
  const rows = new Map<string, T>();
  let offset = 0;

  while (true) {
    const page = await loadPage(offset, offset + PAGE_SIZE - 1);
    if (page.error) return { ok: false, error: page.error };
    if (!page.data) return { ok: false, error: `Couldn't load ${label}.` };
    if (page.count === null) {
      return { ok: false, error: `Couldn't verify the complete ${label} list.` };
    }

    for (const row of page.data) rows.set(row.id, row);
    offset += page.data.length;

    if (offset >= page.count) return { ok: true, data: [...rows.values()] };
    if (page.data.length === 0) {
      return { ok: false, error: `The ${label} list ended before every row was loaded.` };
    }
  }
}

function accessFor(account: AccountTarget, nowMs: number): AccessState {
  return evaluateAccess(
    {
      ...account,
      email: null,
      plan: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
      documents_sent_at: null,
      created_at: account.updated_at,
    },
    nowMs,
  );
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        ok: false,
        reason: "unauthorised",
        message: "Your admin session expired. Sign in again and retry.",
      },
      { status: 401 },
    );
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "not-configured", message: "Push isn't configured." },
      { status: 503 },
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        reason: "no-service-role",
        message: "Account management is not configured on this deployment.",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, reason: "bad-request", message: "That notification request was invalid." },
      { status: 400 },
    );
  }

  const {
    title,
    message,
    url,
    segment,
    dryRun,
    recipients: reviewedRecipients,
    reviewToken,
  } = body as Record<string, unknown>;

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
  if (!isSegment(segment)) {
    return NextResponse.json(
      { ok: false, reason: "bad-segment", message: "Choose a valid audience." },
      { status: 400 },
    );
  }
  if (typeof url !== "string" || !DESTINATIONS.has(url)) {
    return NextResponse.json(
      { ok: false, reason: "bad-url", message: "Choose a valid in-app destination." },
      { status: 400 },
    );
  }
  if (typeof dryRun !== "boolean") {
    return NextResponse.json(
      { ok: false, reason: "bad-request", message: "That notification request was invalid." },
      { status: 400 },
    );
  }
  if (
    !dryRun &&
    (typeof reviewedRecipients !== "number" ||
      !Number.isSafeInteger(reviewedRecipients) ||
      reviewedRecipients < 1)
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "missing-review",
        message: "Check the audience before sending this notification.",
      },
      { status: 400 },
    );
  }
  if (!dryRun && typeof reviewToken !== "string") {
    return NextResponse.json(
      {
        ok: false,
        reason: "missing-review",
        message: "Check the audience before sending this notification.",
      },
      { status: 400 },
    );
  }

  /* --- Work out who it goes to ------------------------------------- */
  const accountRows = await loadAllRows<AccountTarget>(
    "accounts",
    async (from, to) => {
      const { data, count, error } = await admin
        .from("accounts")
        .select(
          "id, status, role, bypass_billing, trial_started_at, trial_days, past_due_since, updated_at",
          { count: "exact" },
        )
        .order("id", { ascending: true })
        .range(from, to);

      return {
        data: data as AccountTarget[] | null,
        count,
        error: error?.message ?? null,
      };
    },
  );
  if (!accountRows.ok) {
    return NextResponse.json(
      { ok: false, reason: "query-failed", message: accountRows.error },
      { status: 500 },
    );
  }

  const nowMs = Date.now();
  const candidates = accountRows.data.filter((account) => {
    const access = accessFor(account, nowMs);

    switch (segment) {
      case "trialing":
        return access.reason === "trialing" || access.reason === "trial-ending";
      case "active":
        return (
          access.reason === "subscribed" ||
          access.reason === "comped" ||
          access.reason === "staff"
        );
      case "lapsed":
        return account.role === "player" && access.level === "locked";
      case "quiet":
        return account.role === "player" && access.level !== "locked";
      case "all":
        return true;
    }
  });

  // Consent check: only people with a live subscription.
  const subscriptionRows = await loadAllRows<PushSubscriptionTarget>(
    "notification subscriptions",
    async (from, to) => {
      const { data, count, error } = await admin
        .from("push_subscriptions")
        .select("id, user_id", { count: "exact" })
        .order("id", { ascending: true })
        .range(from, to);

      return {
        data: data as PushSubscriptionTarget[] | null,
        count,
        error: error?.message ?? null,
      };
    },
  );
  if (!subscriptionRows.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: "query-failed",
        message: subscriptionRows.error,
      },
      { status: 500 },
    );
  }
  const reachable = new Set(subscriptionRows.data.map((row) => row.user_id));

  let targets = [
    ...new Set(candidates.map((account) => account.id).filter((id) => reachable.has(id))),
  ];

  // "Quiet" means nobody has checked in for a week — the segment worth a
  // gentle "still here?" and the one most likely to be abused, so it stays
  // explicit rather than being the default.
  if (segment === "quiet") {
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const quietRows = await loadAllRows<IdTarget>(
      "quiet accounts",
      async (from, to) => {
        const { data, count, error } = await admin
          .from("admin_user_overview")
          .select("id", { count: "exact" })
          .eq("onboarding_complete", true)
          .not("last_active_day", "is", null)
          .lte("last_active_day", cutoff)
          .order("id", { ascending: true })
          .range(from, to);

        return {
          data: data as IdTarget[] | null,
          count,
          error: error?.message ?? null,
        };
      },
    );

    if (!quietRows.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: "query-failed",
          message: quietRows.error,
        },
        { status: 500 },
      );
    }

    const quiet = new Set(quietRows.data.map((row) => row.id));
    targets = targets.filter((id) => quiet.has(id));
  }

  const reviewSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!reviewSecret) {
    return NextResponse.json(
      { ok: false, reason: "not-configured", message: "Admin review signing isn't configured." },
      { status: 503 },
    );
  }
  const reviewedDraft = {
    segment,
    title: title.trim(),
    message: message.trim(),
    url,
  };

  if (dryRun === true) {
    const issuedAt = Date.now();
    return NextResponse.json({
      ok: true,
      dryRun: true,
      recipients: targets.length,
      reviewToken: reviewTokenFor(reviewSecret, issuedAt, reviewedDraft, targets),
    });
  }

  if (
    reviewedRecipients !== targets.length ||
    !validReviewToken(reviewToken, reviewSecret, reviewedDraft, targets)
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "audience-changed",
        recipients: targets.length,
        message:
          reviewedRecipients !== targets.length
            ? `The audience changed from ${reviewedRecipients} to ${targets.length}. Nothing was sent. Check the audience again before sending.`
            : "The reviewed audience changed or the review expired. Nothing was sent. Check the audience again before sending.",
      },
      { status: 409 },
    );
  }

  if (targets.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "no-recipients", message: "Nobody in that segment has notifications on." },
      { status: 400 },
    );
  }

  let sent = 0;
  let failed = 0;

  // Keep delivery sequential until it is backed by a durable broadcast job
  // and idempotency record. Parallel delivery without that guard makes a
  // timeout/retry capable of duplicating an irreversible notification.
  for (const id of targets) {
    const result = await sendToUser(
      id,
      {
        title: title.trim(),
        body: message.trim(),
        url,
        tag: "lifequest-broadcast",
      },
      "broadcast",
    );
    if (result.sent > 0) sent++;
    else failed++;
  }

  return NextResponse.json({ ok: true, recipients: targets.length, sent, failed });
}
