-- ===========================================================================
-- Keep the admin access display in step with the account access evaluator.
--
-- `past_due_since` is normally present for a failed payment, but the shared
-- evaluator deliberately falls back to `accounts.updated_at` for older rows or
-- a webhook race. The admin overview needs that same timestamp or it can show a
-- different grace period from the player-facing app.
-- ===========================================================================

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
  (select max(l.day) from public.logs l where l.user_id = a.id)                            as last_active_day,
  a.updated_at
from public.accounts a
left join public.profiles p on p.id = a.id;

-- CREATE OR REPLACE must never reopen this service-role-only surface. Reapply
-- both independent protections from 0002 explicitly after replacing the view.
alter view public.admin_user_overview set (security_invoker = on);

revoke all on public.admin_user_overview from anon;
revoke all on public.admin_user_overview from authenticated;
revoke all on public.admin_user_overview from public;

grant select on public.admin_user_overview to service_role;
