"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CircleUser, Orbit, Sparkles, Swords } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/dashboard", label: "Today", icon: Swords },
  { href: "/map", label: "Map", icon: Orbit },
  { href: "/journey", label: "Journey", icon: Sparkles },
  { href: "/profile", label: "You", icon: CircleUser },
] as const;

function useActive(href: string) {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
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
}: {
  href: string;
  label: string;
  icon: typeof Swords;
}) {
  const active = useActive(href);
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
}: {
  href: string;
  label: string;
  icon: typeof Swords;
}) {
  const active = useActive(href);
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
