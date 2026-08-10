"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Info, Lock } from "lucide-react";
import { DOMAINS, getDomain } from "@/lib/domains";
import {
  MOTIVATION_STYLES,
  RHYTHMS,
  TIME_BUDGETS,
  baselineWord,
} from "@/lib/onboarding";
import { useGame } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { CheckInRhythm, DomainId, MotivationStyle } from "@/lib/types";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { DomainIcon } from "@/components/game/domain-icon";

const HORIZONS = [3, 6, 12, 24];

/**
 * Post-onboarding settings.
 *
 * One rule governs what appears here: anything that describes *who you are now*
 * is editable; anything that is a *record of the past* is not. Baselines are
 * the latter — they're the whole substance of the starting report, and a report
 * you can retroactively edit is worth nothing.
 */
export default function SettingsPage() {
  const router = useRouter();
  const profile = useGame((s) => s.profile);
  const updateProfile = useGame((s) => s.updateProfile);

  const [saved, setSaved] = useState(false);

  // Local draft so edits are atomic — a half-changed profile shouldn't leak
  // into the dashboard while someone is still deciding.
  const [draft, setDraft] = useState(() => ({
    displayName: profile?.displayName ?? "",
    motivationStyle: profile?.motivationStyle ?? ("cheerleader" as MotivationStyle),
    rhythm: profile?.rhythm ?? ("flexible" as CheckInRhythm),
    dailyMinutes: profile?.dailyMinutes ?? 45,
    priorities: profile?.priorities ?? [],
    visions: { ...(profile?.visions ?? {}) } as Partial<Record<DomainId, string>>,
    promise: profile?.promise ?? "",
    promiseHorizonMonths: profile?.promiseHorizonMonths ?? 12,
  }));

  if (!profile) return null;

  const patch = (p: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setSaved(false);
  };

  const prioritiesChanged =
    draft.priorities.join() !== profile.priorities.join();

  const save = () => {
    updateProfile({
      displayName: draft.displayName.trim() || profile.displayName,
      motivationStyle: draft.motivationStyle,
      rhythm: draft.rhythm,
      dailyMinutes: draft.dailyMinutes,
      priorities: draft.priorities,
      visions: draft.visions,
      promise: draft.promise.trim() || undefined,
      promiseHorizonMonths: draft.promiseHorizonMonths,
    });
    setSaved(true);
  };

  const togglePriority = (id: DomainId) => {
    const has = draft.priorities.includes(id);
    if (has) patch({ priorities: draft.priorities.filter((d) => d !== id) });
    else if (draft.priorities.length < 3)
      patch({ priorities: [...draft.priorities, id] });
  };

  return (
    <main className="space-y-7 pt-6 pb-4">
      <Link
        href="/profile"
        className="tappable inline-flex items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Profile
      </Link>

      <header>
        <h1 className="font-display text-2xl font-bold">Your setup</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
          Change anything here whenever it stops fitting. Your history stays exactly
          as it was.
        </p>
      </header>

      {/* ------------------------------------------------------------ Name */}
      <section>
        <SectionTitle>What we call you</SectionTitle>
        <input
          value={draft.displayName}
          onChange={(e) => patch({ displayName: e.target.value })}
          maxLength={40}
          placeholder="Your name"
          className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet"
        />
      </section>

      {/* -------------------------------------------------------- Companion */}
      <section>
        <SectionTitle>Companion</SectionTitle>
        <div className="space-y-2.5">
          {MOTIVATION_STYLES.map((style) => {
            const active = draft.motivationStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => patch({ motivationStyle: style.id })}
                className={cn(
                  "tappable w-full rounded-2xl border p-3.5 text-left transition-all",
                  active
                    ? "border-violet bg-surface-2"
                    : "border-edge bg-surface hover:border-ink-faint",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{style.name}</p>
                  {active && <Check className="size-4 shrink-0 text-violet" />}
                </div>
                <p className="mt-0.5 text-2xs text-ink-faint">{style.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------- Rhythm */}
      <section>
        <SectionTitle>Check-in rhythm</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {RHYTHMS.map((rhythm) => (
            <Choice
              key={rhythm.id}
              active={draft.rhythm === rhythm.id}
              onClick={() => patch({ rhythm: rhythm.id })}
              title={rhythm.name}
              hint={rhythm.blurb}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- Daily time */}
      <section>
        <SectionTitle>Daily time</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {TIME_BUDGETS.map((option) => (
            <button
              key={option.minutes}
              type="button"
              onClick={() => patch({ dailyMinutes: option.minutes })}
              className={cn(
                "tappable rounded-xl border py-3 text-xs font-semibold transition-all",
                draft.dailyMinutes === option.minutes
                  ? "border-violet bg-violet/12 text-ink"
                  : "border-edge bg-surface text-ink-mute",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-2xs text-ink-faint">
          Only used to size suggestions for new quests. Your current board stays
          untouched.
        </p>
      </section>

      {/* --------------------------------------------------------- Priorities */}
      <section>
        <SectionTitle>Focus domains</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {DOMAINS.map((domain) => {
            const active = draft.priorities.includes(domain.id);
            const rank = draft.priorities.indexOf(domain.id) + 1;
            const disabled = !active && draft.priorities.length >= 3;
            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => togglePriority(domain.id)}
                disabled={disabled}
                className={cn(
                  "tappable relative rounded-2xl border p-3.5 text-left transition-all",
                  active ? "bg-surface-2" : "border-edge bg-surface",
                  disabled && "cursor-not-allowed opacity-35",
                )}
                style={
                  active
                    ? {
                        borderColor: `color-mix(in oklab, ${domain.color} 55%, transparent)`,
                      }
                    : undefined
                }
              >
                {active && (
                  <span
                    className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full text-2xs font-bold text-on-accent"
                    style={{ background: domain.color }}
                  >
                    {rank}
                  </span>
                )}
                <span
                  className="mb-2 grid size-8 place-items-center rounded-lg"
                  style={{
                    background: `color-mix(in oklab, ${domain.color} ${active ? 22 : 12}%, transparent)`,
                    color: domain.ink,
                  }}
                >
                  <DomainIcon domain={domain.id} className="size-4" />
                </span>
                <p className="text-xs font-semibold">{domain.name}</p>
              </button>
            );
          })}
        </div>

        {prioritiesChanged && (
          <Panel className="mt-3 border-warn/35 bg-warn/8 p-3.5">
            <div className="flex gap-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-warn" />
              <div>
                <p className="text-xs font-semibold text-warn">
                  This changes one achievement&apos;s maths
                </p>
                <p className="mt-1 text-2xs leading-relaxed text-ink-dim">
                  &ldquo;In Balance&rdquo; counts days where you touched every focus
                  domain, so its progress is recalculated against your new choice.
                  Anything you&apos;ve already unlocked stays unlocked — nothing is
                  taken back.
                </p>
              </div>
            </div>
          </Panel>
        )}
      </section>

      {/* ------------------------------------------------------------ Visions */}
      {draft.priorities.length > 0 && (
        <section>
          <SectionTitle>What winning looks like</SectionTitle>
          <div className="space-y-3">
            {draft.priorities.map((id) => {
              const domain = getDomain(id);
              return (
                <div
                  key={id}
                  className="panel rounded-2xl p-3.5"
                  style={{
                    ["--accent" as string]: domain.color,
                    ["--accent-ink" as string]: domain.ink,
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="accent-text">
                      <DomainIcon domain={id} className="size-4" />
                    </span>
                    <p className="text-xs font-semibold">{domain.name}</p>
                  </div>
                  <textarea
                    value={draft.visions[id] ?? ""}
                    onChange={(e) =>
                      patch({ visions: { ...draft.visions, [id]: e.target.value } })
                    }
                    rows={2}
                    maxLength={280}
                    placeholder={domain.visionPrompt}
                    className="w-full resize-none rounded-xl border border-edge bg-sunken px-3 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-[var(--accent)]"
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Promise */}
      <section>
        <SectionTitle>Promise to your future self</SectionTitle>
        <Panel className="p-4">
          <p className="mb-2.5 text-2xs tracking-wide text-ink-mute uppercase">
            In {draft.promiseHorizonMonths} months, I will have…
          </p>
          <textarea
            value={draft.promise}
            onChange={(e) => patch({ promise: e.target.value })}
            rows={4}
            maxLength={600}
            placeholder="…stopped putting myself last. Got my sleep back."
            className="w-full resize-none rounded-xl border border-edge bg-sunken px-3.5 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-faint focus:border-gold"
          />
          <div className="mt-3 flex gap-2">
            {HORIZONS.map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => patch({ promiseHorizonMonths: months })}
                className={cn(
                  "tappable flex-1 rounded-xl border py-2 text-xs font-semibold transition-all",
                  draft.promiseHorizonMonths === months
                    ? "border-gold bg-gold/12 text-gold-ink"
                    : "border-edge bg-surface text-ink-mute",
                )}
              >
                {months}m
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-2xs text-ink-faint">
            Editing this rewrites the letter next time you download it.
          </p>
        </Panel>
      </section>

      {/* ---------------------------------------------------------- Baselines */}
      <section>
        <SectionTitle>Where you started</SectionTitle>
        <Panel className="p-4">
          <div className="mb-3 flex gap-2.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-ink-faint" />
            <p className="text-2xs leading-relaxed text-ink-mute">
              These are locked on purpose. They&apos;re the record of day one and the
              substance of your starting report — a report you could edit afterwards
              wouldn&apos;t be worth keeping.
            </p>
          </div>
          <div className="space-y-1.5">
            {DOMAINS.map((domain) => (
              <div key={domain.id} className="flex items-center gap-3">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: domain.color }}
                />
                <span className="flex-1 text-xs text-ink-dim">{domain.name}</span>
                <span className="text-xs text-ink-faint">
                  {baselineWord(profile.baselines[domain.id])}
                </span>
                <span className="w-8 text-right text-xs font-semibold tabular-nums">
                  {profile.baselines[domain.id]}/10
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* --------------------------------------------------------------- Save */}
      <div className="sticky bottom-[calc(var(--nav-h)+var(--safe-bottom))] flex gap-2.5 bg-linear-to-t from-page via-page/95 to-transparent pt-5 pb-4 md:bottom-0">
        <Button
          size="lg"
          fullWidth
          variant={saved ? "secondary" : "primary"}
          onClick={save}
        >
          {saved ? (
            <>
              <Check className="size-4" />
              Saved
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        {saved && (
          <Button size="lg" variant="ghost" onClick={() => router.push("/profile")}>
            Done
          </Button>
        )}
      </div>
    </main>
  );
}

function Choice({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tappable rounded-2xl border p-3.5 text-left transition-all",
        active
          ? "border-violet bg-surface-2"
          : "border-edge bg-surface hover:border-ink-faint",
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-2xs leading-relaxed text-ink-faint">{hint}</p>
    </button>
  );
}
