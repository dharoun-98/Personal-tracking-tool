-- ===========================================================================
-- Lifequest — push notifications
--
-- Run in the Supabase SQL Editor after 0002. Idempotent.
-- ===========================================================================

-- ------------------------------------------------------- subscriptions --
--
-- One row per browser/device, not per user: the same person may allow
-- notifications on a phone and a laptop, and each gets its own endpoint.
create table if not exists public.push_subscriptions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users on delete cascade,
  -- The push service URL. Unique because re-subscribing on the same device
  -- returns the same endpoint, and we want that to update rather than
  -- accumulate duplicates that all deliver the same notification.
  endpoint      text        not null unique,
  p256dh        text        not null,
  auth          text        not null,
  user_agent    text,
  -- Bumped when a send fails transiently; the row is deleted outright when
  -- the push service says the subscription is gone (404/410).
  failure_count integer     not null default 0,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- --------------------------------------------------- notification prefs --
--
-- Quiet hours are stored as local hours (0–23) and evaluated against the
-- player's own timezone, which already lives on the profile. Storing UTC
-- would break for anyone who travels or observes DST.
alter table public.profiles
  add column if not exists notifications_enabled boolean     not null default false,
  add column if not exists quiet_hours_start     smallint    not null default 22,
  add column if not exists quiet_hours_end       smallint    not null default 7,
  add column if not exists last_notified_at      timestamptz;

-- ------------------------------------------------------------- delivery --
create table if not exists public.notification_log (
  id      uuid        primary key default gen_random_uuid(),
  user_id uuid        references auth.users on delete set null,
  kind    text        not null,
  title   text,
  status  text        not null,
  detail  text,
  sent_at timestamptz not null default now(),
  constraint notification_log_status_check
    check (status in ('sent', 'failed', 'expired', 'skipped'))
);

create index if not exists notification_log_sent_idx
  on public.notification_log (sent_at desc);
create index if not exists notification_log_user_idx
  on public.notification_log (user_id, sent_at desc);

-- ===================================================================
-- Row-level security
-- ===================================================================

alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Read-only to the player: the log is written by the server when it sends,
-- and a client that could forge entries would make the analytics worthless.
drop policy if exists "own notification log" on public.notification_log;
create policy "own notification log" on public.notification_log for select
  using (auth.uid() = user_id);

-- ===================================================================
-- Who is due a nudge right now
--
-- Kept in SQL so the dispatcher fetches only the rows it will actually act
-- on, rather than pulling every profile and filtering in JavaScript.
--
-- Quiet hours wrap midnight (22 → 7), so the comparison differs depending on
-- whether start < end. Both cases are handled explicitly below.
-- ===================================================================

create or replace function public.players_due_for_reminder(
  window_label text  -- 'morning' | 'evening'
)
returns table (
  user_id     uuid,
  timezone    text,
  local_hour  integer,
  rhythm      text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.timezone,
    extract(hour from (now() at time zone coalesce(p.timezone, 'UTC')))::int,
    p.rhythm
  from public.profiles p
  join public.accounts a on a.id = p.id
  where p.notifications_enabled
    and p.onboarding_complete
    -- Someone who can't get in shouldn't be reminded to come back.
    and a.status in ('trialing', 'active', 'comped')
    and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
    -- At most one nudge per 12 hours, whatever else is true.
    and (p.last_notified_at is null or p.last_notified_at < now() - interval '12 hours')
    and (p.rhythm = window_label or p.rhythm = 'both' or p.rhythm = 'flexible')
    and (
      case
        -- Normal window, e.g. 9 → 17: quiet when inside it.
        when p.quiet_hours_start < p.quiet_hours_end then
          extract(hour from (now() at time zone coalesce(p.timezone, 'UTC')))::int
            not between p.quiet_hours_start and p.quiet_hours_end - 1
        -- Wrapping window, e.g. 22 → 7: quiet when outside the daytime gap.
        else
          extract(hour from (now() at time zone coalesce(p.timezone, 'UTC')))::int
            between p.quiet_hours_end and p.quiet_hours_start - 1
      end
    )
    and (
      case window_label
        when 'morning' then
          extract(hour from (now() at time zone coalesce(p.timezone, 'UTC')))::int between 7 and 10
        when 'evening' then
          extract(hour from (now() at time zone coalesce(p.timezone, 'UTC')))::int between 18 and 21
        else false
      end
    );
$$;

revoke all on function public.players_due_for_reminder(text) from anon, authenticated, public;
grant execute on function public.players_due_for_reminder(text) to service_role;
