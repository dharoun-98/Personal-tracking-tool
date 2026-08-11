# Changelog

Every release gets an entry here and a matching snapshot in
[`docs/versions/`](docs/versions/) with the fuller story — what shipped, what
was deliberately left out, and what the next stage picks up.

Versions follow `MAJOR.MINOR.PATCH`. Until 1.0 the minor number tracks stages.

---

## [0.4.1] — 2026-08-11 · Stage 4 complete: reminders and broadcast

### Added

- **Automatic reminders.** One hourly cron job
  (`supabase/migrations/0004_reminder_cron.sql`) covers every player on earth,
  because `players_due_for_reminder()` evaluates each person's local hour
  against their own timezone. No cron per region, nothing to adjust for DST.
- **Reminder copy** in the four companion voices, with one rule that matters
  more than the wording: **if the board is already clear, it sends nothing.**
  Buzzing someone to tell them they've finished is just buzzing someone.
  Nothing ever mentions a streak being at risk.
- **Broadcast from the command deck** — compose, pick a segment (everyone, on
  trial, subscribed, lapsed, gone quiet), see a live lock-screen preview,
  check the recipient count, then confirm. Two steps on purpose: a push can't
  be recalled.

### Security

- `/api/push/dispatch` requires `CRON_SECRET`, compared in constant time, and
  refuses everything when the variable is unset. That route can reach every
  user's phone.
- `/api/admin/broadcast` re-checks the admin session itself rather than
  relying on the page.
- Broadcast only reaches accounts with a live push subscription — the record
  of consent — regardless of segment.

### Fixed

- Declining the browser's permission prompt showed "No problem — maybe later"
  in red, as though something had broken. It's an answer, not an error, and
  now reads neutral.

---

## [0.4.0] — 2026-08-11 · Stage 4, part one: push notifications

The foundation. Scheduled reminders and admin broadcast follow.

### Added

- **Push subscriptions** — `supabase/migrations/0003_push_notifications.sql`
  adds `push_subscriptions` (one row per device, keyed on the endpoint so
  re-subscribing updates rather than duplicates), notification preferences and
  quiet hours on `profiles`, and a delivery log. RLS on both new tables.
- **Send pipeline** using `web-push`. A real dependency this time rather than
  raw fetch like Stripe: Web Push needs a VAPID-signed JWT plus ECDH, HKDF and
  AES-128-GCM over the payload — cryptography to use, not to reimplement.
- **Permission flow** that never fires on page load. Browsers allow the prompt
  once; deny it and JavaScript can never ask again, so it explains what will
  arrive before asking, and only from a deliberate tap.
- **iOS handled honestly.** iPhone delivers push only to Home-Screen-installed
  PWAs, and in a Safari tab the Push API isn't even defined. Rather than show a
  dead button, it detects this and walks through installing first.
- Test notification, and per-device turn-off.

### Notes

- Dead subscriptions are deleted on 404/410 from the push service. Keeping
  them would mean retrying a dead endpoint forever and skewing delivery stats.
- `players_due_for_reminder()` lives in SQL so the dispatcher fetches only rows
  it will act on. Quiet hours are evaluated in the player's own timezone and
  handle the wrap past midnight.
- Everything is env-gated on the VAPID keys: without them the card hides
  itself and the routes return a readable 503.

### Still to come in Stage 4

Scheduled reminders driven by pg_cron, admin broadcast, delivery analytics.

---

## [0.3.2] — 2026-08-11 · Sync that you don't have to think about

Signing in on a second device used to dead-end: an empty device meant the app
sent you to onboarding, and onboarding was the only route to the screen that
could restore the world you already had. You had to invent a new life before
you could get your real one back.

### Changed

- **Sync is automatic.** Changes push on a 2.5-second debounce, on tab hide,
  and when the connection returns. Signing in anywhere pulls your world down
  before the app renders. No buttons.
- **A signed-in player is never sent to onboarding.** The shell waits for the
  restore and shows "Restoring your world…" instead of redirecting.
- **Sign in from the landing page**, and from step one of onboarding — the two
  places a returning player on a new device actually lands.
- Signing in goes straight to the dashboard rather than an account screen.

### How it decides, without a CRDT

Two counters answer "which side is authoritative" cheaply:

- `revision > pushedRevision` — this device has edits the server hasn't seen.
- `profiles.updated_at > serverStamp` — another device has written since.

Neither → nothing to do. One → that side wins, silently. **Both** → real
divergence, and it asks. That last case needs edits on two devices between
syncs, which is rare enough to justify interrupting for, and the alternative
is silently discarding somebody's streak.

A pull sets a flag the watcher checks, so applying the server's data doesn't
read as a local edit and bounce straight back — the loop that would otherwise
ping data between devices forever.

---

## [0.3.1] — 2026-08-10 · First live round-trip

Found by testing the deployed app against the real Supabase project with the
publishable key — the same key any visitor can read out of the client bundle.

### Fixed

- **`admin_user_overview` was readable by anyone.** A Postgres view defaults
  to `security_invoker = off`, so it runs with the view *owner's* privileges —
  `postgres`, which has BYPASSRLS. PostgREST exposes public-schema views to the
  anon key. Any anonymous caller could therefore have read every user's email,
  subscription status and trial dates, straight past the row-level security on
  the underlying tables.

  It read as safe in testing only because there were no users yet: an empty
  table and a wide-open view both return `[]`.

  Fixed in `supabase/migrations/0002_secure_admin_view.sql` two independent
  ways — `security_invoker = on` so the view honours the caller's RLS, and the
  grants revoked from `anon` and `authenticated` so it isn't reachable at all.
  **This migration must be run.**

- **`middleware.ts` → `proxy.ts`.** Next 16 deprecated the middleware file
  convention. Same behaviour, no more build warning.

- **The version badge said 0.1.0 on a 0.3.1 build.** It read an environment
  variable nobody had set and fell back to a hardcoded string. Now injected
  from `package.json` in `next.config.ts`, so it cannot drift.

- **Credential scratch files are untracked and gitignored.** `git add -A` had
  been sweeping up loose `.txt` files holding provider keys.

### Verified against the live project

- Anonymous reads with the publishable key return `[]` on all seven tables.
- An anonymous insert into `accounts` is refused:
  `42501 new row violates row-level security policy`.

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
