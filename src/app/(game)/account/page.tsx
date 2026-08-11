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

export const metadata = { title: "Account" };

// Entirely user-specific: never serve one person's account page to another
// from a cache.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await getSupabaseServer();
  const cloud = isCloudEnabled();

  let email: string | null = null;
  let signedIn = false;
  let access = evaluateAccess(null);
  let accountRow = null;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      signedIn = true;
      email = user.email ?? null;
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      accountRow = data ?? null;
      access = evaluateAccess(accountRow);
    }
  }

  return (
    <main className="space-y-7 pt-6">
      <Link
        href="/profile"
        className="tappable inline-flex items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Profile
      </Link>

      <header>
        <h1 className="font-display text-2xl font-bold">Account</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
          {signedIn
            ? `Signed in as ${email}.`
            : "Your game runs on this device. An account adds backup and email delivery."}
        </p>
      </header>

      {!cloud && (
        <Panel className="border-warn/35 bg-warn/8 p-4">
          <p className="text-sm font-semibold text-warn">Cloud is switched off</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-dim">
            This deployment has no Supabase configuration, so accounts and backup
            aren&apos;t available. Everything else works exactly as it should.
          </p>
        </Panel>
      )}

      <section>
        <SectionTitle>Backup</SectionTitle>
        <SyncPanel signedIn={signedIn} />
      </section>

      <section>
        <SectionTitle>Notifications</SectionTitle>
        <NotificationCard signedIn={signedIn} />
      </section>

      <section>
        <SectionTitle>Subscription</SectionTitle>
        <BillingPanel
          access={access}
          signedIn={signedIn}
          hasStripeCustomer={!!accountRow?.stripe_customer_id}
        />
      </section>

      {signedIn && (
        <section>
          <SectionTitle>Session</SectionTitle>
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Sign out</p>
                <p className="mt-0.5 text-2xs text-ink-faint">
                  Your game stays on this device.
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
