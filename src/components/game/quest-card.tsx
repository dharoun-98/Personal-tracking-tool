"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus, SkipForward, Undo2 } from "lucide-react";
import { getDomain } from "@/lib/domains";
import { cadenceLabel, targetLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DueQuest, LogStatus } from "@/lib/types";
import { DomainIcon } from "./domain-icon";
import { StreakFlame } from "./streak-flame";

interface QuestCardProps {
  item: DueQuest;
  onLog: (status: LogStatus, value?: number) => void;
  onClear: () => void;
  /** Hides the domain glyph when the card is already inside a domain view. */
  compact?: boolean;
}

/**
 * The single most-used control in the app.
 *
 * Friction budget: completing a quest must be exactly one tap. Anything richer
 * (partial credit, a specific value, skipping) lives behind an optional expand,
 * so the common case stays instant and the rare case stays possible.
 */
export function QuestCard({ item, onLog, onClear, compact = false }: QuestCardProps) {
  const { quest, log, streak, periodDone, periodTarget } = item;
  const meta = getDomain(quest.domain);
  const done = log?.status === "done";
  const skipped = log?.status === "skipped";
  const partial = log?.status === "partial";

  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState<number>(log?.value ?? quest.target ?? 1);

  const needsValue = quest.kind !== "binary";
  const step = quest.kind === "amount" ? 10 : quest.kind === "duration" ? 5 : 1;

  const handlePrimary = () => {
    if (done) {
      onClear();
      return;
    }
    // Value-based quests still complete in one tap — we assume they hit target.
    onLog("done", needsValue ? (quest.target ?? undefined) : undefined);
  };

  return (
    <motion.div
      layout
      style={{
        ["--accent" as string]: meta.color,
        ["--accent-ink" as string]: meta.ink,
      }}
      className={cn(
        "panel relative overflow-hidden rounded-2xl transition-colors",
        done && "border-[color-mix(in_oklab,var(--accent)_38%,transparent)]",
        skipped && "opacity-55",
      )}
    >
      {/* Left accent rail — the only domain colour on the card when idle. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 transition-opacity"
        style={{
          background: meta.color,
          opacity: done ? 1 : 0.42,
          boxShadow: done ? `0 0 16px -2px ${meta.color}` : undefined,
        }}
      />

      {/* Completion wash */}
      <AnimatePresence>
        {done && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(100deg, color-mix(in oklab, ${meta.color} 12%, transparent), transparent 60%)`,
            }}
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-3 py-3 pr-3 pl-4">
        {!compact && (
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl"
            style={{
              background: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
              color: meta.ink,
            }}
          >
            <DomainIcon domain={quest.domain} className="size-4.5" />
          </span>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="tappable min-h-11 min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <p
            className={cn(
              "truncate text-sm font-medium",
              done ? "text-ink-dim line-through decoration-ink-faint" : "text-ink",
            )}
          >
            {quest.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-2xs text-ink-faint">{cadenceLabel(quest.cadence)}</span>
            {targetLabel(quest) && (
              <span className="text-2xs text-ink-faint">· {targetLabel(quest)}</span>
            )}
            {periodTarget > 1 && (
              <span className="text-2xs accent-text font-semibold">
                {periodDone}/{periodTarget} this {quest.cadence.kind === "times-per-week" ? "week" : "month"}
              </span>
            )}
            {streak > 0 && <StreakFlame days={streak} size="sm" />}
            {partial && <span className="text-2xs text-warn">partial</span>}
            {skipped && <span className="text-2xs text-ink-faint">skipped</span>}
          </div>
        </button>

        {/* One-tap completion */}
        <button
          type="button"
          onClick={handlePrimary}
          aria-label={
            done
              ? `Undo completion for ${quest.title}`
              : log
                ? `Change ${quest.title} to complete`
                : `Complete ${quest.title}`
          }
          className={cn(
            "tappable grid size-11 shrink-0 place-items-center rounded-full border-2 transition-all",
            done
              ? "border-transparent text-on-accent"
              : "border-hairline text-ink-faint hover:border-[var(--accent)] hover:text-[var(--accent)]",
          )}
          style={done ? { background: meta.color, boxShadow: `0 0 20px -4px ${meta.color}` } : undefined}
        >
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.span
                key="done"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                <Check className="size-5" strokeWidth={3} />
              </motion.span>
            ) : (
              <motion.span
                key="todo"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <Check className="size-5 opacity-40" strokeWidth={2.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Expanded options — deliberately secondary. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-hairline/60 px-4 py-3">
              {quest.detail && (
                <p className="text-xs leading-relaxed text-ink-mute">{quest.detail}</p>
              )}

              {needsValue && (
                <div className="flex items-center gap-3">
                  <span className="text-2xs tracking-wide text-ink-mute uppercase">
                    How much?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setValue((v) => Math.max(0, v - step))}
                      aria-label="Decrease"
                      className="tappable grid size-11 place-items-center rounded-lg bg-surface-2 text-ink-dim"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="min-w-14 text-center text-sm font-semibold tabular-nums">
                      {value}
                      <span className="ml-1 text-2xs text-ink-faint">{quest.unit}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setValue((v) => v + step)}
                      aria-label="Increase"
                      className="tappable grid size-11 place-items-center rounded-lg bg-surface-2 text-ink-dim"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {needsValue && (
                  <button
                    type="button"
                    onClick={() => {
                      const hitTarget = quest.target == null || value >= quest.target;
                      onLog(hitTarget ? "done" : "partial", value);
                      setExpanded(false);
                    }}
                    className="tappable min-h-11 rounded-xl px-3 py-2 text-xs font-semibold text-on-accent"
                    style={{ background: meta.color }}
                  >
                    Log {value} {quest.unit}
                  </button>
                )}
                {!needsValue && !done && (
                  <button
                    type="button"
                    onClick={() => {
                      onLog("partial");
                      setExpanded(false);
                    }}
                    className="tappable min-h-11 rounded-xl bg-surface-2 px-3 py-2 text-xs font-medium text-ink-dim"
                  >
                    Partly did it
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onLog("skipped");
                    setExpanded(false);
                  }}
                  className="tappable inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs font-medium text-ink-mute"
                >
                  <SkipForward className="size-3.5" />
                  Skip today
                </button>
                {log && (
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setExpanded(false);
                    }}
                    className="tappable inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-faint"
                  >
                    <Undo2 className="size-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
