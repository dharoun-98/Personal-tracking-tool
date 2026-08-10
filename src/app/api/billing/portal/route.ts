import { NextResponse } from "next/server";
import { NOT_CONFIGURED, readStripeConfig, stripeRequest } from "@/lib/billing/stripe";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Sends the player to Stripe's own billing portal to update or cancel. */
export async function POST(request: Request) {
  const config = readStripeConfig();
  if (!config) return NextResponse.json(NOT_CONFIGURED, { status: 503 });

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json(NOT_CONFIGURED, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "signed-out", message: "Sign in first." },
      { status: 401 },
    );
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!account?.stripe_customer_id) {
    return NextResponse.json(
      {
        ok: false,
        reason: "no-customer",
        message: "There's no subscription to manage yet.",
      },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const session = await stripeRequest<{ url: string }>(config, "billing_portal/sessions", {
    customer: account.stripe_customer_id,
    return_url: `${origin}/account`,
  });

  if (!session.ok) {
    return NextResponse.json(
      { ok: false, reason: "provider-error", message: session.error },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, url: session.data.url });
}
