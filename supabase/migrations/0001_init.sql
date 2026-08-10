-- ===========================================================================
-- Lifequest — initial schema
--
-- Run this once in the Supabase SQL Editor (Database → SQL Editor → New query).
-- It is idempotent: re-running it is safe.
--
-- Design notes:
--   * Primary keys for game rows are the client-generated text ids (`q_...`,
--     `log_...`). The device is where data is created, and reusing its ids
--     makes upserts trivially idempotent — a retried sync can't duplicate.
--   * Row-level security is on for every table with no exceptions, and every
--     policy is scoped to auth.uid(). The service-role key bypasses RLS and is
--     used only by the admin panel, server-side.
--   * `time_window` rather than `window`: WINDOW is a reserved word in Postgres.
-- ===========================================================================

-- ---------------------------------------------------------------- helpers --

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------- profiles --

create table if not exists public.profiles (
  id                     uuid primary key references auth.users on delete cascade,
  display_name           text        not null default 'Player',
  priorities             text[]      not null default '{}',
  baselines              jsonb       not null default '{}'::jsonb,
  visions                jsonb       not null default '{}'::jsonb,
  motivation_style       text        not null default 'cheerleader',
  rhythm                 text        not null default 'flexible',
  daily_minutes          integer     not null default 45,
  promise                text,
  promise_horizon_months integer     not null default 12,
  timezone               text        not null default 'UTC',
  onboarding_complete    boolean     not null default false,
  -- The day-one record. Never edited after onboarding — it is the substance of
  -- the starting report.
  started_at             timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- --------------------------------------------------------------- accounts --

create table if not exists public.accounts (
  id                     uuid primary key references auth.users on delete cascade,
  email                  text,
  trial_started_at       timestamptz not null default now(),
  trial_days             integer     not null default 16,
  -- trialing | active | past_due | expired | comped
  status                 text        not null default 'trialing',
  plan                   text,
  -- Set when a payment first fails; drives the dunning grace period.
  past_due_since         timestamptz,
  -- player | staff | admin. Staff and admin bypass billing entirely.
  role                   text        not null default 'player',
  bypass_billing         boolean     not null default false,
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  documents_sent_at      timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint accounts_status_check
    check (status in ('trialing', 'active', 'past_due', 'expired', 'comped')),
  constraint accounts_role_check
    check (role in ('player', 'staff', 'admin'))
);

create index if not exists accounts_status_idx on public.accounts (status);
create index if not exists accounts_created_idx on public.accounts (created_at desc);

-- ----------------------------------------------------------------- quests --

create table if not exists public.quests (
  id          text        primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  domain      text        not null,
  title       text        not null,
  detail      text,
  cadence     jsonb       not null,
  kind        text        not null,
  difficulty  smallint    not null,
  time_window text        not null,
  target      numeric,
  unit        text,
  source      text        not null default 'user',
  created_at  timestamptz not null,
  archived_at timestamptz,
  updated_at  timestamptz not null default now()
);

create index if not exists quests_user_idx on public.quests (user_id);

-- ------------------------------------------------------------------- logs --

create table if not exists public.logs (
  id       text        primary key,
  user_id  uuid        not null references auth.users on delete cascade,
  quest_id text        not null,
  day      date        not null,
  status   text        not null,
  value    numeric,
  at       timestamptz not null,
  -- One entry per quest per day; a re-log replaces rather than accumulates.
  unique (user_id, quest_id, day)
);

create index if not exists logs_user_day_idx on public.logs (user_id, day desc);

-- ------------------------------------------------------------------ goals --

create table if not exists public.goals (
  id           text        primary key,
  user_id      uuid        not null references auth.users on delete cascade,
  domain       text        not null,
  title        text        not null,
  why          text,
  target_date  date,
  target       numeric,
  current      numeric,
  unit         text,
  source       text        not null default 'user',
  created_at   timestamptz not null,
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);

create index if not exists goals_user_idx on public.goals (user_id);

-- ------------------------------------------------------------ reflections --

create table if not exists public.reflections (
  user_id uuid        not null references auth.users on delete cascade,
  day     date        not null,
  mood    smallint,
  note    text,
  at      timestamptz not null,
  primary key (user_id, day)
);

-- ----------------------------------------------------------- achievements --

create table if not exists public.unlocked_achievements (
  user_id        uuid        not null references auth.users on delete cascade,
  achievement_id text        not null,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ------------------------------------------------------- updated_at hooks --

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists accounts_touch on public.accounts;
create trigger accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists quests_touch on public.quests;
create trigger quests_touch before update on public.quests
  for each row execute function public.touch_updated_at();

drop trigger if exists goals_touch on public.goals;
create trigger goals_touch before update on public.goals
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row-level security
--
-- Enabled everywhere. Without a matching policy a table is deny-all, so
-- forgetting a policy fails closed rather than open.
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.accounts              enable row level security;
alter table public.quests                enable row level security;
alter table public.logs                  enable row level security;
alter table public.goals                 enable row level security;
alter table public.reflections           enable row level security;
alter table public.unlocked_achievements enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile write"  on public.profiles;
drop policy if exists "own profile insert" on public.profiles;

create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile write"  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- accounts ------------------------------------------------------------------
-- Read-only to the player. Everything that decides whether they have paid is
-- written by the service role (Stripe webhook, admin panel) and must never be
-- settable from the browser.
drop policy if exists "own account read" on public.accounts;
create policy "own account read" on public.accounts for select using (auth.uid() = id);

-- quests --------------------------------------------------------------------
drop policy if exists "own quests" on public.quests;
create policy "own quests" on public.quests for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- logs ----------------------------------------------------------------------
drop policy if exists "own logs" on public.logs;
create policy "own logs" on public.logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- goals ---------------------------------------------------------------------
drop policy if exists "own goals" on public.goals;
create policy "own goals" on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reflections ---------------------------------------------------------------
drop policy if exists "own reflections" on public.reflections;
create policy "own reflections" on public.reflections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- achievements --------------------------------------------------------------
drop policy if exists "own achievements" on public.unlocked_achievements;
create policy "own achievements" on public.unlocked_achievements for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- Provision a profile and account the moment someone signs up.
--
-- SECURITY DEFINER so it can insert while RLS is active. `set search_path`
-- is not optional here: without it a definer function is a well-known
-- privilege-escalation vector.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Player')
  )
  on conflict (id) do nothing;

  insert into public.accounts (id, email, trial_started_at, status)
  values (new.id, new.email, now(), 'trialing')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Convenience view for the admin panel. Service role only — RLS on the
-- underlying tables still applies to anyone else.
-- =====================================================================

create or replace view public.admin_user_overview as
select
  a.id,
  a.email,
  a.status,
  a.role,
  a.plan,
  a.bypass_billing,
  a.trial_started_at,
  a.trial_days,
  a.past_due_since,
  a.current_period_end,
  a.created_at,
  p.display_name,
  p.onboarding_complete,
  (select count(*) from public.quests q where q.user_id = a.id and q.archived_at is null) as quest_count,
  (select count(*) from public.logs l where l.user_id = a.id)                              as log_count,
  (select max(l.day) from public.logs l where l.user_id = a.id)                            as last_active_day
from public.accounts a
left join public.profiles p on p.id = a.id;
