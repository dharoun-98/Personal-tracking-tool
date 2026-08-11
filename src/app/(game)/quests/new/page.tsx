"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { DOMAINS, DOMAIN_IDS, getDomain } from "@/lib/domains";
import { ideasForDomain } from "@/lib/quest-library";
import { ideaToQuest } from "@/lib/onboarding";
import { cadenceLabel } from "@/lib/format";
import { useGame } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { Cadence, Difficulty, DomainId, QuestKind, QuestWindow } from "@/lib/types";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { DomainIcon } from "@/components/game/domain-icon";

const CADENCE_OPTIONS: Array<{ label: string; value: Cadence }> = [
  { label: "Every day", value: { kind: "daily" } },
  { label: "5× a week", value: { kind: "times-per-week", times: 5 } },
  { label: "3× a week", value: { kind: "times-per-week", times: 3 } },
  { label: "Once a week", value: { kind: "times-per-week", times: 1 } },
  { label: "2× a month", value: { kind: "times-per-month", times: 2 } },
  { label: "Once a month", value: { kind: "times-per-month", times: 1 } },
];

const KIND_OPTIONS: Array<{ label: string; value: QuestKind; hint: string }> = [
  { label: "Did it", value: "binary", hint: "Yes or no" },
  { label: "Count", value: "count", hint: "8 glasses" },
  { label: "Time", value: "duration", hint: "30 min" },
  { label: "Amount", value: "amount", hint: "$100" },
];

const WINDOW_OPTIONS: QuestWindow[] = ["morning", "afternoon", "evening", "anytime"];
const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string; xp: number }> = [
  { value: 1, label: "Light", xp: 10 },
  { value: 2, label: "Solid", xp: 20 },
  { value: 3, label: "Heavy", xp: 35 },
];

export default function NewQuestPage() {
  const router = useRouter();
  const addQuest = useGame((s) => s.addQuest);
  const existing = useGame((s) => s.quests);

  // Pre-select from ?domain= when arriving from a domain page. Read once, in
  // the initialiser — this subtree is client-only, so there's nothing to
  // mismatch against.
  const [domain, setDomain] = useState<DomainId>(() => {
    if (typeof window === "undefined") return "health";
    const requested = new URLSearchParams(window.location.search).get("domain");
    return requested && DOMAIN_IDS.includes(requested as DomainId)
      ? (requested as DomainId)
      : "health";
  });
  const [tab, setTab] = useState<"suggested" | "custom">("suggested");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [cadenceIndex, setCadenceIndex] = useState(0);
  const [kind, setKind] = useState<QuestKind>("binary");
  const [target, setTarget] = useState(20);
  const [unit, setUnit] = useState("min");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [window_, setWindow] = useState<QuestWindow>("anytime");

  // Don't offer a suggestion the player already has on their board.
  const takenTitles = useMemo(
    () => new Set(existing.filter((q) => !q.archivedAt).map((q) => q.title)),
    [existing],
  );
  const suggestions = useMemo(
    () => ideasForDomain(domain).filter((idea) => !takenTitles.has(idea.title)),
    [domain, takenTitles],
  );

  const meta = getDomain(domain);

  const saveCustom = () => {
    if (!title.trim()) return;
    addQuest({
      domain,
      title: title.trim(),
      detail: detail.trim() || undefined,
      cadence: CADENCE_OPTIONS[cadenceIndex].value,
      kind,
      difficulty,
      window: window_,
      target: kind === "binary" ? undefined : target,
      unit: kind === "binary" ? undefined : unit,
      source: "user",
    });
    router.push(`/domains/${domain}`);
  };

  return (
    <main
      className="space-y-6 pt-6"
      style={{
        ["--accent" as string]: meta.color,
        ["--accent-ink" as string]: meta.ink,
      }}
    >
      <Link
        href="/dashboard"
        className="tappable inline-flex items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <header>
        <h1 className="font-display text-2xl font-bold">Add a quest</h1>
        <p className="mt-1.5 text-sm text-ink-mute">
          Something small and repeatable beats something impressive and occasional.
        </p>
      </header>

      {/* --------------------------------------------------------- Domain */}
      <section>
        <SectionTitle>Which part of your life?</SectionTitle>
        <div className="scroll-row -mx-5 flex gap-2.5 px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {DOMAINS.map((d) => {
            const active = d.id === domain;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDomain(d.id)}
                className={cn(
                  "tappable flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all",
                  active ? "bg-surface-2" : "border-edge bg-surface text-ink-mute",
                )}
                style={
                  active
                    ? {
                        borderColor: `color-mix(in oklab, ${d.color} 55%, transparent)`,
                        color: d.ink,
                        boxShadow: `0 0 22px -10px color-mix(in oklab, ${d.color} calc(100% * var(--c-glow-strength)), transparent)`,
                      }
                    : undefined
                }
              >
                <DomainIcon domain={d.id} className="size-4" />
                {d.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------- Tabs */}
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {(["suggested", "custom"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTab(option)}
            className={cn(
              "tappable flex-1 rounded-xl py-2.5 text-xs font-semibold capitalize transition-colors",
              tab === option ? "bg-surface text-ink shadow-sm" : "text-ink-mute",
            )}
          >
            {option === "suggested" ? "Suggestions" : "Write your own"}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------- Suggestions */}
      {tab === "suggested" && (
        <section className="space-y-2.5">
          {suggestions.length === 0 ? (
            <Panel className="p-6 text-center">
              <p className="text-sm font-medium">
                You&apos;ve already taken every suggestion here.
              </p>
              <p className="mt-1.5 text-xs text-ink-mute">
                Write your own — you clearly know what you&apos;re doing.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => setTab("custom")}
              >
                Write your own
              </Button>
            </Panel>
          ) : (
            suggestions.map((idea) => (
              <button
                key={idea.id}
                type="button"
                onClick={() => {
                  addQuest({ ...ideaToQuest(idea), source: "suggested" });
                  router.push(`/domains/${domain}`);
                }}
                className="panel tappable flex w-full items-center gap-3 rounded-2xl p-3.5 text-left"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl"
                  style={{
                    background: `color-mix(in oklab, ${meta.color} 15%, transparent)`,
                    color: meta.ink,
                  }}
                >
                  <DomainIcon domain={idea.domain} className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{idea.title}</span>
                  <span className="block text-2xs text-ink-faint">
                    {cadenceLabel(idea.cadence)}
                    {idea.target ? ` · ${idea.target} ${idea.unit ?? ""}` : ""}
                  </span>
                </span>
                <Plus className="size-4 shrink-0 text-ink-faint" />
              </button>
            ))
          )}
        </section>
      )}

      {/* ---------------------------------------------------------- Custom */}
      {tab === "custom" && (
        <section className="space-y-5">
          <div>
            <label className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
              What is it?
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Walk after lunch"
              maxLength={80}
              className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
              Why it matters <span className="text-ink-faint">(optional)</span>
            </label>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Clears my head before the afternoon"
              maxLength={140}
              className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
              How often?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CADENCE_OPTIONS.map((option, i) => (
                <OptionChip
                  key={option.label}
                  active={cadenceIndex === i}
                  color={meta.color}
                  onClick={() => setCadenceIndex(i)}
                >
                  {option.label}
                </OptionChip>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
              How do you track it?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {KIND_OPTIONS.map((option) => (
                <OptionChip
                  key={option.value}
                  active={kind === option.value}
                  color={meta.color}
                  onClick={() => setKind(option.value)}
                >
                  <span className="block">{option.label}</span>
                  <span className="block text-[0.5625rem] opacity-60">{option.hint}</span>
                </OptionChip>
              ))}
            </div>
          </div>

          {kind !== "binary" && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
                  Target
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={target}
                  onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm tabular-nums outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
                  Unit
                </label>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="min"
                  maxLength={12}
                  className="w-full rounded-2xl border border-edge bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
              Effort
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <OptionChip
                  key={option.value}
                  active={difficulty === option.value}
                  color={meta.color}
                  onClick={() => setDifficulty(option.value)}
                >
                  <span className="block">{option.label}</span>
                  <span className="block text-[0.5625rem] opacity-60">
                    {option.xp} XP
                  </span>
                </OptionChip>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-2xs tracking-wide text-ink-mute uppercase">
              When?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {WINDOW_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  active={window_ === option}
                  color={meta.color}
                  onClick={() => setWindow(option)}
                >
                  <span className="capitalize">{option}</span>
                </OptionChip>
              ))}
            </div>
          </div>

          <Button
            variant="accent"
            size="lg"
            fullWidth
            disabled={!title.trim()}
            onClick={saveCustom}
          >
            <Check className="size-4" />
            Add to my board
          </Button>
        </section>
      )}
    </main>
  );
}

function OptionChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tappable rounded-xl border px-2 py-2.5 text-center text-xs font-medium transition-all",
        active ? "bg-surface-2" : "border-edge bg-surface text-ink-mute",
      )}
      style={
        active
          ? {
              borderColor: `color-mix(in oklab, ${color} 55%, transparent)`,
              color,
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
