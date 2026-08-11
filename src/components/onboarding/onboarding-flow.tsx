"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { DOMAINS, getDomain } from "@/lib/domains";
import {
  MOTIVATION_STYLES,
  RHYTHMS,
  TIME_BUDGETS,
  baselineWord,
  draftToProfile,
  emptyDraft,
  generateStarterGoals,
  generateStarterQuests,
  ideaToQuest,
  type OnboardingDraft,
} from "@/lib/onboarding";
import { cadenceLabel } from "@/lib/format";
import { useGame } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { DomainId } from "@/lib/types";
import type { QuestIdea } from "@/lib/quest-library";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DomainIcon } from "@/components/game/domain-icon";

type StepId =
  | "intro"
  | "name"
  | "baselines"
  | "priorities"
  | "visions"
  | "time"
  | "style"
  | "rhythm"
  | "promise"
  | "quests"
  | "finale";

const STEP_ORDER: StepId[] = [
  "intro",
  "name",
  "baselines",
  "priorities",
  "visions",
  "time",
  "style",
  "rhythm",
  "promise",
  "quests",
  "finale",
];

export function OnboardingFlow() {
  const router = useRouter();
  const completeOnboarding = useGame((s) => s.completeOnboarding);

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const step = STEP_ORDER[index];
  const patch = (p: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...p }));

  // Generated once we know priorities/baselines/budget; recomputed if they change.
  const suggested = useMemo(() => generateStarterQuests(draft), [draft]);
  const accepted = useMemo(
    () => suggested.filter((q) => !rejected.has(q.id)),
    [suggested, rejected],
  );

  const canAdvance = (): boolean => {
    switch (step) {
      case "name":
        return draft.displayName.trim().length > 0;
      case "priorities":
        return draft.priorities.length > 0;
      case "quests":
        return accepted.length > 0;
      default:
        return true;
    }
  };

  const go = (delta: number) => {
    setDirection(delta);
    setIndex((i) => Math.max(0, Math.min(STEP_ORDER.length - 1, i + delta)));
  };

  const finish = () => {
    setSaving(true);
    completeOnboarding({
      profile: draftToProfile(draft),
      quests: accepted.map(ideaToQuest),
      goals: generateStarterGoals(draft),
    });
    router.push("/dashboard?welcome=1");
  };

  const progress = index / (STEP_ORDER.length - 1);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pad-safe-top">
      {/* Progress */}
      <div className="pt-6 pb-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-violet to-cyan"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="text-2xs tracking-[0.14em] text-ink-faint uppercase">
            Step {index + 1} of {STEP_ORDER.length}
          </p>
          {/*
            An escape hatch for anyone who already has an account and has
            landed here on a new device. Without it, the only way to reach the
            restore is to complete an onboarding they have already done once.
          */}
          {index === 0 && (
            <Link
              href="/auth/sign-in"
              className="text-2xs font-semibold text-violet-soft underline underline-offset-2"
            >
              I already have an account
            </Link>
          )}
        </div>
      </div>

      {/* Step body */}
      <div className="relative flex-1 py-4">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === "intro" && <IntroStep />}
            {step === "name" && (
              <NameStep value={draft.displayName} onChange={(v) => patch({ displayName: v })} />
            )}
            {step === "baselines" && (
              <BaselinesStep
                values={draft.baselines}
                onChange={(domain, value) =>
                  patch({ baselines: { ...draft.baselines, [domain]: value } })
                }
              />
            )}
            {step === "priorities" && (
              <PrioritiesStep
                selected={draft.priorities}
                baselines={draft.baselines}
                onToggle={(domain) => {
                  const has = draft.priorities.includes(domain);
                  if (has) {
                    patch({ priorities: draft.priorities.filter((d) => d !== domain) });
                  } else if (draft.priorities.length < 3) {
                    patch({ priorities: [...draft.priorities, domain] });
                  }
                }}
              />
            )}
            {step === "visions" && (
              <VisionsStep
                priorities={draft.priorities}
                visions={draft.visions}
                onChange={(domain, text) =>
                  patch({ visions: { ...draft.visions, [domain]: text } })
                }
              />
            )}
            {step === "time" && (
              <TimeStep value={draft.dailyMinutes} onChange={(v) => patch({ dailyMinutes: v })} />
            )}
            {step === "style" && (
              <StyleStep
                value={draft.motivationStyle}
                onChange={(v) => patch({ motivationStyle: v })}
              />
            )}
            {step === "rhythm" && (
              <RhythmStep value={draft.rhythm} onChange={(v) => patch({ rhythm: v })} />
            )}
            {step === "promise" && (
              <PromiseStep
                name={draft.displayName}
                value={draft.promise}
                horizon={draft.promiseHorizonMonths}
                onChange={(v) => patch({ promise: v })}
                onHorizon={(v) => patch({ promiseHorizonMonths: v })}
              />
            )}
            {step === "quests" && (
              <QuestsStep
                ideas={suggested}
                rejected={rejected}
                onToggle={(id) =>
                  setRejected((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              />
            )}
            {step === "finale" && <FinaleStep draft={draft} questCount={accepted.length} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 flex items-center gap-3 bg-linear-to-t from-page via-page/95 to-transparent pt-6 pb-6 pad-safe-bottom">
        {index > 0 && (
          <Button variant="ghost" size="lg" onClick={() => go(-1)} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        {step === "finale" ? (
          <Button size="lg" fullWidth variant="gold" loading={saving} onClick={finish}>
            <Sparkles className="size-4" />
            Enter your world
          </Button>
        ) : (
          <Button size="lg" fullWidth disabled={!canAdvance()} onClick={() => go(1)}>
            {step === "intro" ? "Let's begin" : "Continue"}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Steps
 * ==================================================================== */

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-7">
      <h1 className="text-3xl leading-tight font-bold text-balance">{title}</h1>
      {subtitle && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink-mute text-pretty">{subtitle}</p>
      )}
    </header>
  );
}

function IntroStep() {
  return (
    <div className="pt-6 text-center">
      <div className="relative mx-auto mb-8 size-32">
        <div className="absolute inset-0 animate-pulse-glow rounded-full bg-violet/40 blur-2xl" />
        <div className="relative grid size-32 place-items-center rounded-full border border-violet/40 bg-surface">
          <Sparkles className="size-12 text-gold-ink" strokeWidth={1.5} />
        </div>
      </div>
      <h1 className="text-4xl leading-tight font-extrabold text-balance">
        Your life, as a game worth playing
      </h1>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink-mute text-pretty">
        Seven parts of your life, seven orbs to keep lit. We&apos;ll ask a few questions,
        build your board, and write you two things to keep.
      </p>
      <p className="mt-6 text-2xs tracking-wider text-ink-faint uppercase">
        Takes about three minutes
      </p>
    </div>
  );
}

function NameStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <StepHeader
        title="What should we call you?"
        subtitle="Your companion will use this. First name is plenty."
      />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your name"
        maxLength={40}
        className="w-full rounded-2xl border border-edge bg-surface px-5 py-4 text-lg outline-none placeholder:text-ink-faint focus:border-violet focus:ring-2 focus:ring-violet/25"
      />
    </div>
  );
}

function BaselinesStep({
  values,
  onChange,
}: {
  values: Record<DomainId, number>;
  onChange: (domain: DomainId, value: number) => void;
}) {
  return (
    <div>
      <StepHeader
        title="Where are you right now?"
        subtitle="Be honest rather than kind — this is only ever shown to you, and it's what everything else is measured against."
      />
      <div className="space-y-5">
        {DOMAINS.map((domain) => (
          <div
            key={domain.id}
            style={{
              ["--accent" as string]: domain.color,
              ["--accent-ink" as string]: domain.ink,
            }}
            className="panel rounded-2xl p-4"
          >
            <div className="mb-3 flex items-center gap-3">
              <span
                className="grid size-9 place-items-center rounded-xl"
                style={{
                  background: `color-mix(in oklab, ${domain.color} 16%, transparent)`,
                  color: domain.ink,
                }}
              >
                <DomainIcon domain={domain.id} className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{domain.name}</p>
                <p className="truncate text-2xs text-ink-faint">{domain.baselineQuestion}</p>
              </div>
              <div className="text-right">
                <p className="text-lg leading-none font-bold tabular-nums accent-text">
                  {values[domain.id]}
                </p>
                <p className="text-2xs text-ink-faint">{baselineWord(values[domain.id])}</p>
              </div>
            </div>
            <Slider
              value={values[domain.id]}
              onChange={(v) => onChange(domain.id, v)}
              color={domain.color}
              aria-label={`${domain.name} rating`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PrioritiesStep({
  selected,
  baselines,
  onToggle,
}: {
  selected: DomainId[];
  baselines: Record<DomainId, number>;
  onToggle: (domain: DomainId) => void;
}) {
  const full = selected.length >= 3;
  return (
    <div>
      <StepHeader
        title="What matters most, right now?"
        subtitle="Pick up to three. These get real quests; the rest stay dormant until you're ready — you can light them up any time."
      />
      <div className="grid grid-cols-2 gap-3">
        {DOMAINS.map((domain) => {
          const active = selected.includes(domain.id);
          const rank = selected.indexOf(domain.id) + 1;
          const disabled = !active && full;
          return (
            <button
              key={domain.id}
              type="button"
              onClick={() => onToggle(domain.id)}
              disabled={disabled}
              style={{
                ["--accent" as string]: domain.color,
                ["--accent-ink" as string]: domain.ink,
              }}
              className={cn(
                "tappable relative overflow-hidden rounded-2xl border p-4 text-left transition-all",
                active
                  ? "accent-border accent-glow bg-surface-2"
                  : "border-edge bg-surface hover:border-ink-faint",
                disabled && "cursor-not-allowed opacity-35",
              )}
            >
              {active && (
                <span className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full text-2xs font-bold text-on-accent"
                  style={{ background: domain.color }}>
                  {rank}
                </span>
              )}
              <span
                className="mb-2.5 grid size-10 place-items-center rounded-xl"
                style={{
                  background: `color-mix(in oklab, ${domain.color} ${active ? 22 : 12}%, transparent)`,
                  color: domain.ink,
                }}
              >
                <DomainIcon domain={domain.id} className="size-5" />
              </span>
              <p className="text-sm font-semibold">{domain.name}</p>
              <p className="mt-0.5 text-2xs text-ink-faint">{domain.tagline}</p>
              <p className="mt-2 text-2xs text-ink-mute">
                You rated it{" "}
                <span className="font-semibold accent-text">{baselines[domain.id]}/10</span>
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VisionsStep({
  priorities,
  visions,
  onChange,
}: {
  priorities: DomainId[];
  visions: Partial<Record<DomainId, string>>;
  onChange: (domain: DomainId, text: string) => void;
}) {
  if (priorities.length === 0) {
    return (
      <div>
        <StepHeader title="Nothing to picture yet" subtitle="Go back and choose at least one focus." />
      </div>
    );
  }
  return (
    <div>
      <StepHeader
        title="What does winning look like?"
        subtitle="A sentence each is enough. These become your anchor goals — and they go into your promise letter."
      />
      <div className="space-y-4">
        {priorities.map((id) => {
          const domain = getDomain(id);
          return (
            <div
              key={id}
              style={{
                ["--accent" as string]: domain.color,
                ["--accent-ink" as string]: domain.ink,
              }}
              className="panel rounded-2xl p-4"
            >
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="accent-text">
                  <DomainIcon domain={id} className="size-4.5" />
                </span>
                <p className="text-sm font-semibold">{domain.name}</p>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-ink-mute">{domain.visionPrompt}</p>
              <textarea
                value={visions[id] ?? ""}
                onChange={(e) => onChange(id, e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="In your own words…"
                className="w-full resize-none rounded-xl border border-edge bg-sunken px-3.5 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_25%,transparent)]"
              />
            </div>
          );
        })}
        <p className="text-center text-2xs text-ink-faint">
          Skip any you&apos;re not sure about — you can add them later.
        </p>
      </div>
    </div>
  );
}

function TimeStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <StepHeader
        title="How much time do you actually have?"
        subtitle="Answer for your busiest realistic day, not your best one. We'd rather build a board you can clear."
      />
      <div className="space-y-3">
        {TIME_BUDGETS.map((option) => {
          const active = value === option.minutes;
          return (
            <button
              key={option.minutes}
              type="button"
              onClick={() => onChange(option.minutes)}
              className={cn(
                "tappable flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                active
                  ? "border-violet bg-surface-2 shadow-[0_0_30px_-12px_var(--color-violet)]"
                  : "border-edge bg-surface hover:border-ink-faint",
              )}
            >
              <span
                className={cn(
                  "grid size-14 shrink-0 place-items-center rounded-xl text-sm font-bold",
                  active ? "bg-violet text-white" : "bg-surface-2 text-ink-mute",
                )}
              >
                {option.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.blurb}</span>
              </span>
              {active && <Check className="size-5 shrink-0 text-violet" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StyleStep({
  value,
  onChange,
}: {
  value: OnboardingDraft["motivationStyle"];
  onChange: (v: OnboardingDraft["motivationStyle"]) => void;
}) {
  return (
    <div>
      <StepHeader
        title="Who do you want in your corner?"
        subtitle="Your companion's personality. You can change this whenever you like."
      />
      <div className="space-y-3">
        {MOTIVATION_STYLES.map((style) => {
          const active = value === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onChange(style.id)}
              className={cn(
                "tappable w-full rounded-2xl border p-4 text-left transition-all",
                active
                  ? "border-violet bg-surface-2 shadow-[0_0_30px_-12px_var(--color-violet)]"
                  : "border-edge bg-surface hover:border-ink-faint",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{style.name}</p>
                {active && <Check className="size-4 shrink-0 text-violet" />}
              </div>
              <p className="mt-0.5 text-2xs text-ink-faint">{style.blurb}</p>
              <p
                className={cn(
                  "mt-3 rounded-xl px-3 py-2 text-xs italic",
                  active ? "bg-violet/12 text-ink-dim" : "bg-sunken text-ink-mute",
                )}
              >
                &ldquo;{style.sample}&rdquo;
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RhythmStep({
  value,
  onChange,
}: {
  value: OnboardingDraft["rhythm"];
  onChange: (v: OnboardingDraft["rhythm"]) => void;
}) {
  return (
    <div>
      <StepHeader
        title="When should we check in?"
        subtitle="This sets when reminders arrive. Nothing here is pushy — one gentle nudge at most."
      />
      <div className="grid grid-cols-2 gap-3">
        {RHYTHMS.map((rhythm) => {
          const active = value === rhythm.id;
          return (
            <button
              key={rhythm.id}
              type="button"
              onClick={() => onChange(rhythm.id)}
              className={cn(
                "tappable rounded-2xl border p-4 text-left transition-all",
                active
                  ? "border-violet bg-surface-2 shadow-[0_0_30px_-12px_var(--color-violet)]"
                  : "border-edge bg-surface hover:border-ink-faint",
              )}
            >
              <p className="text-sm font-semibold">{rhythm.name}</p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-faint">{rhythm.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HORIZONS = [3, 6, 12, 24];

function PromiseStep({
  name,
  value,
  horizon,
  onChange,
  onHorizon,
}: {
  name: string;
  value: string;
  horizon: number;
  onChange: (v: string) => void;
  onHorizon: (v: number) => void;
}) {
  const first = name.trim().split(" ")[0] || "you";
  return (
    <div>
      <StepHeader
        title="A promise to your future self"
        subtitle={`We'll turn this into a letter ${first} can download and come back to. Say the thing you actually mean.`}
      />
      <div className="panel rounded-2xl p-4">
        <p className="mb-3 text-xs tracking-wide text-ink-mute uppercase">
          In {horizon} months, I will have…
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          maxLength={600}
          placeholder="…stopped putting myself last. Got my sleep back. Actually finished the thing I keep talking about."
          className="w-full resize-none rounded-xl border border-edge bg-sunken px-3.5 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-faint focus:border-gold focus:ring-2 focus:ring-gold/25"
        />
        <div className="mt-4">
          <p className="mb-2 text-2xs tracking-wide text-ink-faint uppercase">Look back in</p>
          <div className="flex gap-2">
            {HORIZONS.map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => onHorizon(months)}
                className={cn(
                  "tappable flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-all",
                  horizon === months
                    ? "border-gold bg-gold/12 text-gold-ink"
                    : "border-edge bg-surface text-ink-mute",
                )}
              >
                {months}m
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-2xs text-ink-faint">
        Optional — but the people who write one tend to stick around.
      </p>
    </div>
  );
}

function QuestsStep({
  ideas,
  rejected,
  onToggle,
}: {
  ideas: QuestIdea[];
  rejected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const activeCount = ideas.filter((i) => !rejected.has(i.id)).length;
  return (
    <div>
      <StepHeader
        title="Your starting board"
        subtitle="Built from your answers and your time budget. Drop anything that doesn't fit — you can add more once you're in."
      />
      <div className="space-y-2.5">
        {ideas.map((idea) => {
          const domain = getDomain(idea.domain);
          const off = rejected.has(idea.id);
          return (
            <button
              key={idea.id}
              type="button"
              onClick={() => onToggle(idea.id)}
              style={{
                ["--accent" as string]: domain.color,
                ["--accent-ink" as string]: domain.ink,
              }}
              className={cn(
                "tappable flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all",
                off
                  ? "border-hairline/50 bg-surface/40 opacity-45"
                  : "accent-border bg-surface",
              )}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl"
                style={{
                  background: `color-mix(in oklab, ${domain.color} 15%, transparent)`,
                  color: domain.ink,
                }}
              >
                <DomainIcon domain={idea.domain} className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{idea.title}</span>
                <span className="block text-2xs text-ink-faint">
                  {domain.name} · {cadenceLabel(idea.cadence)}
                  {idea.target ? ` · ${idea.target} ${idea.unit ?? ""}` : ""}
                </span>
              </span>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  off ? "border-edge text-transparent" : "border-transparent text-on-accent",
                )}
                style={off ? undefined : { background: domain.color }}
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-2xs text-ink-faint">
        {activeCount} {activeCount === 1 ? "quest" : "quests"} to start with
        {activeCount > 5 ? " — that's ambitious, and that's allowed" : ""}
      </p>
    </div>
  );
}

function FinaleStep({ draft, questCount }: { draft: OnboardingDraft; questCount: number }) {
  const first = draft.displayName.trim().split(" ")[0] || "Player";
  return (
    <div className="pt-4 text-center">
      <div className="relative mx-auto mb-7 flex h-28 w-full items-center justify-center">
        {draft.priorities.map((id, i) => {
          const domain = getDomain(id);
          const offset = (i - (draft.priorities.length - 1) / 2) * 76;
          return (
            <motion.span
              key={id}
              initial={{ opacity: 0, scale: 0.4, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15 * i, type: "spring", stiffness: 220, damping: 18 }}
              className="absolute grid size-16 place-items-center rounded-full"
              style={{
                left: `calc(50% + ${offset}px)`,
                transform: "translateX(-50%)",
                background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${domain.color} 40%, var(--color-surface)), var(--color-surface))`,
                border: `1px solid color-mix(in oklab, ${domain.color} 50%, transparent)`,
                boxShadow: `0 0 34px -8px ${domain.color}`,
                color: domain.ink,
              }}
            >
              <DomainIcon domain={id} className="size-7" />
            </motion.span>
          );
        })}
      </div>

      <h1 className="text-3xl leading-tight font-bold text-balance">
        Your world is ready, {first}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-mute text-pretty">
        {questCount} {questCount === 1 ? "quest" : "quests"} on the board,{" "}
        {draft.priorities.length} {draft.priorities.length === 1 ? "orb" : "orbs"} lit, and a
        promise waiting for you in {draft.promiseHorizonMonths} months.
      </p>

      <div className="panel mt-7 rounded-2xl p-4 text-left">
        <p className="mb-1 text-2xs tracking-wide text-ink-faint uppercase">
          Two documents are being prepared
        </p>
        <ul className="mt-3 space-y-2 text-xs text-ink-dim">
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan" />
            <span>
              <span className="font-semibold text-ink">Your starting report</span> — where you are
              today across all seven domains.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
            <span>
              <span className="font-semibold text-ink">Promise to your future self</span> — your
              words, kept somewhere you&apos;ll find them again.
            </span>
          </li>
        </ul>
        <p className="mt-3 text-2xs text-ink-faint">
          Both live in your profile. Download them whenever you want.
        </p>
      </div>
    </div>
  );
}
