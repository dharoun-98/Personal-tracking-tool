# Changelog

Every release gets an entry here and a matching snapshot in
[`docs/versions/`](docs/versions/) with the fuller story — what shipped, what
was deliberately left out, and what the next stage picks up.

Versions follow `MAJOR.MINOR.PATCH`. Until 1.0 the minor number tracks stages.

---

## [0.1.0] — 2026-08-09 · Stage 1: The playable core

The game exists and you can play it. Local-first: everything lives on the
device, no account needed, works offline.

### Added

- **Seven domains** — health, wealth, connections, purpose, growth, inner peace
  and fun, each with its own colour, copy, level and vitality reading.
- **Onboarding** — an 11-step character-creation flow: rate all seven domains,
  choose up to three priorities, describe what winning looks like, set a real
  daily time budget, pick a companion personality, and write a promise to your
  future self. It generates a starting board sized to the time you actually
  have.
- **Dashboard** — greeting, overall level and XP, today's completion ring,
  one-tap quest logging, and a scrollable constellation of all seven orbs.
- **Check-ins** — one tap to complete. Partial credit, specific values
  (minutes/count/amount) and skipping live behind an optional expand, so the
  common case stays instant.
- **Lumen, the companion** — a rule-based coach with four personalities
  (Cheerleader, Coach, Sage, Rival). Celebrates completions, asks about things
  whose time window has passed, notices neglected domains and rising trends.
  Every rule has a cooldown; it is designed to stay quiet.
- **Constellation map** — all seven domains as a heptagon, linked by lines
  whose brightness is capped by the dimmer end, plus a whole-life vitality
  reading.
- **Domain pages** — level, vitality, streak, two-week trend, a four-week
  activity heatmap, goals and quests.
- **Journey** — XP chart, 28-day activity grid, and 35 achievements across four
  tiers with live progress on the locked ones.
- **Quest builder** — add from a 43-entry starter library or write your own,
  with cadence, tracking type, effort and time-of-day.
- **Installable PWA** — manifest, generated icons, app shortcuts, a service
  worker with an offline fallback, and platform-aware install guidance
  (Chromium prompt, iOS Add-to-Home-Screen steps).
- **Cosmic RPG design system** — deep-space palette, glowing orbs, gold
  rewards, reduced-motion support, and a navigation shell that is a bottom tab
  bar on phones and a side rail on laptops.

### Notes

- Game state persists to `localStorage`. Nothing leaves the device.
- The service worker only registers in production builds.
- The push-notification handlers exist in the service worker but nothing sends
  to them yet.

### Deliberately not in this release

Accounts and cloud sync, the two PDF documents, email delivery, the admin
panel, Stripe billing and trial enforcement, and live push notifications.
Those are Stages 2–4.

[0.1.0]: https://github.com/dharoun-98/Personal-tracking-tool/releases/tag/v0.1.0
