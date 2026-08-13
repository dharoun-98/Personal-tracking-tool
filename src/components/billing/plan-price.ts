"use client";

import { useEffect, useState } from "react";

interface PlanPrice {
  unitAmount: number;
  currency: string;
  /** ISO 4217 minor-unit exponent returned by Stripe (for example 2 for USD). */
  minorUnit: number;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
}

export function usePlanPrice(enabled = true): PlanPrice | null {
  const [price, setPrice] = useState<PlanPrice | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    fetch("/api/billing/checkout")
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) setPrice(isPlanPrice(result?.price) ? result.price : null);
      })
      .catch(() => {
        if (!cancelled) setPrice(null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return price;
}

export function formatPlanPrice(price: PlanPrice | null): string | null {
  if (!price) return null;

  try {
    const currency = price.currency.toUpperCase();
    const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency });
    const amount = price.unitAmount / 10 ** price.minorUnit;
    const formatted = formatter.format(amount);
    const cadence =
      price.intervalCount === 1
        ? `/${price.interval}`
        : ` every ${price.intervalCount} ${price.interval}s`;
    return `${formatted}${cadence}`;
  } catch {
    return null;
  }
}

function isPlanPrice(value: unknown): value is PlanPrice {
  if (!value || typeof value !== "object") return false;
  const price = value as Partial<PlanPrice>;
  return (
    typeof price.unitAmount === "number" &&
    Number.isFinite(price.unitAmount) &&
    typeof price.currency === "string" &&
    typeof price.minorUnit === "number" &&
    Number.isInteger(price.minorUnit) &&
    price.minorUnit >= 0 &&
    price.minorUnit <= 4 &&
    ["day", "week", "month", "year"].includes(price.interval ?? "") &&
    typeof price.intervalCount === "number" &&
    Number.isInteger(price.intervalCount) &&
    price.intervalCount > 0
  );
}
