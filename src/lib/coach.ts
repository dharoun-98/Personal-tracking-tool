import { getDomain } from "./domains";
import { timeOfDay, todayKey } from "./date";
import type {
  DomainId,
  DomainState,
  DueQuest,
  LevelInfo,
  MotivationStyle,
  PlayerProfile,
  Quest,
} from "./types";

/* ==================================================================== *
 * The coach.
 *
 * Entirely rule-based — no model, no API key, no network. Every line is
 * written up front and selected deterministically, which means it is fast,
 * free, works offline, and can never say anything unhinged.
 *
 * The design constraint that matters most: it must never nag. Every rule
 * declares a cooldown, most fire at most once a day, and nothing in here
 * uses shame as a motivator. If the player misses a day, the app's job is
 * to make coming back easy — not to make leaving feel expensive.
 * ==================================================================== */

export type CoachTone =
  | "greet"
  | "celebrate"
  | "milestone"
  | "nudge"
  | "ask"
  | "motivate"
  | "reflect"
  | "rest";

export interface CoachAction {
  label: string;
  kind: "open-today" | "open-domain" | "log-quest" | "open-journey" | "dismiss";
  payload?: string;
}

export interface CoachMessage {
  /** Rule id — also the cooldown key. */
  id: string;
  tone: CoachTone;
  text: string;
  action?: CoachAction;
  /** Higher wins when several rules match. */
  priority: number;
  cooldownMinutes: number;
  /** True for celebrations that should fire confetti/particles. */
  festive?: boolean;
}

export interface CoachContext {
  now: Date;
  profile: PlayerProfile;
  today: DueQuest[];
  domains: Record<DomainId, DomainState>;
  overallStreak: number;
  level: LevelInfo;
  totalLogs: number;
  /** Set immediately after a check-in so the coach can react to it. */
  justCompleted?: {
    quest: Quest;
    streak: number;
    xp: number;
    leveledUp: boolean;
    domainLeveledUp: boolean;
  };
  /** ISO timestamp of the player's previous session. */
  lastSeenAt?: string;
  /** ruleId → ISO timestamp it last fired. */
  cooldowns: Record<string, string>;
}

/* -------------------------------------------------------------------- *
 * Deterministic variation
 * -------------------------------------------------------------------- */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Pick a line deterministically from `seed`, so the mascot doesn't reshuffle
 * its own dialogue on every React re-render, but still varies day to day.
 */
function pick<T>(options: T[], seed: string): T {
  return options[hash(seed) % options.length];
}

type StyledLines = Record<MotivationStyle, string[]>;

function styled(lines: StyledLines, style: MotivationStyle, seed: string): string {
  return pick(lines[style], seed);
}

/* -------------------------------------------------------------------- *
 * Copy banks
 * -------------------------------------------------------------------- */

const GREETINGS: StyledLines = {
  cheerleader: [
    "There you are! Ready when you are.",
    "Hey! Good to see you back.",
    "Look who it is. Let's make today count.",
  ],
  coach: [
    "Right — here's where things stand.",
    "Back at it. Let's look at today.",
    "Good. Let's get through this.",
  ],
  sage: [
    "Welcome back. No rush.",
    "Here we are again. Take your time.",
    "Whenever you're ready.",
  ],
  rival: [
    "Oh, you showed up. Interesting.",
    "Back for more? Let's see it.",
    "Think you can beat yesterday?",
  ],
};

const QUEST_DONE: StyledLines = {
  cheerleader: [
    "Yes! That's another one down.",
    "Love that. Keep it rolling.",
    "Nailed it. You're on a roll.",
  ],
  coach: ["Done. Next.", "Good. That's the work.", "Logged. Solid."],
  sage: [
    "That's done. Notice how it feels.",
    "One more thing tended to.",
    "Quietly, that mattered.",
  ],
  rival: ["Not bad. Again?", "Fine, that was decent.", "Okay, you're keeping up."],
};

const ALL_DONE: StyledLines = {
  cheerleader: [
    "Everything's done. Every single thing. Go enjoy your evening!",
    "That's a clean sweep. Genuinely well played.",
    "All clear! You get to stop now — properly stop.",
  ],
  coach: [
    "Board's clear. That's a complete day.",
    "Everything logged. That's what a good day looks like.",
    "Done and done. Rest is part of it.",
  ],
  sage: [
    "Everything you set out to do is done. Let the day be finished.",
    "Nothing left. Enjoy the quiet.",
    "Complete. You can put it down now.",
  ],
  rival: [
    "Perfect day. Annoyingly good.",
    "Clean sweep. I'll allow it.",
    "All of them? Alright, respect.",
  ],
};

const ALMOST: StyledLines = {
  cheerleader: [
    "One left! You've basically done it.",
    "Just one more and today's a full house.",
    "So close — one to go.",
  ],
  coach: ["One left. Finish it.", "Last one on the board.", "One more and you're clear."],
  sage: ["One thing remains, whenever you'd like.", "Just one left. No pressure.", "One more, if it fits."],
  rival: ["One left. Don't fold now.", "You're not stopping at one away, surely.", "Last one. Prove it."],
};

const GENTLE_NUDGE: StyledLines = {
  cheerleader: [
    "Nothing logged yet — want to knock out an easy one?",
    "Blank slate so far. Pick the smallest thing?",
    "Fresh day! Start with whatever's easiest.",
  ],
  coach: [
    "Nothing logged yet. Pick the easiest one and go.",
    "Board's empty. Start small, start now.",
    "One item. That's all it takes to start.",
  ],
  sage: [
    "Nothing yet today, and that's alright. One small thing?",
    "The day's still open. Begin wherever you like.",
    "No pressure. One gentle thing would be enough.",
  ],
  rival: [
    "Zero so far. Yesterday's you is ahead.",
    "Still on nothing? Come on.",
    "The board's empty. Fix that.",
  ],
};

const MISSED_DAY: StyledLines = {
  cheerleader: [
    "Yesterday got away — happens to everyone. Today's brand new.",
    "Missed one, no big deal. Let's just start again.",
    "Clean slate today. You've got this.",
  ],
  coach: [
    "Yesterday's gone. Today's what counts.",
    "Missed a day. Don't make it two — one small thing does it.",
    "Reset. One item on the board today.",
  ],
  sage: [
    "A day passed untouched. That's allowed. Begin again gently.",
    "Missing a day isn't failing. Continuing is the whole practice.",
    "You're back. That's the part that matters.",
  ],
  rival: [
    "Took a day off, did we? Let's fix that.",
    "Streak's gone. New one starts today.",
    "Alright, rebuild it. From one.",
  ],
};

const COMEBACK: StyledLines = {
  cheerleader: [
    "You're back! No guilt here — let's pick it up.",
    "Missed you! Ready when you are.",
    "Hey stranger. Let's ease back in.",
  ],
  coach: [
    "Been a while. Let's restart with something small.",
    "You're back. Start light, rebuild from there.",
    "No autopsy needed. One thing today.",
  ],
  sage: [
    "It's been a little while. Nothing is lost — start where you are.",
    "Life happens. The path is still here.",
    "Welcome back. We begin from today, not from the gap.",
  ],
  rival: [
    "Look who resurfaced. Ready to compete with yourself again?",
    "Long break. Let's see if you've still got it.",
    "You're back. Prove it wasn't a fluke before.",
  ],
};

const REST: StyledLines = {
  cheerleader: [
    "Everything's handled. Go do something fun — that counts too.",
    "You're done for the day. Genuinely, go rest.",
    "Nothing left! Enjoy it.",
  ],
  coach: ["Day's complete. Recovery is part of the plan.", "You're done. Switch off.", "Nothing left. Rest properly."],
  sage: ["The day is complete. Let yourself stop.", "Nothing more is needed today.", "Rest is not the opposite of progress."],
  rival: ["Done already? Fine. Rest up — tomorrow's another round.", "You win today. Enjoy it.", "Nothing left to beat. Go rest."],
};

/* -------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------- */

function minutesSince(iso: string | undefined, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then) / 60000;
}

const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

function streakLine(streak: number, style: MotivationStyle, seed: string): string {
  const base: StyledLines = {
    cheerleader: [
      `${streak} days in a row. That's a real streak now!`,
      `${streak} straight days. You're building something.`,
    ],
    coach: [
      `${streak} days. That's consistency, not luck.`,
      `${streak}-day streak. This is the part that compounds.`,
    ],
    sage: [
      `${streak} days of showing up. Quietly, that changes a person.`,
      `${streak} days. The practice is becoming who you are.`,
    ],
    rival: [
      `${streak} days. Okay, you're actually good at this.`,
      `${streak} in a row. Don't get comfortable.`,
    ],
  };
  return styled(base, style, seed);
}

/* -------------------------------------------------------------------- *
 * The rules
 * -------------------------------------------------------------------- */

function candidates(ctx: CoachContext): CoachMessage[] {
  const { profile, today, now } = ctx;
  const style = profile.motivationStyle;
  const day = todayKey();
  const part = timeOfDay(now);
  const out: CoachMessage[] = [];

  const due = today.filter((t) => t.due);
  const done = due.filter((t) => t.log && t.log.status !== "skipped");
  const remaining = due.filter((t) => !t.log || t.log.status === "skipped");
  const firstName = profile.displayName.split(" ")[0] || "friend";

  /* --- Reactions to something that just happened ------------------- */

  if (ctx.justCompleted?.leveledUp) {
    out.push({
      id: "level-up",
      tone: "milestone",
      priority: 100,
      cooldownMinutes: 0,
      festive: true,
      text: `Level ${ctx.level.level}. You just levelled up, ${firstName}.`,
      action: { label: "See your journey", kind: "open-journey" },
    });
  }

  if (ctx.justCompleted?.domainLeveledUp) {
    const d = getDomain(ctx.justCompleted.quest.domain);
    out.push({
      id: "domain-level-up",
      tone: "milestone",
      priority: 95,
      cooldownMinutes: 0,
      festive: true,
      text: `${d.name} just levelled up. That orb is burning brighter.`,
      action: { label: `Open ${d.name}`, kind: "open-domain", payload: d.id },
    });
  }

  if (ctx.justCompleted && remaining.length === 0 && due.length > 0) {
    out.push({
      id: "all-done",
      tone: "celebrate",
      priority: 90,
      cooldownMinutes: 60 * 6,
      festive: true,
      text: styled(ALL_DONE, style, day),
    });
  }

  if (ctx.justCompleted) {
    const streak = ctx.justCompleted.streak;
    const text =
      streak >= 3
        ? `${styled(QUEST_DONE, style, day + ctx.justCompleted.quest.id)} ${streak} in a row on that one.`
        : styled(QUEST_DONE, style, day + ctx.justCompleted.quest.id);
    out.push({
      id: "quest-done",
      tone: "celebrate",
      priority: 80,
      cooldownMinutes: 0,
      festive: true,
      text,
    });
  }

  /* --- Streak milestones ------------------------------------------- */

  if (STREAK_MILESTONES.includes(ctx.overallStreak) && done.length > 0) {
    out.push({
      id: `streak-${ctx.overallStreak}`,
      tone: "milestone",
      priority: 85,
      cooldownMinutes: 60 * 20,
      festive: true,
      text: streakLine(ctx.overallStreak, style, day),
    });
  }

  /* --- First run ---------------------------------------------------- */

  if (ctx.totalLogs === 0) {
    out.push({
      id: "first-day",
      tone: "greet",
      priority: 70,
      cooldownMinutes: 60 * 3,
      text: `This is your board, ${firstName}. Tap anything to log it — start with whatever's easiest.`,
      action: { label: "Show me today", kind: "open-today" },
    });
  }

  /* --- Coming back after a gap -------------------------------------- */

  const awayMinutes = minutesSince(ctx.lastSeenAt, now);
  if (ctx.totalLogs > 0 && awayMinutes > 60 * 24 * 3) {
    out.push({
      id: "comeback",
      tone: "motivate",
      priority: 68,
      cooldownMinutes: 60 * 12,
      text: styled(COMEBACK, style, day),
      action: { label: "Ease back in", kind: "open-today" },
    });
  }

  /* --- Almost finished ---------------------------------------------- */

  if (remaining.length === 1 && done.length > 0) {
    out.push({
      id: "almost-there",
      tone: "nudge",
      priority: 60,
      cooldownMinutes: 90,
      text: styled(ALMOST, style, day),
      action: {
        label: remaining[0].quest.title,
        kind: "log-quest",
        payload: remaining[0].quest.id,
      },
    });
  }

  /* --- Did you do it? ------------------------------------------------ *
   * Only asks about quests whose window has clearly passed, and only once
   * each. This is the "checks on you" behaviour, kept to a single polite
   * question rather than a stream of them.
   * ------------------------------------------------------------------- */

  const windowPassed = remaining.find((t) => {
    if (t.quest.window === "morning") return part === "afternoon" || part === "evening";
    if (t.quest.window === "afternoon") return part === "evening";
    if (t.quest.window === "evening") return part === "night";
    return false;
  });

  if (windowPassed) {
    out.push({
      id: `ask-${windowPassed.quest.id}`,
      tone: "ask",
      priority: 55,
      cooldownMinutes: 60 * 4,
      text: `Quick one — did you ${windowPassed.quest.title.toLowerCase()}?`,
      action: { label: "Yes, log it", kind: "log-quest", payload: windowPassed.quest.id },
    });
  }

  /* --- Everything done, evening: permission to stop ------------------ */

  if (due.length > 0 && remaining.length === 0 && (part === "evening" || part === "night")) {
    out.push({
      id: "rest",
      tone: "rest",
      priority: 50,
      cooldownMinutes: 60 * 8,
      text: styled(REST, style, day),
    });
  }

  /* --- Nothing logged yet -------------------------------------------- */

  if (done.length === 0 && due.length > 0 && part !== "night") {
    out.push({
      id: "empty-board",
      tone: "nudge",
      priority: 45,
      cooldownMinutes: 60 * 5,
      text: styled(GENTLE_NUDGE, style, day),
      action: {
        label: "Pick the easy one",
        kind: "log-quest",
        payload: [...remaining].sort(
          (a, b) => a.quest.difficulty - b.quest.difficulty,
        )[0]?.quest.id,
      },
    });
  }

  /* --- Broke a streak yesterday --------------------------------------- */

  if (ctx.overallStreak === 0 && ctx.totalLogs > 3 && done.length === 0) {
    out.push({
      id: "missed-day",
      tone: "motivate",
      priority: 43,
      cooldownMinutes: 60 * 10,
      text: styled(MISSED_DAY, style, day),
    });
  }

  /* --- A prioritised domain has gone quiet ---------------------------- */

  const neglected = profile.priorities
    .slice(0, 3)
    .map((id) => ctx.domains[id])
    .filter((d) => d && d.questCount > 0 && d.streak === 0 && d.adherence < 0.25);

  if (neglected.length > 0) {
    const d = getDomain(neglected[0].domain);
    out.push({
      id: `neglect-${d.id}`,
      tone: "reflect",
      priority: 40,
      cooldownMinutes: 60 * 36,
      text: d.neglectNudge,
      action: { label: `Open ${d.name}`, kind: "open-domain", payload: d.id },
    });
  }

  /* --- A domain is clearly improving ----------------------------------- */

  const rising = Object.values(ctx.domains)
    .filter((d) => d.trend > 0.2 && d.questCount > 0)
    .sort((a, b) => b.trend - a.trend)[0];

  if (rising) {
    const d = getDomain(rising.domain);
    out.push({
      id: `rising-${d.id}`,
      tone: "reflect",
      priority: 35,
      cooldownMinutes: 60 * 30,
      text: `${d.name} is noticeably up on the last two weeks. Whatever you changed, it's working.`,
      action: { label: `See ${d.name}`, kind: "open-domain", payload: d.id },
    });
  }

  /* --- Fallback -------------------------------------------------------- */

  out.push({
    id: "greet",
    tone: "greet",
    priority: 10,
    cooldownMinutes: 60 * 4,
    text: styled(GREETINGS, style, day + part),
    action: { label: "Show today", kind: "open-today" },
  });

  return out;
}

/**
 * Choose the single message the mascot should show right now.
 *
 * Returns null when everything is on cooldown — which is intentional and
 * common. A quiet mascot is a feature.
 */
export function selectCoachMessage(ctx: CoachContext): CoachMessage | null {
  const ranked = candidates(ctx).sort((a, b) => b.priority - a.priority);
  for (const msg of ranked) {
    const since = minutesSince(ctx.cooldowns[msg.id], ctx.now);
    if (since >= msg.cooldownMinutes) return msg;
  }
  return null;
}

/**
 * A short, always-available status line for the mascot bubble's resting state,
 * independent of the cooldown system.
 */
export function coachStatusLine(ctx: CoachContext): string {
  const due = ctx.today.filter((t) => t.due);
  const remaining = due.filter((t) => !t.log || t.log.status === "skipped");
  if (due.length === 0) return "Nothing scheduled. Add a quest whenever you like.";
  if (remaining.length === 0) return "All clear for today.";
  if (remaining.length === 1) return "One thing left today.";
  return `${remaining.length} things left today.`;
}
