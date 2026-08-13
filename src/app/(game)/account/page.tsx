import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { evaluateAccess } from "@/lib/billing/access";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isCloudEnabled } from "@/lib/supabase/config";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { buttonClasses } from "@/components/ui/button-styles";
import { SyncPanel } from "@/components/account/sync-panel";
import { NotificationCard } from "@/components/notifications/notification-card";
import { BillingPanel } from "@/components/account/billing-panel";
import { DataExportCard } from "@/components/account/data-export-card";
import {
  CheckoutReturnNotice,
  type CheckoutOutcome,
} from "@/components/account/checkout-return-notice";

export const metadata = { title: "Account & data" };

// Entirely user-specific: never serve one person's account page to another
// from a cache.
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawCheckout = Array.isArray(query.checkout) ? query.checkout[0] : query.checkout;
  const checkout: CheckoutOutcome =
    rawCheckout === "done" || rawCheckout === "cancelled" ? rawCheckout : null;
  const supabase = await getSupabaseServer();
  const cloud = isCloudEnabled();

  let email: string | null = null;
  let signedIn = false;
  let access = evaluateAccess(null);
  let accountRow = null;
  let accountLoadError: string | null = null;

  if (supabase) {
    const {
      data: { user },
      error: identityError,
    } = await supabase.auth.getUser();
    if (identityError) {
      accountLoadError =
        "We couldn't securely verify whether this device is signed in. Your local world has not been changed.";
    } else if (user) {
      signedIn = true;
      email = user.email ?? null;
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        accountLoadError =
          "We couldn't read your billing status. Your local world has not been changed.";
      } else {
        accountRow = data ?? null;
        access = evaluateAccess(accountRow);
      }
    }
  }

  return (
    <main className="space-y-7 pt-6">
      <Link
        href="/profile"
        className="tappable inline-flex min-h-11 items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        You
      </Link>

      <header>
        <h1 className="font-display text-2xl font-bold">Account &amp; data</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
          {signedIn
            ? `Signed in as ${email}.`
            : "Your game runs on this device. Sign in when you want automatic cloud sync across devices."}
        </p>
      </header>

      <CheckoutReturnNotice
        outcome={checkout}
        confirmed={!accountLoadError && access.reason === "subscribed"}
      />

      <section id="cloud-sync" className="scroll-mt-20">
        <SectionTitle>Cloud sync</SectionTitle>
        {cloud ? (
          <SyncPanel signedIn={signedIn} />
        ) : (
          <Panel className="p-4">
            <p className="text-sm font-semibold">Cloud sync is unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-mute">
              This installation stores progress on this device only. The rest of the
              app remains fully usable.
            </p>
          </Panel>
        )}
      </section>

      <section id="notifications" className="scroll-mt-20">
        <SectionTitle>Notifications</SectionTitle>
        <NotificationCard signedIn={signedIn} />
      </section>

      <section id="subscription" className="scroll-mt-20">
        <SectionTitle>Subscription</SectionTitle>
        {accountLoadError ? (
          <Panel className="border-warn/35 bg-warn/8 p-4">
            <p className="text-sm font-semibold text-warn">Account check unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-mute" role="alert">
              {accountLoadError}
            </p>
            <form action="/account" method="get" className="mt-3">
              <button
                type="submit"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Retry account check
              </button>
            </form>
          </Panel>
        ) : (
          <BillingPanel
            access={access}
            signedIn={signedIn}
            hasStripeCustomer={!!accountRow?.stripe_customer_id}
          />
        )}
      </section>

      <section id="data-export" className="scroll-mt-20">
        <SectionTitle>Data export</SectionTitle>
        <DataExportCard />
      </section>

      {signedIn && (
        <section id="sign-in-security" className="scroll-mt-20">
          <SectionTitle>Sign-in &amp; security</SectionTitle>
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Sign out</p>
                <p className="mt-0.5 text-2xs text-ink-faint">
                  Your game stays on this device. Signing into a different account
                  will pause sync until you choose which world belongs here.
                </p>
              </div>
              <form action="/auth/sign-out" method="post">
                <button
                  type="submit"
                  className={buttonClasses({ variant: "ghost", size: "sm" })}
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              </form>
            </div>
          </Panel>
        </section>
      )}
    </main>
  );
}
