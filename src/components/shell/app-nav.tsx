"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { CircleUser, CloudAlert, LogIn, Orbit, Sparkles, Swords } from "lucide-react";
import { cn } from "@/lib/cn";
import { safeInternalReturnPath } from "@/lib/safe-return";
import { useSyncStatus } from "@/components/shell/sync-manager";

const ITEMS = [
  { href: "/dashboard", label: "Today", icon: Swords, matches: ["/dashboard", "/quests"] },
  { href: "/map", label: "Map", icon: Orbit, matches: ["/map", "/domains"] },
  { href: "/journey", label: "Journey", icon: Sparkles, matches: ["/journey"] },
  { href: "/profile", label: "You", icon: CircleUser, matches: ["/profile", "/account", "/settings"] },
] as const;

function useActive(matches: readonly string[]) {
  const pathname = usePathname();
  return matches.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/* -------------------------------------------------------------------- *
 * Mobile: fixed bottom tab bar
 * -------------------------------------------------------------------- */

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="panel-glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[var(--safe-bottom)] md:hidden"
    >
      <ul className="flex h-[var(--nav-h)] items-stretch">
        {ITEMS.map((item) => (
          <NavTab key={item.href} {...item} />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  matches,
}: {
  href: string;
  label: string;
  icon: typeof Swords;
  matches: readonly string[];
}) {
  const active = useActive(matches);
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="tappable relative flex h-full flex-col items-center justify-center gap-1"
      >
        {active && (
          <motion.span
            layoutId="tab-glow"
            className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-violet"
            style={{ boxShadow: "0 0 14px 1px var(--color-violet)" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <Icon
          className={cn(
            "size-5.5 transition-colors",
            active ? "text-violet-soft" : "text-ink-faint",
          )}
          strokeWidth={active ? 2.2 : 1.75}
        />
        <span
          className={cn(
            "text-2xs font-medium transition-colors",
            active ? "text-ink" : "text-ink-faint",
          )}
        >
          {label}
        </span>
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------- *
 * Desktop: fixed left rail
 * -------------------------------------------------------------------- */

export function SideRail() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-hairline/60 bg-surface/40 px-4 py-7 backdrop-blur-xl md:flex"
    >
      <Link href="/dashboard" className="mb-9 flex items-center gap-2.5 px-2">
        <span className="grid size-9 place-items-center rounded-xl border border-violet/40 bg-violet/15">
          <Sparkles className="size-4.5 text-gold-ink" strokeWidth={1.75} />
        </span>
        <span className="font-display text-base font-bold">Lifequest</span>
      </Link>

      <ul className="flex flex-1 flex-col gap-1.5">
        {ITEMS.map((item) => (
          <RailItem key={item.href} {...item} />
        ))}
      </ul>

      {/* Injected from package.json in next.config.ts — see the note there. */}
      <p className="px-2 text-2xs text-ink-faint">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </p>
    </nav>
  );
}

function RailItem({
  href,
  label,
  icon: Icon,
  matches,
}: {
  href: string;
  label: string;
  icon: typeof Swords;
  matches: readonly string[];
}) {
  const active = useActive(matches);
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "tappable relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-violet/15 text-ink"
            : "text-ink-mute hover:bg-surface-2 hover:text-ink",
        )}
      >
        {active && (
          <motion.span
            layoutId="rail-marker"
            className="absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-violet"
            style={{ boxShadow: "0 0 12px 1px var(--color-violet)" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <Icon className="size-5" strokeWidth={active ? 2.2 : 1.75} />
        {label}
      </Link>
    </li>
  );
}

/** Persistent identity affordance used on every in-game screen. */
export function AppHeader({
  signedIn,
  email,
  identityUnknown = false,
}: {
  signedIn: boolean;
  email: string | null;
  identityUnknown?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const phase = useSyncStatus((state) => state.phase);
  const syncNeedsAttention =
    signedIn && ["conflict", "error", "offline", "account-change"].includes(phase);
  const search = searchParams.toString();
  const returnPath = safeInternalReturnPath(search ? `${pathname}?${search}` : pathname);
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(returnPath)}`;
  const initial = (email?.trim()[0] ?? "A").toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-[calc(3.5rem+var(--safe-top))] items-center justify-between border-b border-hairline/60 bg-page/88 px-5 pt-[var(--safe-top)] backdrop-blur-xl md:pointer-events-none md:fixed md:inset-x-0 md:h-[calc(4rem+var(--safe-top))] md:border-0 md:bg-transparent md:px-6 md:pt-[calc(1rem+var(--safe-top))] md:pl-[calc(15rem+1.5rem)]">
      <Link
        href="/dashboard"
        aria-label="Lifequest home"
        className="tappable inline-flex min-h-11 items-center gap-2 font-display text-sm font-bold md:hidden"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-violet/15 text-gold-ink">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        Lifequest
      </Link>

      <Link
        href={signedIn ? "/account" : identityUnknown ? pathname : signInHref}
        aria-label={
          signedIn
            ? `Account, signed in${email ? ` as ${email}` : ""}${syncNeedsAttention ? ", sync needs attention" : ""}`
            : identityUnknown
              ? "Account status could not be verified"
            : "Sign in to your account"
        }
        className={cn(
          "panel-glass tappable pointer-events-auto ml-auto inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full border px-2.5 text-sm font-semibold shadow-sm",
          signedIn
            ? "border-success/30"
            : identityUnknown
              ? "border-warn/45 text-warn"
              : "border-violet/45 text-violet-soft",
        )}
      >
        {signedIn ? (
          <>
            <span className="relative grid size-7 place-items-center rounded-full bg-violet/18 text-xs font-bold text-violet-soft">
              {initial}
              <span
                aria-hidden
                className={cn(
                  "absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-surface",
                  syncNeedsAttention ? "bg-warn" : "bg-success",
                )}
              />
            </span>
            <span className="max-w-28 truncate text-xs sm:max-w-44 lg:text-sm">
              {email ?? "Account"}
            </span>
            {syncNeedsAttention && <CloudAlert className="size-4 text-warn" aria-hidden />}
          </>
        ) : identityUnknown ? (
          <>
            <CloudAlert className="size-4" aria-hidden />
            <span>Account check</span>
          </>
        ) : (
          <>
            <LogIn className="size-4" aria-hidden />
            <span>Sign in</span>
          </>
        )}
      </Link>
    </header>
  );
}
