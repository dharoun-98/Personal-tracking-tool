import type { Cadence, Difficulty, DomainId, QuestKind, QuestWindow } from "./types";

export interface QuestIdea {
  id: string;
  domain: DomainId;
  title: string;
  detail?: string;
  kind: QuestKind;
  cadence: Cadence;
  difficulty: Difficulty;
  window: QuestWindow;
  target?: number;
  unit?: string;
  /** Realistic minutes per occurrence — used to fit quests to the time budget. */
  minutes: number;
  /**
   * Baseline band this suits, on the player's own 1–10 self-rating.
   * Someone rating health 2/10 should not be handed a 5k run.
   */
  band: [number, number];
}

const daily: Cadence = { kind: "daily" };
const weekly = (times: number): Cadence => ({ kind: "times-per-week", times });
const monthly = (times: number): Cadence => ({ kind: "times-per-month", times });

export const QUEST_LIBRARY: QuestIdea[] = [
  /* ---------------------------------------------------------- HEALTH */
  {
    id: "h-water",
    domain: "health",
    title: "Drink water",
    detail: "Glasses across the day. Start where you are.",
    kind: "count",
    cadence: daily,
    difficulty: 1,
    window: "anytime",
    target: 6,
    unit: "glasses",
    minutes: 2,
    band: [1, 10],
  },
  {
    id: "h-walk",
    domain: "health",
    title: "Move your body",
    detail: "A walk counts. Getting outside counts double on a bad day.",
    kind: "duration",
    cadence: daily,
    difficulty: 1,
    window: "anytime",
    target: 20,
    unit: "min",
    minutes: 20,
    band: [1, 6],
  },
  {
    id: "h-sleep",
    domain: "health",
    title: "Lights out on time",
    detail: "The single highest-leverage health habit there is.",
    kind: "binary",
    cadence: daily,
    difficulty: 2,
    window: "evening",
    minutes: 5,
    band: [1, 8],
  },
  {
    id: "h-train",
    domain: "health",
    title: "Proper workout",
    detail: "Strength, cardio, sport — whatever you'll actually keep doing.",
    kind: "duration",
    cadence: weekly(3),
    difficulty: 3,
    window: "anytime",
    target: 45,
    unit: "min",
    minutes: 45,
    band: [4, 10],
  },
  {
    id: "h-cook",
    domain: "health",
    title: "Cook a real meal",
    kind: "binary",
    cadence: weekly(4),
    difficulty: 2,
    window: "evening",
    minutes: 30,
    band: [2, 10],
  },
  {
    id: "h-stretch",
    domain: "health",
    title: "Stretch or mobilise",
    kind: "duration",
    cadence: daily,
    difficulty: 1,
    window: "morning",
    target: 10,
    unit: "min",
    minutes: 10,
    band: [1, 10],
  },
  {
    id: "h-nosnack",
    domain: "health",
    title: "No late-night snacking",
    kind: "binary",
    cadence: daily,
    difficulty: 2,
    window: "evening",
    minutes: 1,
    band: [1, 8],
  },

  /* ---------------------------------------------------------- WEALTH */
  {
    id: "w-track",
    domain: "wealth",
    title: "Log today's spending",
    detail: "Ninety seconds. This one habit changes the whole picture.",
    kind: "binary",
    cadence: daily,
    difficulty: 1,
    window: "evening",
    minutes: 3,
    band: [1, 8],
  },
  {
    id: "w-save",
    domain: "wealth",
    title: "Move money to savings",
    kind: "amount",
    cadence: monthly(1),
    difficulty: 2,
    window: "anytime",
    target: 100,
    unit: "saved",
    minutes: 10,
    band: [2, 10],
  },
  {
    id: "w-review",
    domain: "wealth",
    title: "Weekly money check-in",
    detail: "Look at the numbers on purpose instead of by accident.",
    kind: "duration",
    cadence: weekly(1),
    difficulty: 2,
    window: "anytime",
    target: 20,
    unit: "min",
    minutes: 20,
    band: [1, 10],
  },
  {
    id: "w-nospend",
    domain: "wealth",
    title: "No-spend day",
    kind: "binary",
    cadence: weekly(2),
    difficulty: 2,
    window: "anytime",
    minutes: 1,
    band: [1, 7],
  },
  {
    id: "w-learn",
    domain: "wealth",
    title: "Learn something about money",
    detail: "A chapter, an episode, one concept you didn't have yesterday.",
    kind: "duration",
    cadence: weekly(2),
    difficulty: 1,
    window: "anytime",
    target: 15,
    unit: "min",
    minutes: 15,
    band: [1, 9],
  },
  {
    id: "w-income",
    domain: "wealth",
    title: "Work on a second income stream",
    kind: "duration",
    cadence: weekly(3),
    difficulty: 3,
    window: "anytime",
    target: 45,
    unit: "min",
    minutes: 45,
    band: [5, 10],
  },

  /* ----------------------------------------------------- CONNECTIONS */
  {
    id: "c-reachout",
    domain: "connections",
    title: "Reach out to someone",
    detail: "A message, a voice note, a meme. Contact is contact.",
    kind: "binary",
    cadence: daily,
    difficulty: 1,
    window: "anytime",
    minutes: 5,
    band: [1, 10],
  },
  {
    id: "c-call",
    domain: "connections",
    title: "Actual phone call",
    detail: "Voice beats text. Fifteen minutes is plenty.",
    kind: "binary",
    cadence: weekly(2),
    difficulty: 2,
    window: "evening",
    minutes: 20,
    band: [1, 10],
  },
  {
    id: "c-meet",
    domain: "connections",
    title: "See someone in person",
    kind: "binary",
    cadence: weekly(1),
    difficulty: 3,
    window: "anytime",
    minutes: 90,
    band: [2, 10],
  },
  {
    id: "c-quality",
    domain: "connections",
    title: "Phone-free time with someone you love",
    kind: "duration",
    cadence: daily,
    difficulty: 2,
    window: "evening",
    target: 30,
    unit: "min",
    minutes: 30,
    band: [1, 10],
  },
  {
    id: "c-gratitude",
    domain: "connections",
    title: "Tell someone what they mean to you",
    kind: "binary",
    cadence: weekly(1),
    difficulty: 1,
    window: "anytime",
    minutes: 5,
    band: [1, 10],
  },
  {
    id: "c-new",
    domain: "connections",
    title: "Meet someone new",
    kind: "binary",
    cadence: monthly(2),
    difficulty: 3,
    window: "anytime",
    minutes: 60,
    band: [4, 10],
  },

  /* --------------------------------------------------------- PURPOSE */
  {
    id: "p-deep",
    domain: "purpose",
    title: "Deep work on the thing that matters",
    detail: "One block, no notifications, on the work only you can do.",
    kind: "duration",
    cadence: daily,
    difficulty: 3,
    window: "morning",
    target: 60,
    unit: "min",
    minutes: 60,
    band: [3, 10],
  },
  {
    id: "p-touch",
    domain: "purpose",
    title: "Touch the big project",
    detail: "Fifteen minutes still moves it. Momentum beats intensity.",
    kind: "duration",
    cadence: daily,
    difficulty: 1,
    window: "anytime",
    target: 15,
    unit: "min",
    minutes: 15,
    band: [1, 6],
  },
  {
    id: "p-priority",
    domain: "purpose",
    title: "Name today's one thing",
    detail: "Decide what would make today count before the day decides for you.",
    kind: "binary",
    cadence: daily,
    difficulty: 1,
    window: "morning",
    minutes: 3,
    band: [1, 10],
  },
  {
    id: "p-review",
    domain: "purpose",
    title: "Weekly review",
    detail: "What moved, what stalled, what's next.",
    kind: "duration",
    cadence: weekly(1),
    difficulty: 2,
    window: "evening",
    target: 30,
    unit: "min",
    minutes: 30,
    band: [1, 10],
  },
  {
    id: "p-ship",
    domain: "purpose",
    title: "Ship something",
    detail: "Publish, send, release. Finished beats perfect.",
    kind: "binary",
    cadence: weekly(1),
    difficulty: 3,
    window: "anytime",
    minutes: 60,
    band: [4, 10],
  },
  {
    id: "p-help",
    domain: "purpose",
    title: "Do something useful for someone else",
    kind: "binary",
    cadence: weekly(2),
    difficulty: 1,
    window: "anytime",
    minutes: 15,
    band: [1, 10],
  },

  /* ---------------------------------------------------------- GROWTH */
  {
    id: "g-read",
    domain: "growth",
    title: "Read",
    kind: "duration",
    cadence: daily,
    difficulty: 1,
    window: "evening",
    target: 20,
    unit: "min",
    minutes: 20,
    band: [1, 10],
  },
  {
    id: "g-practice",
    domain: "growth",
    title: "Practise your skill",
    detail: "The one you said you'd get good at.",
    kind: "duration",
    cadence: daily,
    difficulty: 2,
    window: "anytime",
    target: 30,
    unit: "min",
    minutes: 30,
    band: [2, 10],
  },
  {
    id: "g-course",
    domain: "growth",
    title: "Course or lesson",
    kind: "duration",
    cadence: weekly(3),
    difficulty: 2,
    window: "anytime",
    target: 40,
    unit: "min",
    minutes: 40,
    band: [3, 10],
  },
  {
    id: "g-notes",
    domain: "growth",
    title: "Write down what you learned",
    detail: "Learning you don't capture mostly evaporates.",
    kind: "binary",
    cadence: daily,
    difficulty: 1,
    window: "evening",
    minutes: 5,
    band: [1, 10],
  },
  {
    id: "g-hard",
    domain: "growth",
    title: "Do one thing that scares you slightly",
    kind: "binary",
    cadence: weekly(1),
    difficulty: 3,
    window: "anytime",
    minutes: 30,
    band: [4, 10],
  },
  {
    id: "g-teach",
    domain: "growth",
    title: "Teach or explain something you know",
    kind: "binary",
    cadence: weekly(1),
    difficulty: 2,
    window: "anytime",
    minutes: 25,
    band: [4, 10],
  },

  /* ----------------------------------------------------------- PEACE */
  {
    id: "z-breathe",
    domain: "peace",
    title: "Sit and breathe",
    detail: "Two minutes is a real practice. Start absurdly small.",
    kind: "duration",
    cadence: daily,
    difficulty: 1,
    window: "morning",
    target: 5,
    unit: "min",
    minutes: 5,
    band: [1, 10],
  },
  {
    id: "z-journal",
    domain: "peace",
    title: "Empty your head onto a page",
    kind: "binary",
    cadence: daily,
    difficulty: 1,
    window: "evening",
    minutes: 10,
    band: [1, 10],
  },
  {
    id: "z-gratitude",
    domain: "peace",
    title: "Three good things",
    detail: "Small ones count. Especially the small ones.",
    kind: "binary",
    cadence: daily,
    difficulty: 1,
    window: "evening",
    minutes: 3,
    band: [1, 10],
  },
  {
    id: "z-offline",
    domain: "peace",
    title: "Phone away for an hour",
    kind: "binary",
    cadence: daily,
    difficulty: 2,
    window: "evening",
    minutes: 60,
    band: [1, 10],
  },
  {
    id: "z-nature",
    domain: "peace",
    title: "Time outside, no agenda",
    kind: "duration",
    cadence: weekly(3),
    difficulty: 1,
    window: "anytime",
    target: 20,
    unit: "min",
    minutes: 20,
    band: [1, 10],
  },
  {
    id: "z-nothing",
    domain: "peace",
    title: "Deliberately do nothing",
    detail: "No podcast, no scrolling. Just be bored for a bit.",
    kind: "duration",
    cadence: weekly(3),
    difficulty: 2,
    window: "anytime",
    target: 15,
    unit: "min",
    minutes: 15,
    band: [3, 10],
  },

  /* ------------------------------------------------------------- FUN */
  {
    id: "f-play",
    domain: "fun",
    title: "Do something purely for fun",
    detail: "No productive justification allowed.",
    kind: "duration",
    cadence: daily,
    difficulty: 1,
    window: "evening",
    target: 30,
    unit: "min",
    minutes: 30,
    band: [1, 10],
  },
  {
    id: "f-hobby",
    domain: "fun",
    title: "Time on your hobby",
    kind: "duration",
    cadence: weekly(3),
    difficulty: 2,
    window: "anytime",
    target: 45,
    unit: "min",
    minutes: 45,
    band: [2, 10],
  },
  {
    id: "f-adventure",
    domain: "fun",
    title: "Do something you've never done",
    kind: "binary",
    cadence: monthly(1),
    difficulty: 3,
    window: "anytime",
    minutes: 120,
    band: [3, 10],
  },
  {
    id: "f-music",
    domain: "fun",
    title: "Music you love, properly listened to",
    kind: "binary",
    cadence: weekly(3),
    difficulty: 1,
    window: "anytime",
    minutes: 20,
    band: [1, 10],
  },
  {
    id: "f-laugh",
    domain: "fun",
    title: "Laugh with someone",
    kind: "binary",
    cadence: weekly(3),
    difficulty: 1,
    window: "anytime",
    minutes: 15,
    band: [1, 10],
  },
  {
    id: "f-create",
    domain: "fun",
    title: "Make something badly, on purpose",
    detail: "Draw, cook, build, write. It doesn't have to be good.",
    kind: "binary",
    cadence: weekly(2),
    difficulty: 2,
    window: "anytime",
    minutes: 30,
    band: [2, 10],
  },
];

export function ideasForDomain(domain: DomainId): QuestIdea[] {
  return QUEST_LIBRARY.filter((q) => q.domain === domain);
}

/**
 * Pick a starter set for one domain.
 *
 * Rules that matter more than the maths:
 *  - always include at least one very light quest, so day one is winnable;
 *  - respect the player's honest baseline (low score → gentler quests);
 *  - stay inside the daily time budget they told us they have.
 */
export function pickStarterQuests(
  domain: DomainId,
  baseline: number,
  minuteBudget: number,
  maxQuests: number,
): QuestIdea[] {
  const candidates = ideasForDomain(domain)
    .filter((q) => baseline >= q.band[0] && baseline <= q.band[1])
    .sort((a, b) => {
      // Cheapest and lightest first — the aim is early wins, not a bootcamp.
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
      return a.minutes - b.minutes;
    });

  const pool = candidates.length > 0 ? candidates : ideasForDomain(domain);
  const picked: QuestIdea[] = [];
  let spent = 0;

  for (const idea of pool) {
    if (picked.length >= maxQuests) break;
    // Weekly/monthly quests only cost a fraction of a day's budget.
    const perDay =
      idea.cadence.kind === "daily"
        ? idea.minutes
        : idea.cadence.kind === "specific-days"
          ? (idea.minutes * idea.cadence.days.length) / 7
          : idea.cadence.kind === "times-per-week"
            ? (idea.minutes * idea.cadence.times) / 7
            : (idea.minutes * idea.cadence.times) / 30;

    if (spent + perDay > minuteBudget && picked.length > 0) continue;
    picked.push(idea);
    spent += perDay;
  }

  // Never hand back an empty domain — one gentle quest beats nothing.
  if (picked.length === 0 && pool.length > 0) picked.push(pool[0]);
  return picked;
}
