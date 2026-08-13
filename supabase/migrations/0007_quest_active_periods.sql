-- Preserve historical schedule eligibility across quest pause/restore cycles.
-- Legacy rows stay null and continue to use created_at / archived_at until
-- their first management action records explicit intervals.

alter table public.quests
  add column if not exists active_periods jsonb;

alter table public.quests
  drop constraint if exists quests_active_periods_array;

alter table public.quests
  add constraint quests_active_periods_array
  check (active_periods is null or jsonb_typeof(active_periods) = 'array');
