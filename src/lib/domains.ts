import type { DomainId } from "./types";

export interface DomainMeta {
  id: DomainId;
  name: string;
  /** Two or three words shown under the name on orbs and headers. */
  tagline: string;
  /** One sentence, used in onboarding and empty states. */
  blurb: string;
  /**
   * The fill colour. Identical in both themes — saturated mid-tones read fine
   * as shapes on either canvas. Use for orbs, bars, dots and washes.
   */
  color: string;
  /**
   * The readable variant, as a `var()` reference so it flips with the theme.
   * Use whenever the domain's colour carries *text* or a small icon: the fill
   * colours are far too light to set type in on a pale background.
   */
  ink: string;
  /** The question we ask when rating this domain in onboarding. */
  baselineQuestion: string;
  /** Prompt for the free-text "what does winning look like" step. */
  visionPrompt: string;
  /** Shown when the domain has been quiet for a while. */
  neglectNudge: string;
}

/**
 * Order matters: this is the canonical order used everywhere the player
 * hasn't expressed a preference (onboarding, reports, admin).
 */
export const DOMAINS: DomainMeta[] = [
  {
    id: "health",
    name: "Health",
    tagline: "Body & energy",
    blurb: "How you move, eat, sleep and recover — the engine everything else runs on.",
    color: "#2DD4A7",
    ink: "var(--color-health-ink)",
    baselineQuestion: "How's your body and energy these days?",
    visionPrompt: "If your health were exactly where you wanted it, what would a normal day feel like?",
    neglectNudge: "Your body's been running quietly in the background. Even a short walk counts.",
  },
  {
    id: "wealth",
    name: "Wealth",
    tagline: "Money & security",
    blurb: "What you earn, keep and build — the freedom to choose how you spend your days.",
    color: "#F5B301",
    ink: "var(--color-wealth-ink)",
    baselineQuestion: "How settled do you feel about money right now?",
    visionPrompt: "What would 'money is not a worry' actually look like for you?",
    neglectNudge: "Money likes attention. A five-minute look at the numbers is a real move.",
  },
  {
    id: "connections",
    name: "Connections",
    tagline: "People & love",
    blurb: "The people you'd call at 2am, and the ones who make ordinary weeks better.",
    color: "#FF7A5C",
    ink: "var(--color-connections-ink)",
    baselineQuestion: "How nourished do you feel by the people around you?",
    visionPrompt: "Who do you want to be closer to a year from now?",
    neglectNudge: "Someone would light up hearing from you today. One message is enough.",
  },
  {
    id: "purpose",
    name: "Purpose",
    tagline: "Meaning & work",
    blurb: "The thing you're building, and whether your days point somewhere you care about.",
    color: "#A855F7",
    ink: "var(--color-purpose-ink)",
    baselineQuestion: "How much do your days point toward something you care about?",
    visionPrompt: "What do you want to be able to say you built or contributed?",
    neglectNudge: "The big thing only moves when you touch it. Fifteen minutes still counts.",
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Skills & mind",
    blurb: "What you're learning and becoming — the compounding kind of progress.",
    color: "#38BDF8",
    ink: "var(--color-growth-ink)",
    baselineQuestion: "How much are you learning and stretching lately?",
    visionPrompt: "What skill would change the most for you if you actually got good at it?",
    neglectNudge: "You haven't fed your curiosity in a bit. A page, a video, anything.",
  },
  {
    id: "peace",
    name: "Inner Peace",
    tagline: "Calm & clarity",
    blurb: "Your relationship with your own head — stress, stillness, and being okay.",
    color: "#818CF8",
    ink: "var(--color-peace-ink)",
    baselineQuestion: "How calm and clear does your mind feel most days?",
    visionPrompt: "What would a genuinely settled version of you do differently?",
    neglectNudge: "Nothing to fix here — just a few slow breaths whenever you want them.",
  },
  {
    id: "fun",
    name: "Fun",
    tagline: "Joy & play",
    blurb: "The part that isn't optimising anything. Play, delight, being a person.",
    color: "#F45FD0",
    ink: "var(--color-fun-ink)",
    baselineQuestion: "How much genuine fun have you been having?",
    visionPrompt: "What did you love doing that you've quietly stopped making time for?",
    neglectNudge: "Fun isn't a reward for finishing everything else. Go do the pointless thing.",
  },
];

export const DOMAIN_IDS: DomainId[] = DOMAINS.map((d) => d.id);

const DOMAIN_MAP = new Map<DomainId, DomainMeta>(DOMAINS.map((d) => [d.id, d]));

export function getDomain(id: DomainId): DomainMeta {
  const found = DOMAIN_MAP.get(id);
  if (!found) throw new Error(`Unknown domain: ${id}`);
  return found;
}

export function domainColor(id: DomainId): string {
  return getDomain(id).color;
}

/** Order a domain list by the player's stated priorities, stable for the rest. */
export function orderByPriority(
  ids: DomainId[],
  priorities: DomainId[],
): DomainId[] {
  const rank = new Map(priorities.map((d, i) => [d, i]));
  return [...ids].sort((a, b) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return DOMAIN_IDS.indexOf(a) - DOMAIN_IDS.indexOf(b);
  });
}
