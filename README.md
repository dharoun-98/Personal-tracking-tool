# Personal-tracking-tool

A platform where you track all your personal stuff — health, wealth,
connections, purpose, growth, inner peace and fun — just like a game.

Seven domains, seven orbs to keep lit. Answer a few honest questions, get a
board sized to the time you actually have, and log a day at a time. Your
companion celebrates what you finished and asks gently about what you didn't.

> **Status:** v0.2.0 — Stage 2 (Day theme, documents, email, settings).
> Local-first, no account required. See [`CHANGELOG.md`](CHANGELOG.md) for
> what's in it and [`docs/versions/`](docs/versions/) for the full story behind
> each release.

**Live:** <https://personal-tracking-tool.vercel.app>

---

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. No environment variables are needed for Stage 1 —
everything runs on the device.

### Other commands

```bash
npm run build
```

```bash
npm run typecheck
```

```bash
npm run lint
```

---

## How it works

| Concept | What it means |
| --- | --- |
| **Domain** | One of the seven parts of life. Has its own colour, level and vitality. |
| **Quest** | A recurring thing you track. Daily, N× a week, N× a month, or specific days. |
| **XP & level** | Earned per completion, scaled by effort and streak. Only ever goes up. |
| **Vitality** | A recency-weighted 14-day adherence score. Decays. Drives how brightly an orb burns. |
| **Streak** | Consecutive days you showed up. An unfinished *today* never breaks one. |
| **Lumen** | Your companion. Rule-based, four personalities, no AI, deliberately quiet. |

### Theming

Two themes — **Night** (the original deep-space canvas) and **Day** — switched
from your profile, or set to follow your device. Every domain carries two
colour values: `color` for fills, identical in both themes, and `ink` for text,
which flips. `--color-on-accent` is near-black in both, for text on a saturated
fill. There is not a single `dark:` utility in the codebase.

---

## Project layout

```
src/
  app/
    (game)/          # the app shell — dashboard, map, domains, journey, profile
    onboarding/      # character creation
    offline/         # service-worker fallback
    page.tsx         # landing
  components/
    game/            # orbs, quest cards, heatmaps, streaks
    mascot/          # Lumen and the celebration burst
    onboarding/      # the setup flow
    shell/           # navigation, star field, PWA plumbing
    ui/              # buttons, panels, rings, bars, sliders
  lib/
    domains.ts       # the seven domains (pure data)
    game.ts          # XP, levels, streaks, cadence, vitality
    coach.ts         # the rules engine behind Lumen
    companion.ts     # what Lumen is currently saying
    store.ts         # persisted game state
    quest-library.ts # 43 starter quests
docs/
  versions/          # a snapshot per release
  tooling/           # one-off generators (app icons)
```

---

## Roadmap

| Stage | Contents |
| --- | --- |
| 1 ✅ | Playable core: onboarding, dashboard, check-ins, companion, PWA |
| 2 ✅ | Light + dark themes, the two PDFs, email delivery, editable settings |
| 3 | Supabase accounts and cloud sync, admin panel, Stripe billing, trial enforcement |
| 4 | Live push notifications and reminders, deeper analytics |

---

## Licence

[MIT](LICENSE)
