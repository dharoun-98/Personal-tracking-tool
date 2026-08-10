# Changelog

Every release gets an entry here and a matching snapshot in
[`docs/versions/`](docs/versions/) with the fuller story — what shipped, what
was deliberately left out, and what the next stage picks up.

Versions follow `MAJOR.MINOR.PATCH`. Until 1.0 the minor number tracks stages.

---

## [0.3.0] — 2026-08-10 · Stage 3: Accounts, billing and the command deck

Supabase accounts, cloud backup, trial enforcement, an admin panel, and
Stripe wired up behind env vars.

**The game still runs with none of this configured.** Every capability here
degrades to a readable "not switched on" state rather than an error, and the
local-first experience is unchanged.

### Added

- **Accounts** — email/password or magic link, via Supabase. Session refresh
  in middleware so a server-rendered page never sees a stale token.
- **Database schema** at `supabase/migrations/0001_init.sql`. Row-level
  security on every table, scoped to `auth.uid()`, with a signup trigger that
  provisions the profile and account rows.
- **Cloud backup and restore.** Explicitly a backup, not live multi-device
  sync — and when both the device and the cloud hold a game, it shows you
  what's in each and asks. It never picks a side for you.
- **Trial enforcement.** Sixteen days, silent for the first eleven, a gentle
  dismissible banner for the last five, then a paywall that replaces the app.
  Failed payments get a seven-day grace period before locking.
- **The paywall itself** shows your real level, streak and XP, because your
  history isn't gone and the screen shouldn't imply it is.
- **Admin panel** at `/command-deck` — password-gated, separate from Supabase
  auth so it still works when auth is what's broken. Metrics, user search,
  comp/uncomp, trial extension, status overrides.
- **Stripe** — checkout, billing portal and a signature-verified webhook,
  spoken to over its REST API so there's no dependency to install until real
  keys exist.

### Security notes

- `accounts` is **read-only to players** under RLS. Everything that decides
  whether someone has paid is written by the service role — the Stripe webhook
  and the admin panel — and can never be set from a browser.
- The webhook rejects every request when `STRIPE_WEBHOOK_SECRET` is absent.
  Without that, anyone who found the URL could mark any account as paid.
- Admin server actions re-check the session themselves. Server actions are
  ordinary POST endpoints with stable ids; a page-level check protects the
  render, not the action.
- `handle_new_user` is `SECURITY DEFINER` with an explicit `search_path`, which
  is what stops it being a privilege-escalation vector.

---

## [0.2.0] — 2026-08-10 · Stage 2: Day, documents and delivery

Light mode, the two keepsake PDFs, email delivery, and editable settings.

### Added

- **Day theme** — a full light mode beside the original Night, plus a
  Day / Night / Auto control in your profile. The theme is applied by a
  blocking script before first paint, so there is no flash of the wrong one.
  Two token families make it work: `--color-{domain}-ink` (a darkened variant
  for anything that sets *text* in a domain's colour) and `--color-on-accent`
  (near-black in both themes, for text sitting on a saturated fill).
- **Your Starting Report** — a four-page PDF of where you stood on day one:
  all seven baselines with your own vision statements, your starting board,
  and a plain-English explanation of what level, vitality, streak and dormant
  actually mean.
- **A Promise to Your Future Self** — a one-page letter in your own words,
  dated, with an "open on" date N months out. Prints with space to write by
  hand if you skipped the promise during setup.
- **Email delivery** — both PDFs attached, from your profile. Generated on the
  device and uploaded, because the server has no copy of your history to build
  them from. Rate-limited and size-capped; hides itself entirely when no mail
  provider is configured.
- **Editable settings** at `/settings` — name, companion, rhythm, daily time,
  focus domains, visions, promise and horizon.

### Changed

- **Accessibility.** Every route was measured in both themes with a real
  contrast checker (canvas-resolved colours, full alpha compositing over the
  ancestor stack). Twenty route/theme combinations now have **zero** WCAG AA
  failures. That work fixed pre-existing Stage 1 problems: `--c-ink-mute` and
  `--c-ink-faint` measured 2.3–2.7:1 in the dark theme against surfaces they
  were routinely used on.
- New `--color-edge` token for borders that *are* the control boundary
  (inputs, option chips), which WCAG 1.4.11 requires to clear 3:1.
  `--color-hairline` stays decorative.
- The activity heatmap no longer prints a day number inside each cell. The
  fill runs from near-surface to full accent, so no single text colour is
  legible across that range; the date lives in the tooltip and `aria-label`.
- Baselines are deliberately **not** editable. They are the substance of the
  starting report, and a report you can retroactively edit is worth nothing.

### Fixed

- **Theme changes could leave the page half light and half dark.** Elements
  carrying a colour transition would animate toward the new theme and get
  pinned at the old value indefinitely. Transitions are now frozen for one
  frame while the theme swaps.
- **`.gold-sheen` was invisible in Day.** It paints text with a gradient and
  sets `color: transparent`; the bright middle stop measured 1.85:1 on white
  with no fallback underneath. The shimmer now runs between two dark golds in
  Day.

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

[0.3.0]: https://github.com/dharoun-98/Personal-tracking-tool/releases/tag/v0.3.0
[0.2.0]: https://github.com/dharoun-98/Personal-tracking-tool/releases/tag/v0.2.0
[0.1.0]: https://github.com/dharoun-98/Personal-tracking-tool/releases/tag/v0.1.0
