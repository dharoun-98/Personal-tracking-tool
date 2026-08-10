/**
 * Stripe, over its REST API.
 *
 * Deliberately no `stripe` npm package: it's a large dependency to carry for
 * three endpoints, and adding it before there are real keys would mean
 * shipping it to everyone who just wants to play the game. Two `fetch` calls
 * and an HMAC check do the same job here.
 *
 * Everything degrades to "not configured" rather than throwing.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface StripeConfig {
  secretKey: string;
  priceMonthly: string | null;
  priceYearly: string | null;
  webhookSecret: string | null;
}

export function readStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return {
    secretKey,
    priceMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY?.trim() || null,
    priceYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY?.trim() || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
  };
}

/** Stripe's API is form-encoded, including nested keys like `a[b][0][c]`. */
function toFormBody(
  input: Record<string, unknown>,
  prefix = "",
  target = new URLSearchParams(),
): URLSearchParams {
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") {
          toFormBody(item as Record<string, unknown>, `${name}[${i}]`, target);
        } else {
          target.append(`${name}[${i}]`, String(item));
        }
      });
    } else if (typeof value === "object") {
      toFormBody(value as Record<string, unknown>, name, target);
    } else {
      target.append(name, String(value));
    }
  }
  return target;
}

export async function stripeRequest<T = Record<string, unknown>>(
  config: StripeConfig,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body ? toFormBody(body).toString() : undefined,
    });

    const data = await response.json();
    if (!response.ok) {
      const message =
        (data?.error?.message as string | undefined) ?? `Stripe returned ${response.status}`;
      return { ok: false, error: message };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Stripe request failed",
    };
  }
}

/**
 * Verifies a `Stripe-Signature` header against the raw request body.
 *
 * Without this, anyone who finds the webhook URL can mark any account as paid.
 * The comparison is constant-time and the timestamp is checked to stop a
 * captured-and-replayed payload working forever.
 */
export function verifyWebhookSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [k, ...rest] = part.split("=");
      return [k.trim(), rest.join("=")];
    }),
  );

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const NOT_CONFIGURED = {
  ok: false as const,
  reason: "not-configured" as const,
  message:
    "Payments aren't switched on for this deployment yet. Nothing to pay for — keep playing.",
};
