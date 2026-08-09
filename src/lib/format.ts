import type { Cadence, Quest, QuestWindow } from "./types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function cadenceLabel(cadence: Cadence): string {
  switch (cadence.kind) {
    case "daily":
      return "Every day";
    case "times-per-week":
      return cadence.times === 1 ? "Once a week" : `${cadence.times}× a week`;
    case "times-per-month":
      return cadence.times === 1 ? "Once a month" : `${cadence.times}× a month`;
    case "specific-days": {
      const days = [...cadence.days].sort();
      if (days.length === 7) return "Every day";
      if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) return "Weekdays";
      if (days.length === 2 && days.includes(0) && days.includes(6)) return "Weekends";
      return days.map((d) => DAY_NAMES[d]).join(", ");
    }
  }
}

export function windowLabel(window: QuestWindow): string {
  switch (window) {
    case "morning":
      return "Morning";
    case "afternoon":
      return "Afternoon";
    case "evening":
      return "Evening";
    case "anytime":
      return "Anytime";
  }
}

/** "30 min", "8 glasses", "$100" — the target rendered for a quest. */
export function targetLabel(quest: Quest): string | null {
  if (quest.target == null) return null;
  if (quest.kind === "amount") return `${quest.target} ${quest.unit ?? ""}`.trim();
  return `${quest.target} ${quest.unit ?? ""}`.trim();
}

export function difficultyLabel(difficulty: 1 | 2 | 3): string {
  return difficulty === 1 ? "Light" : difficulty === 2 ? "Solid" : "Heavy";
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** Compact number for XP counters: 1240 → "1.2k". */
export function compactNumber(n: number): string {
  if (Math.abs(n) < 1000) return String(n);
  if (Math.abs(n) < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}
