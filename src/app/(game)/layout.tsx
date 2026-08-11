import { evaluateAccess, type AccessState } from "@/lib/billing/access";
import { getSupabaseServer } from "@/lib/supabase/server";
import { GameShell } from "@/components/shell/game-shell";
import { SyncManager } from "@/components/shell/sync-manager";

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

  const supabase = await getSupabaseServer();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      signedIn = true;
      const { data: account } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      serverAccess = evaluateAccess(account ?? null);
    }
  }

  return (
    <>
      {/*
        Mounted beside the shell rather than inside it. GameShell returns early
        while the store is hydrating and while onboarding is missing — and the
        signed-in player on a brand-new device hits exactly those branches, so
        a SyncManager nested inside would never mount for the one person who
        most needs it.
      */}
      <SyncManager signedIn={signedIn} />
      <GameShell serverAccess={serverAccess} signedIn={signedIn}>
        {children}
      </GameShell>
    </>
  );
}
