-- Atomically clear the authenticated player's mirrored game state.
--
-- The browser must never approximate this with a sequence of deletes: one
-- failed request would leave a half-reset cloud copy that the next restore
-- could present as complete. A PostgreSQL function is a single transaction,
-- so any failure rolls every statement back.

create or replace function public.reset_my_game_snapshot()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.logs where user_id = caller_id;
  delete from public.quests where user_id = caller_id;
  delete from public.goals where user_id = caller_id;
  delete from public.reflections where user_id = caller_id;
  delete from public.unlocked_achievements where user_id = caller_id;

  -- Keep the provisioned profile row, but turn it back into a clean,
  -- explicitly non-onboarded marker. `describeRemote` then correctly reports
  -- an empty game while the account and its billing state remain intact.
  insert into public.profiles (
    id,
    display_name,
    priorities,
    baselines,
    visions,
    motivation_style,
    rhythm,
    daily_minutes,
    promise,
    promise_horizon_months,
    timezone,
    onboarding_complete,
    started_at
  ) values (
    caller_id,
    'Player',
    '{}'::text[],
    '{}'::jsonb,
    '{}'::jsonb,
    'cheerleader',
    'flexible',
    45,
    null,
    12,
    'UTC',
    false,
    now()
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    priorities = excluded.priorities,
    baselines = excluded.baselines,
    visions = excluded.visions,
    motivation_style = excluded.motivation_style,
    rhythm = excluded.rhythm,
    daily_minutes = excluded.daily_minutes,
    promise = excluded.promise,
    promise_horizon_months = excluded.promise_horizon_months,
    timezone = excluded.timezone,
    onboarding_complete = false,
    started_at = excluded.started_at;
end;
$$;

revoke all on function public.reset_my_game_snapshot() from public, anon;
grant execute on function public.reset_my_game_snapshot() to authenticated;
