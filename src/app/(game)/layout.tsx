import { evaluateAccess, type AccessState } from "@/lib/billing/access";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isCloudEnabled } from "@/lib/supabase/config";
import { GameShell } from "@/components/shell/game-shell";
import { SyncManager } from "@/components/shell/sync-manager";
import { AccountProvider } from "@/components/account/account-context";

/**
 * Server half of the game shell.
 *
 * Its only job is to answer "is this person allowed to play", using the
 * account row rather than anything the browser claims. When nobody is signed
 * in it hands back null and the client falls back to the local trial clock.
 */
export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let serverAccess: AccessState | null = null;
  let signedIn = false;
  let email: string | null = null;
  let userId: string | null = null;
  let accountError: string | null = null;
  let hasStripeCustomer = false;

  const supabase = await getSupabaseServer();
  if (supabase) {
    const {
      data: { user },
      error: identityError,
    } = await supabase.auth.getUser();

    if (identityError) {
      accountError =
        "We couldn't securely verify whether this device is signed in. Your local data has not been changed.";
    } else if (user) {
      signedIn = true;
      userId = user.id;
      email = user.email ?? null;
      const { data: account, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        accountError =
          "We couldn't verify this account's access right now. Your local data has not been changed.";
      } else {
        hasStripeCustomer = !!account?.stripe_customer_id;
        serverAccess = evaluateAccess(account ?? null);
      }
    }
  }

  return (
    <AccountProvider
      value={{
        signedIn,
        email,
        access: serverAccess,
        accountError,
        hasStripeCustomer,
        cloudEnabled: isCloudEnabled(),
      }}
    >
      {/*
        Mounted beside the shell rather than inside it. GameShell returns early
        while the store is hydrating and while onboarding is missing — and the
        signed-in player on a brand-new device hits exactly those branches, so
        a SyncManager nested inside would never mount for the one person who
        most needs it.
      */}
      <SyncManager signedIn={signedIn} userId={userId} />
      <GameShell
        serverAccess={serverAccess}
        signedIn={signedIn}
        email={email}
        accountError={accountError}
        hasStripeCustomer={hasStripeCustomer}
      >
        {children}
      </GameShell>
    </AccountProvider>
  );
}
