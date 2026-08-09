import { DOMAINS } from "./domains";
import type {
  AchievementDef,
  DomainId,
  DomainState,
  LogEntry,
  Quest,
} from "./types";

export interface AchievementContext {
  quests: Quest[];
  logs: LogEntry[];
  domains: Record<DomainId, DomainState>;
  overallStreak: number;
  overallLevel: number;
  totalXp: number;
  /** Distinct days on which anything was logged. */
  activeDays: number;
  /** Days where every due quest was completed. */
  perfectDays: number;
  /** Days where at least one quest in every prioritised domain was done. */
  balancedDays: number;
}

interface AchievementRule extends AchievementDef {
  /** Returns 0–1 progress; 1 means unlocked. */
  progress: (ctx: AchievementContext) => number;
  /** Human-readable progress, e.g. "12 / 30 days". */
  label?: (ctx: AchievementContext) => string;
}

const ratio = (value: number, target: number) =>
  Math.max(0, Math.min(1, value / target));

/* -------------------------------------------------------------------- *
 * Cross-domain achievements
 * -------------------------------------------------------------------- */

const CORE: AchievementRule[] = [
  {
    id: "first-light",
    name: "First Light",
    description: "Log your very first quest.",
    domain: null,
    tier: "bronze",
    progress: (c) => (c.logs.length > 0 ? 1 : 0),
  },
  {
    id: "streak-3",
    name: "Kindling",
    description: "Three days in a row.",
    domain: null,
    tier: "bronze",
    progress: (c) => ratio(c.overallStreak, 3),
    label: (c) => `${Math.min(c.overallStreak, 3)} / 3 days`,
  },
  {
    id: "streak-7",
    name: "Steady Flame",
    description: "A full week without missing a day.",
    domain: null,
    tier: "silver",
    progress: (c) => ratio(c.overallStreak, 7),
    label: (c) => `${Math.min(c.overallStreak, 7)} / 7 days`,
  },
  {
    id: "streak-30",
    name: "Constellation",
    description: "Thirty consecutive days. This is who you are now.",
    domain: null,
    tier: "gold",
    progress: (c) => ratio(c.overallStreak, 30),
    label: (c) => `${Math.min(c.overallStreak, 30)} / 30 days`,
  },
  {
    id: "streak-100",
    name: "Supernova",
    description: "One hundred days in a row.",
    domain: null,
    tier: "mythic",
    progress: (c) => ratio(c.overallStreak, 100),
    label: (c) => `${Math.min(c.overallStreak, 100)} / 100 days`,
  },
  {
    id: "perfect-day",
    name: "Clean Sweep",
    description: "Finish everything due in a single day.",
    domain: null,
    tier: "bronze",
    progress: (c) => (c.perfectDays > 0 ? 1 : 0),
  },
  {
    id: "perfect-10",
    name: "Perfectionist",
    description: "Ten complete days.",
    domain: null,
    tier: "gold",
    progress: (c) => ratio(c.perfectDays, 10),
    label: (c) => `${Math.min(c.perfectDays, 10)} / 10 days`,
  },
  {
    id: "balanced-7",
    name: "In Balance",
    description: "Seven days touching every priority domain.",
    domain: null,
    tier: "gold",
    progress: (c) => ratio(c.balancedDays, 7),
    label: (c) => `${Math.min(c.balancedDays, 7)} / 7 days`,
  },
  {
    id: "level-5",
    name: "Finding Your Feet",
    description: "Reach overall level 5.",
    domain: null,
    tier: "bronze",
    progress: (c) => ratio(c.overallLevel, 5),
    label: (c) => `Level ${c.overallLevel} / 5`,
  },
  {
    id: "level-15",
    name: "Momentum",
    description: "Reach overall level 15.",
    domain: null,
    tier: "silver",
    progress: (c) => ratio(c.overallLevel, 15),
    label: (c) => `Level ${c.overallLevel} / 15`,
  },
  {
    id: "level-30",
    name: "Luminary",
    description: "Reach overall level 30.",
    domain: null,
    tier: "mythic",
    progress: (c) => ratio(c.overallLevel, 30),
    label: (c) => `Level ${c.overallLevel} / 30`,
  },
  {
    id: "all-seven-alive",
    name: "Whole Life",
    description: "Get all seven domains above 50 vitality at once.",
    domain: null,
    tier: "mythic",
    progress: (c) => {
      const alive = Object.values(c.domains).filter((d) => d.vitality >= 50).length;
      return ratio(alive, 7);
    },
    label: (c) =>
      `${Object.values(c.domains).filter((d) => d.vitality >= 50).length} / 7 domains`,
  },
  {
    id: "comeback",
    name: "Back From the Dark",
    description: "Return and log something after a break of a week or more.",
    domain: null,
    tier: "silver",
    secret: true,
    progress: (c) => {
      const days = [...new Set(c.logs.map((l) => l.date))].sort();
      for (let i = 1; i < days.length; i++) {
        const gap =
          (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000;
        if (gap >= 7) return 1;
      }
      return 0;
    },
  },
  {
    id: "century-logs",
    name: "Hundred Marks",
    description: "Log one hundred quests in total.",
    domain: null,
    tier: "silver",
    progress: (c) => ratio(c.logs.length, 100),
    label: (c) => `${Math.min(c.logs.length, 100)} / 100`,
  },
];

/* -------------------------------------------------------------------- *
 * Per-domain achievements, generated so all seven stay symmetrical
 * -------------------------------------------------------------------- */

const DOMAIN_TIERS: Array<{
  suffix: string;
  name: (domain: string) => string;
  description: (domain: string) => string;
  tier: AchievementDef["tier"];
  level: number;
}> = [
  {
    suffix: "spark",
    name: (d) => `${d}: Spark`,
    description: (d) => `Reach level 3 in ${d}.`,
    tier: "bronze",
    level: 3,
  },
  {
    suffix: "ember",
    name: (d) => `${d}: Ember`,
    description: (d) => `Reach level 8 in ${d}.`,
    tier: "silver",
    level: 8,
  },
  {
    suffix: "beacon",
    name: (d) => `${d}: Beacon`,
    description: (d) => `Reach level 15 in ${d}.`,
    tier: "gold",
    level: 15,
  },
];

const DOMAIN_RULES: AchievementRule[] = DOMAINS.flatMap((domain) =>
  DOMAIN_TIERS.map<AchievementRule>((t) => ({
    id: `${domain.id}-${t.suffix}`,
    name: t.name(domain.name),
    description: t.description(domain.name),
    domain: domain.id,
    tier: t.tier,
    progress: (c) => ratio(c.domains[domain.id]?.level.level ?? 1, t.level),
    label: (c) => `Level ${c.domains[domain.id]?.level.level ?? 1} / ${t.level}`,
  })),
);

export const ACHIEVEMENTS: AchievementRule[] = [...CORE, ...DOMAIN_RULES];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: string): AchievementRule | undefined {
  return BY_ID.get(id);
}

export interface AchievementProgress {
  def: AchievementDef;
  progress: number;
  unlocked: boolean;
  label?: string;
}

export function evaluateAchievements(
  ctx: AchievementContext,
): AchievementProgress[] {
  return ACHIEVEMENTS.map((rule) => {
    const progress = rule.progress(ctx);
    return {
      def: rule,
      progress,
      unlocked: progress >= 1,
      label: rule.label?.(ctx),
    };
  });
}

/** IDs newly satisfied that aren't already in `alreadyUnlocked`. */
export function newlyUnlocked(
  ctx: AchievementContext,
  alreadyUnlocked: string[],
): string[] {
  const known = new Set(alreadyUnlocked);
  return evaluateAchievements(ctx)
    .filter((a) => a.unlocked && !known.has(a.def.id))
    .map((a) => a.def.id);
}
