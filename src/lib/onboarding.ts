import { DOMAIN_IDS, getDomain } from "./domains";
import { pickStarterQuests, type QuestIdea } from "./quest-library";
import { localTimezone } from "./date";
import { uid } from "./cn";
import type {
  CheckInRhythm,
  DomainId,
  Goal,
  MotivationStyle,
  PlayerProfile,
  Quest,
} from "./types";

export interface OnboardingDraft {
  displayName: string;
  baselines: Record<DomainId, number>;
  priorities: DomainId[];
  visions: Partial<Record<DomainId, string>>;
  dailyMinutes: number;
  motivationStyle: MotivationStyle;
  rhythm: CheckInRhythm;
  promise: string;
  promiseHorizonMonths: number;
}

export function emptyDraft(): OnboardingDraft {
  return {
    displayName: "",
    baselines: Object.fromEntries(DOMAIN_IDS.map((d) => [d, 5])) as Record<
      DomainId,
      number
    >,
    priorities: [],
    visions: {},
    dailyMinutes: 45,
    motivationStyle: "cheerleader",
    rhythm: "flexible",
    promise: "",
    promiseHorizonMonths: 12,
  };
}

/** Hard cap on the starter set. More than this and day one stops being winnable. */
const MAX_STARTER_QUESTS = 8;

/**
 * Turn onboarding answers into a playable starting board.
 *
 * Deliberately conservative: only the player's top priorities get quests, and
 * the total is capped. Everything else starts dormant, which the orb UI reads
 * as an invitation rather than a backlog. Adding is easy; deleting a wall of
 * auto-generated habits on day two is how people quit.
 */
export function generateStarterQuests(draft: OnboardingDraft): QuestIdea[] {
  const focus = draft.priorities.slice(0, 3);
  if (focus.length === 0) return [];

  // Split the daily time budget across focus domains, weighted by rank.
  const weights = [0.45, 0.33, 0.22].slice(0, focus.length);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const perDomainMax = focus.length >= 3 ? 3 : focus.length === 2 ? 4 : 5;
  const picked: QuestIdea[] = [];

  focus.forEach((domain, i) => {
    const budget = (draft.dailyMinutes * weights[i]) / weightSum;
    picked.push(
      ...pickStarterQuests(domain, draft.baselines[domain], budget, perDomainMax),
    );
  });

  return picked.slice(0, MAX_STARTER_QUESTS);
}

export function ideaToQuest(idea: QuestIdea): Quest {
  return {
    id: uid("q"),
    domain: idea.domain,
    title: idea.title,
    detail: idea.detail,
    cadence: idea.cadence,
    kind: idea.kind,
    difficulty: idea.difficulty,
    window: idea.window,
    target: idea.target,
    unit: idea.unit,
    createdAt: new Date().toISOString(),
    source: "onboarding",
  };
}

/** One anchor goal per priority domain, seeded from the player's own words. */
export function generateStarterGoals(draft: OnboardingDraft): Goal[] {
  return draft.priorities.slice(0, 3).flatMap<Goal>((domain) => {
    const vision = draft.visions[domain]?.trim();
    if (!vision) return [];
    return [
      {
        id: uid("g"),
        domain,
        title: vision.length > 90 ? `${vision.slice(0, 87)}…` : vision,
        why: `Your ${getDomain(domain).name.toLowerCase()} vision from day one.`,
        createdAt: new Date().toISOString(),
        source: "onboarding",
      },
    ];
  });
}

export function draftToProfile(draft: OnboardingDraft): PlayerProfile {
  return {
    displayName: draft.displayName.trim() || "Player",
    priorities: draft.priorities,
    baselines: draft.baselines,
    visions: draft.visions,
    motivationStyle: draft.motivationStyle,
    rhythm: draft.rhythm,
    dailyMinutes: draft.dailyMinutes,
    promise: draft.promise.trim() || undefined,
    promiseHorizonMonths: draft.promiseHorizonMonths,
    timezone: localTimezone(),
    createdAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------- *
 * Copy used by the flow
 * -------------------------------------------------------------------- */

export const MOTIVATION_STYLES: Array<{
  id: MotivationStyle;
  name: string;
  blurb: string;
  sample: string;
}> = [
  {
    id: "cheerleader",
    name: "The Cheerleader",
    blurb: "Warm, enthusiastic, celebrates everything.",
    sample: "Yes! That's another one down. You're on a roll!",
  },
  {
    id: "coach",
    name: "The Coach",
    blurb: "Direct and practical. No fluff, no lectures.",
    sample: "Done. One left on the board. Finish it.",
  },
  {
    id: "sage",
    name: "The Sage",
    blurb: "Calm and reflective. Never in a hurry.",
    sample: "That's done. Notice how it feels.",
  },
  {
    id: "rival",
    name: "The Rival",
    blurb: "Playfully competitive. Dares you to beat yesterday.",
    sample: "Not bad. Think you can beat yesterday?",
  },
];

export const RHYTHMS: Array<{ id: CheckInRhythm; name: string; blurb: string }> = [
  { id: "morning", name: "Mornings", blurb: "Plan the day, check in early." },
  { id: "evening", name: "Evenings", blurb: "Log what happened, reflect at night." },
  { id: "both", name: "Both ends", blurb: "A quick plan and a quick review." },
  { id: "flexible", name: "Whenever", blurb: "No fixed time. Nudge me lightly." },
];

export const TIME_BUDGETS = [
  { minutes: 15, label: "15 min", blurb: "Tight schedule. Small, steady moves." },
  { minutes: 30, label: "30 min", blurb: "A realistic daily slot." },
  { minutes: 45, label: "45 min", blurb: "Room for something substantial." },
  { minutes: 90, label: "90 min+", blurb: "You've got space. Let's use it." },
];

export function baselineWord(score: number): string {
  if (score <= 2) return "Struggling";
  if (score <= 4) return "Needs work";
  if (score <= 6) return "Okay";
  if (score <= 8) return "Good";
  return "Thriving";
}
