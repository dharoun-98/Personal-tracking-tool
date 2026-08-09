"use client";

import { dayRange, fromDayKey, prettyDay } from "@/lib/date";
import { cn } from "@/lib/cn";
import type { DayKey } from "@/lib/types";

export interface HeatCell {
  date: DayKey;
  /** 0–1 completion for the day; null when nothing was scheduled. */
  value: number | null;
}

/**
 * Trailing-window activity grid.
 *
 * Empty days are drawn as faint outlines rather than left blank so the grid
 * reads as a calendar with gaps, not as missing data.
 */
export function DayHeatmap({
  cells,
  color = "var(--accent, var(--color-violet))",
  className,
}: {
  cells: HeatCell[];
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {cells.map((cell) => {
        const empty = cell.value === null;
        const value = cell.value ?? 0;
        const day = fromDayKey(cell.date).getDate();
        return (
          <span
            key={cell.date}
            title={`${prettyDay(cell.date)}${empty ? " — nothing due" : ` — ${Math.round(value * 100)}%`}`}
            className="grid size-7 place-items-center rounded-lg text-[0.5625rem] font-semibold tabular-nums transition-colors"
            style={{
              background: empty
                ? "transparent"
                : `color-mix(in oklab, ${color} ${Math.round(12 + value * 78)}%, var(--color-surface-2))`,
              border: empty
                ? "1px dashed var(--color-hairline)"
                : `1px solid color-mix(in oklab, ${color} ${Math.round(20 + value * 45)}%, transparent)`,
              color: value > 0.55 ? "var(--color-abyss)" : "var(--color-ink-faint)",
              boxShadow: value >= 1 ? `0 0 12px -3px ${color}` : undefined,
            }}
          >
            {day}
          </span>
        );
      })}
    </div>
  );
}

/** Convenience helper for building the last `days` cells from a scorer. */
export function buildCells(
  days: number,
  score: (date: DayKey) => number | null,
): HeatCell[] {
  return dayRange(days).map((date) => ({ date, value: score(date) }));
}
