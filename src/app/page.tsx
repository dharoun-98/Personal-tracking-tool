import Link from "next/link";
import { Bell, Download, Gamepad2, LineChart, ShieldCheck, Smartphone } from "lucide-react";
import { DOMAINS } from "@/lib/domains";
import { DomainIcon } from "@/components/game/domain-icon";
import { LandingCta } from "@/components/shell/landing-cta";
import { Panel } from "@/components/ui/panel";

const FEATURES = [
  {
    icon: Gamepad2,
    title: "Seven orbs, one life",
    body: "Health, wealth, connections, purpose, growth, inner peace and fun. Each one levels up as you tend it — and dims honestly when you don't.",
  },
  {
    icon: Smartphone,
    title: "A real app on your phone",
    body: "Install it to your home screen and it behaves like any other app: full screen, offline-capable, instant. No app store required.",
  },
  {
    icon: Bell,
    title: "A companion, not a nag",
    body: "Your coach checks in, celebrates what you finished and gently asks about what you didn't. One nudge, never a stream of them.",
  },
  {
    icon: LineChart,
    title: "Progress you can actually see",
    body: "Streaks, vitality, trends and a constellation map of your whole life — designed to be read in a glance, not studied.",
  },
  {
    icon: Download,
    title: "Two documents worth keeping",
    body: "A starting report on where you are today, and a letter of promise to your future self. Both yours to download whenever.",
  },
  {
    icon: ShieldCheck,
    title: "Your data, your business",
    body: "No AI reading your journal, no ad tech, no selling anything on. It's a tracker that works for you and only you.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Answer a few honest questions",
    body: "Rate all seven domains, pick what matters most right now, and tell us how much time you actually have.",
  },
  {
    n: "02",
    title: "Get a board you can clear",
    body: "We build a starting set of quests sized to your real life — not an aspirational one that collapses by Thursday.",
  },
  {
    n: "03",
    title: "Play a day at a time",
    body: "One tap to log. Earn XP, keep streaks, light up orbs, and watch the whole picture shift over weeks.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pad-safe-top">
      {/* ---------------------------------------------------------- Hero */}
      <section className="pt-16 pb-14 text-center sm:pt-24">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-3.5 py-1.5 text-2xs font-medium tracking-wide text-violet-soft uppercase">
          <span className="size-1.5 animate-pulse-glow rounded-full bg-cyan" />
          Now in early access
        </p>

        <h1 className="mx-auto max-w-3xl text-4xl leading-[1.08] font-extrabold text-balance sm:text-6xl">
          Your life, as a{" "}
          <span className="gold-sheen">game worth playing</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-mute text-pretty sm:text-lg">
          Track the seven things that actually make up a life — and enjoy doing it.
          Level up your health, wealth, connections, purpose, growth, inner peace and fun.
        </p>

        {/* Orb constellation */}
        <div className="my-11 flex flex-wrap items-center justify-center gap-x-6 gap-y-7 sm:gap-x-10">
          {DOMAINS.map((domain, i) => (
            <div key={domain.id} className="flex flex-col items-center gap-2.5">
              <div className="relative grid size-16 place-items-center sm:size-20">
                <span
                  aria-hidden
                  className="absolute inset-0 animate-pulse-glow rounded-full blur-lg"
                  style={{
                    background: `radial-gradient(circle, ${domain.color} 0%, transparent 68%)`,
                    animationDelay: `${i * 0.35}s`,
                  }}
                />
                <span
                  className="relative grid size-full place-items-center rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${domain.color} 32%, var(--color-surface)), var(--color-surface))`,
                    border: `1px solid color-mix(in oklab, ${domain.color} 45%, transparent)`,
                    color: domain.color,
                  }}
                >
                  <DomainIcon domain={domain.id} className="size-6 sm:size-8" />
                </span>
              </div>
              <span className="text-2xs font-medium text-ink-dim sm:text-xs">
                {domain.name}
              </span>
            </div>
          ))}
        </div>

        <LandingCta />
      </section>

      {/* ------------------------------------------------------ How it works */}
      <section className="py-14">
        <h2 className="mb-8 text-center text-2xs font-semibold tracking-[0.16em] text-ink-mute uppercase">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <Panel key={step.n} className="p-5">
              <p className="font-display text-3xl font-bold text-violet/45">{step.n}</p>
              <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-mute">{step.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- Features */}
      <section className="py-14">
        <h2 className="mx-auto mb-9 max-w-2xl text-center text-3xl font-bold text-balance sm:text-4xl">
          Built to be opened every day
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Panel key={feature.title} className="p-5">
              <span className="mb-3.5 grid size-11 place-items-center rounded-xl bg-violet/12 text-violet-soft">
                <feature.icon className="size-5" strokeWidth={1.75} />
              </span>
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">{feature.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- Final CTA */}
      <section className="py-14">
        <Panel className="relative overflow-hidden px-6 py-12 text-center">
          <div
            aria-hidden
            className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-violet/20 blur-[90px]"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-lg text-3xl font-bold text-balance">
              The best version of you is a few small days away
            </h2>
            <p className="mx-auto mt-3 mb-8 max-w-md text-sm leading-relaxed text-ink-mute text-pretty">
              Sixteen days free, no card, no pressure. If it isn&apos;t making your life
              better, walk away — you keep your report and your promise letter either way.
            </p>
            <LandingCta />
          </div>
        </Panel>
      </section>

      <footer className="flex flex-col items-center gap-3 border-t border-hairline/60 pt-8 text-center">
        <p className="text-2xs text-ink-faint">
          Lifequest — play your own game of life.
        </p>
        <nav className="flex gap-5 text-2xs text-ink-mute">
          <Link href="/onboarding" className="transition-colors hover:text-ink">
            Get started
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-ink">
            Dashboard
          </Link>
        </nav>
      </footer>
    </main>
  );
}
