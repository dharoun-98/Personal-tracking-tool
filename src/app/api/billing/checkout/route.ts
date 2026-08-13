import { NextResponse } from "next/server";
import { NOT_CONFIGURED, readStripeConfig, stripeRequest } from "@/lib/billing/stripe";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface StripePrice {
  active: boolean;
  currency: string;
  unit_amount: number | null;
  recurring: {
    interval: "day" | "week" | "month" | "year";
    interval_count: number;
  } | null;
}

// Stripe amounts use ISO minor units, with this documented set of zero-decimal
// currencies. All other currently supported presentment currencies use 2.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

/** Public, non-sensitive display data for the plan configured for Checkout. */
export async function GET() {
  const config = readStripeConfig();
  if (!config || !config.priceMonthly) {
    return NextResponse.json({ configured: false, price: null });
  }

  const result = await stripeRequest<StripePrice>(
    config,
    `prices/${encodeURIComponent(config.priceMonthly)}`,
  );
  if (
    !result.ok ||
    !result.data.active ||
    typeof result.data.unit_amount !== "number" ||
    !result.data.currency ||
    !result.data.recurring
  ) {
    return NextResponse.json({ configured: true, price: null });
  }

  return NextResponse.json(
    {
      configured: true,
      price: {
        unitAmount: result.data.unit_amount,
        currency: result.data.currency,
        minorUnit: ZERO_DECIMAL_CURRENCIES.has(result.data.currency.toLowerCase()) ? 0 : 2,
        interval: result.data.recurring.interval,
        intervalCount: result.data.recurring.interval_count,
      },
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}

/**
 * Opens a Stripe Checkout session for the signed-in player.
 *
 * Returns 503 with a readable message until Stripe keys exist, which is what
 * the paywall and billing panel render instead of a dead button.
 */
export async function POST(request: Request) {
  const config = readStripeConfig();
  if (!config || !config.priceMonthly) {
    return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  }

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json(NOT_CONFIGURED, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        reason: "signed-out",
        message: "Create an account first — that's what the subscription attaches to.",
      },
      { status: 401 },
    );
  }

  const origin = new URL(request.url).origin;
  const { data: account } = await supabase
    .from("accounts")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = account?.stripe_customer_id ?? null;

  // Create the customer up front so the id survives an abandoned checkout;
  // otherwise every retry spawns another orphan customer in the dashboard.
  if (!customerId) {
    const created = await stripeRequest<{ id: string }>(config, "customers", {
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    if (!created.ok) {
      return NextResponse.json(
        { ok: false, reason: "provider-error", message: created.error },
        { status: 502 },
      );
    }
    customerId = created.data.id;

    // Written with the service role: `accounts` is read-only to the player,
    // precisely so billing state can't be set from a browser.
    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.from("accounts").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }
  }

  const session = await stripeRequest<{ url: string }>(config, "checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: config.priceMonthly, quantity: 1 }],
    success_url: `${origin}/account?checkout=done`,
    cancel_url: `${origin}/account?checkout=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: user.id,
    subscription_data: { metadata: { supabase_user_id: user.id } },
  });

  if (!session.ok) {
    return NextResponse.json(
      { ok: false, reason: "provider-error", message: session.error },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, url: session.data.url });
}
