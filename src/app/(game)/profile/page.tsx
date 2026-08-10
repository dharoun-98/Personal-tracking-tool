"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, RotateCcw } from "lucide-react";
import { MOTIVATION_STYLES, RHYTHMS, TIME_BUDGETS } from "@/lib/onboarding";
import { levelTitle } from "@/lib/game";
import { compactNumber } from "@/lib/format";
import { useSnapshot, useTrialDaysLeft } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { MascotAvatar } from "@/components/mascot/mascot-avatar";
import { InstallCard } from "@/components/shell/install-card";
import { DocumentCard } from "@/components/documents/document-card";
import { EmailDocuments } from "@/components/documents/email-documents";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { StreakFlame } from "@/components/game/streak-flame";

export default function ProfilePage() {
  const router = useRouter();
  const profile = useGame((s) => s.profile);
  const account = useGame((s) => s.account);
  const resetEverything = useGame((s) => s.resetEverything);
  const { level, streak, totalXp } = useSnapshot();
  const trialLeft = useTrialDaysLeft();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!profile) return null;

  const first = profile.displayName.split(" ")[0];

  return (
    <main className="space-y-7 pt-6">
      {/* --------------------------------------------------------- Header */}
      <header className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-full border border-cyan/30 bg-surface">
          <MascotAvatar size={44} mood="happy" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold">
            {profile.displayName}
          </h1>
          <p className="mt-0.5 text-xs text-gold-ink">
            Level {level.level} · {levelTitle(level.level)}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <StreakFlame days={streak} size="sm" />
            <span className="text-2xs text-ink-faint tabular-nums">
              {compactNumber(totalXp)} XP
            </span>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- Trial */}
      {account.status === "trialing" && trialLeft !== null && (
        <Panel
          className={cn(
            "p-4",
            trialLeft <= 3 ? "border-gold/40 bg-gold/8" : "border-cyan/25 bg-cyan/6",
          )}
        >
          <p
            className={cn(
              "text-sm font-semibold",
              trialLeft <= 3 ? "text-gold-ink" : "text-cyan-ink",
            )}
          >
            {trialLeft > 0
              ? `${trialLeft} ${trialLeft === 1 ? "day" : "days"} left in your trial`
              : "Your trial has ended"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-dim">
            {trialLeft > 0
              ? "No card on file, nothing to cancel. Keep playing and decide later."
              : "Add a payment method whenever you're ready to keep playing."}
          </p>
        </Panel>
      )}

      {/* ------------------------------------------------------ Documents */}
      <section>
        <SectionTitle>Your documents</SectionTitle>
        <div className="space-y-2.5">
          <DocumentCard kind="report" />
          <DocumentCard kind="promise" />
          <EmailDocuments />
        </div>
        <p className="mt-2 px-1 text-2xs text-ink-faint">
          Generated on your device from your own data. Nothing is uploaded.
        </p>
      </section>

      {/* -------------------------------------------------------- Install */}
      <section>
        <SectionTitle>On your device</SectionTitle>
        <InstallCard />
      </section>

      {/* ----------------------------------------------------- Appearance */}
      <section>
        <SectionTitle>Appearance</SectionTitle>
        <ThemeToggle />
        <p className="mt-2 px-1 text-2xs text-ink-faint">
          Night is the original. Day is for bright rooms and people who prefer it.
        </p>
      </section>

      {/* ------------------------------------------------------- Settings */}
      <section>
        <SectionTitle
          action={
            <Link
              href="/settings"
              className="tappable inline-flex items-center gap-1 text-2xs font-semibold text-violet-soft"
            >
              <Pencil className="size-3.5" />
              Edit
            </Link>
          }
        >
          Your setup
        </SectionTitle>
        <Panel className="divide-y divide-hairline/60">
          <SettingRow
            label="Companion"
            value={
              MOTIVATION_STYLES.find((s) => s.id === profile.motivationStyle)?.name ??
              "—"
            }
          />
          <SettingRow
            label="Check-in rhythm"
            value={RHYTHMS.find((r) => r.id === profile.rhythm)?.name ?? "—"}
          />
          <SettingRow
            label="Daily time"
            value={
              TIME_BUDGETS.find((t) => t.minutes === profile.dailyMinutes)?.label ??
              `${profile.dailyMinutes} min`
            }
          />
          <SettingRow
            label="Focus domains"
            value={`${profile.priorities.length} chosen`}
          />
        </Panel>
      </section>

      {/* ----------------------------------------------------- Danger zone */}
      <section>
        <SectionTitle>Start over</SectionTitle>
        <Panel className="p-4">
          {confirmReset ? (
            <>
              <p className="text-sm font-semibold text-danger">
                This erases everything.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                Every quest, log, streak and achievement on this device, permanently.
                {first} — there&apos;s no undo.
              </p>
              <div className="mt-3.5 flex gap-2.5">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    resetEverything();
                    router.replace("/onboarding");
                  }}
                >
                  Yes, erase it all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  Keep my world
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Reset your world</p>
                <p className="mt-0.5 text-2xs text-ink-faint">
                  Wipe everything and run setup again.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-ink-dim">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

