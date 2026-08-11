import "server-only";
import webpush, { type PushSubscription, WebPushError } from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/* ==================================================================== *
 * Sending push notifications.
 *
 * `web-push` is a real dependency here rather than three fetch calls like
 * Stripe: the Web Push protocol needs a VAPID-signed JWT plus ECDH key
 * agreement, HKDF and AES-128-GCM over the payload. That is cryptography to
 * use, not to reimplement.
 * ==================================================================== */

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping it should land. */
  url?: string;
  /** Replaces any existing notification with the same tag. */
  tag?: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  /** Subscriptions the push service reported as permanently gone. */
  pruned: number;
}

let configured = false;

/** Returns false when VAPID isn't set up, rather than throwing. */
function ensureConfigured(): boolean {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
}

/**
 * Sends to every device belonging to a user.
 *
 * A subscription the push service reports as gone (404/410) is deleted
 * immediately — keeping it would mean retrying a dead endpoint forever and
 * slowly poisoning the delivery stats.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
  kind = "reminder",
): Promise<SendResult> {
  const empty: SendResult = { sent: 0, failed: 0, pruned: 0 };
  if (!ensureConfigured()) return empty;

  const admin = getSupabaseAdmin();
  if (!admin) return empty;

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) return empty;

  const result = { ...empty };
  const body = JSON.stringify(payload);

  await Promise.all(
    (data as SubscriptionRow[]).map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };

      try {
        await webpush.sendNotification(subscription, body, { TTL: 60 * 60 * 12 });
        result.sent++;
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", row.id);
      } catch (caught) {
        const status = caught instanceof WebPushError ? caught.statusCode : 0;

        if (status === 404 || status === 410) {
          // Gone for good — the user cleared site data or uninstalled.
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          result.pruned++;
          return;
        }

        result.failed++;
        // Transient — a timeout, or the push service having a moment. Count it
        // so a persistently broken endpoint can be spotted later.
        await admin
          .from("push_subscriptions")
          .update({ failure_count: (row.failure_count ?? 0) + 1 })
          .eq("id", row.id);
      }
    }),
  );

  await admin.from("notification_log").insert({
    user_id: userId,
    kind,
    title: payload.title,
    status: result.sent > 0 ? "sent" : result.pruned > 0 ? "expired" : "failed",
    detail: `sent ${result.sent}, failed ${result.failed}, pruned ${result.pruned}`,
  });

  /*
   * Only a reminder resets the reminder cooldown.
   *
   * `last_notified_at` gates the once-per-12-hours rule in
   * players_due_for_reminder(). Stamping it for every kind meant a user
   * pressing "send a test" silenced their next real reminder — and an admin
   * broadcast would silence everyone's. The column answers "when did we last
   * *remind* you", so only reminders may write it.
   */
  if (result.sent > 0 && kind.startsWith("reminder")) {
    await admin
      .from("profiles")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", userId);
  }

  return result;
}
