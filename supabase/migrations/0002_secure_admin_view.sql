-- ===========================================================================
-- Lifequest — close the admin view to everyone but the service role
--
-- Run this in the Supabase SQL Editor after 0001_init.sql. Idempotent.
--
-- WHY THIS EXISTS
--
-- `admin_user_overview` reads from `accounts` and `profiles`, both of which
-- have row-level security. That is not enough on its own:
--
--   * A Postgres view defaults to `security_invoker = off`, which means it
--     executes with the *view owner's* privileges. The owner here is
--     `postgres`, which has BYPASSRLS — so the view reads every row of the
--     underlying tables regardless of who is asking.
--   * PostgREST automatically exposes views in the `public` schema, and the
--     anon key can reach them.
--
-- Together that means an anonymous caller holding the publishable key — which
-- ships in the client bundle and is public by design — could have read every
-- user's email address, subscription status and trial dates.
--
-- Two independent fixes, because one of them silently doing nothing is a
-- failure mode worth designing against:
--   1. security_invoker = on, so the view respects the caller's RLS.
--   2. Revoke the grants, so anon and authenticated can't reach it at all.
--
-- The admin panel is unaffected: it connects with the service role, which
-- bypasses RLS and keeps its grant.
-- ===========================================================================

-- 1. Make the view honour the *caller's* row-level security, not the owner's.
--    Requires Postgres 15+, which every current Supabase project runs.
alter view public.admin_user_overview set (security_invoker = on);

-- 2. Take the view off the public API surface entirely.
revoke all on public.admin_user_overview from anon;
revoke all on public.admin_user_overview from authenticated;
revoke all on public.admin_user_overview from public;

grant select on public.admin_user_overview to service_role;

-- ---------------------------------------------------------------------------
-- Verify (optional): with the anon key, this should now return
--   401/403, not an empty array.
--
--   curl "https://<project>.supabase.co/rest/v1/admin_user_overview?select=*" \
--     -H "apikey: <publishable key>"
-- ---------------------------------------------------------------------------
