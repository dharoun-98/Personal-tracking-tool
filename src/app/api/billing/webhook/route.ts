import { NextResponse } from "next/server";
import { readStripeConfig, verifyWebhookSignature } from "@/lib/billing/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AccountStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * Stripe webhook — the only thing that may mark an account paid.
 *
 * Signature verification is not optional. `accounts` is read-only to players
 * under RLS specifically so that subscription state can only ever arrive
 * through this route, and this route only trusts payloads Stripe signed.
 */
export async function POST(request: Request) {
  const config = readStripeConfig();
  if (!config?.webhookSecret) {
    return NextResponse.json({ received: false, reason: "not-configured" }, { status: 503 });
  }

  // Must be the raw body — parsing and re-serialising changes the bytes and
  // the signature will never match.
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyWebhookSignature(payload, signature, config.webhookSecret)) {
    return NextResponse.json({ received: false, reason: "bad-signature" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    // 500 rather than 200: Stripe should retry once the key is present.
    return NextResponse.json({ received: false, reason: "no-service-role" }, { status: 500 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ received: false, reason: "bad-json" }, { status: 400 });
  }

  const object = event.data?.object ?? {};
  const customerId =
    typeof object.customer === "string" ? object.customer : null;

  const userIdFromMetadata =
    (object.metadata as Record<string, string> | undefined)?.supabase_user_id ??
    (typeof object.client_reference_id === "string" ? object.client_reference_id : null);

  /** Find the account by metadata first, falling back to the customer id. */
  const locate = async (): Promise<string | null> => {
    if (userIdFromMetadata) return userIdFromMetadata;
    if (!customerId) return null;
    const { data } = await admin
      .from("accounts")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.id ?? null;
  };

  const apply = async (patch: Record<string, unknown>) => {
    const id = await locate();
    if (!id) return;
    await admin.from("accounts").update(patch).eq("id", id);
  };

  const periodEnd =
    typeof object.current_period_end === "number"
      ? new Date(object.current_period_end * 1000).toISOString()
      : undefined;

  switch (event.type) {
    case "checkout.session.completed": {
      await apply({
        status: "active" satisfies AccountStatus,
        stripe_customer_id: customerId,
        stripe_subscription_id:
          typeof object.subscription === "string" ? object.subscription : null,
        past_due_since: null,
        plan: "monthly",
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const stripeStatus = String(object.status ?? "");
      // Stripe has more states than we do; collapse to ours.
      const status: AccountStatus =
        stripeStatus === "active" || stripeStatus === "trialing"
          ? "active"
          : stripeStatus === "past_due" || stripeStatus === "unpaid"
            ? "past_due"
            : stripeStatus === "canceled" || stripeStatus === "incomplete_expired"
              ? "expired"
              : "past_due";

      await apply({
        status,
        stripe_customer_id: customerId,
        stripe_subscription_id: typeof object.id === "string" ? object.id : null,
        current_period_end: periodEnd,
        // Stamp the start of dunning once, so the grace window doesn't reset
        // every time Stripe retries the charge.
        ...(status === "past_due" ? {} : { past_due_since: null }),
      });

      if (status === "past_due") {
        const id = await locate();
        if (id) {
          const { data } = await admin
            .from("accounts")
            .select("past_due_since")
            .eq("id", id)
            .maybeSingle();
          if (!data?.past_due_since) {
            await admin
              .from("accounts")
              .update({ past_due_since: new Date().toISOString() })
              .eq("id", id);
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      await apply({
        status: "expired" satisfies AccountStatus,
        stripe_subscription_id: null,
        current_period_end: periodEnd,
      });
      break;
    }

    case "invoice.payment_failed": {
      await apply({ status: "past_due" satisfies AccountStatus });
      const id = await locate();
      if (id) {
        const { data } = await admin
          .from("accounts")
          .select("past_due_since")
          .eq("id", id)
          .maybeSingle();
        if (!data?.past_due_since) {
          await admin
            .from("accounts")
            .update({ past_due_since: new Date().toISOString() })
            .eq("id", id);
        }
      }
      break;
    }

    case "invoice.payment_succeeded": {
      await apply({
        status: "active" satisfies AccountStatus,
        past_due_since: null,
      });
      break;
    }

    default:
      // Everything else is acknowledged and ignored — returning non-200 would
      // make Stripe retry events we simply don't care about.
      break;
  }

  return NextResponse.json({ received: true });
}
