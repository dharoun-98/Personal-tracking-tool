-- ===========================================================================
-- Lifequest — hourly reminder cron
--
-- Run in the Supabase SQL Editor after 0003.
--
-- BEFORE RUNNING: replace the two placeholders below.
--   <SITE_URL>     e.g. https://personal-tracking-tool.vercel.app
--   <CRON_SECRET>  the same value you set as CRON_SECRET in Vercel
--
-- Why one hourly job rather than a morning one and an evening one:
-- `players_due_for_reminder()` evaluates each player's local hour against
-- their own timezone, so a single hourly tick covers every region and every
-- DST change without a second schedule to keep in step.
--
-- The dispatcher is idempotent by design — `last_notified_at` enforces at most
-- one nudge per 12 hours per player — so an accidental double-run is harmless.
-- ===========================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any previous version so re-running this file doesn't stack schedules.
select cron.unschedule('lifequest-reminders')
where exists (select 1 from cron.job where jobname = 'lifequest-reminders');

select cron.schedule(
  'lifequest-reminders',
  -- Every hour, on the hour.
  '0 * * * *',
  $job$
    select net.http_post(
      url     := '<SITE_URL>/api/push/dispatch',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

-- ---------------------------------------------------------------------------
-- Checking on it
--
--   select * from cron.job;
--   select * from cron.job_run_details
--     where jobname = 'lifequest-reminders'
--     order by start_time desc limit 20;
--
-- pg_net responses land in a separate table:
--   select * from net._http_response order by created desc limit 20;
--
-- To stop reminders entirely:
--   select cron.unschedule('lifequest-reminders');
-- ---------------------------------------------------------------------------
