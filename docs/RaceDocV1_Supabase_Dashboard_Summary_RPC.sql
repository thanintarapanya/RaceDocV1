-- RaceDocV1 Dashboard Summary RPC
-- Applied via Supabase MCP on 2026-05-12.
-- Purpose: provide one role-aware dashboard payload for metrics, recent alerts, and next actions.

create or replace function public.get_dashboard_summary()
returns table (
  scope text,
  metrics jsonb,
  alerts jsonb,
  next_actions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with role_flags as (
    select
      auth.uid() as user_id,
      exists (
        select 1
        from public.role_assignments ra
        where ra.user_id = auth.uid()
          and ra.role_code in ('ADMIN'::public.role_code, 'SECRETARY'::public.role_code)
      ) as elevated
  ), visible_entries as (
    select e.*
    from public.entries e
    cross join role_flags rf
    where e.deleted_at is null
      and (
        rf.elevated
        or e.competitor_user_id = rf.user_id
        or e.team_manager_id = rf.user_id
        or e.created_by_id = rf.user_id
      )
  ), request_rows as (
    select r.*
    from public.requests r
    cross join role_flags rf
    left join public.entries e on e.id = r.entry_id
    where r.deleted_at is null
      and (
        rf.elevated
        or r.created_by_id = rf.user_id
        or e.competitor_user_id = rf.user_id
        or e.team_manager_id = rf.user_id
      )
  ), inspection_rows as (
    select ci.*
    from public.car_inspections ci
    cross join role_flags rf
    join public.entries e on e.id = ci.entry_id
    where e.deleted_at is null
      and (
        rf.elevated
        or e.competitor_user_id = rf.user_id
        or e.team_manager_id = rf.user_id
        or ci.created_by_id = rf.user_id
      )
  ), weight_rows as (
    select wl.*
    from public.weigh_in_logs wl
    cross join role_flags rf
    join public.entries e on e.id = wl.entry_id
    where e.deleted_at is null
      and wl.is_void is false
      and (
        rf.elevated
        or e.competitor_user_id = rf.user_id
        or e.team_manager_id = rf.user_id
      )
  )
  select
    case when rf.elevated then 'official' else 'competitor' end as scope,
    jsonb_build_object(
      'pendingEntryForms', count(*) filter (where ve.status = 'pending'::public.entry_status),
      'activeEntryForms', count(*) filter (where ve.status = 'active'::public.entry_status),
      'rejectedEntryForms', count(*) filter (where ve.status = 'rejected'::public.entry_status),
      'pendingRequests', coalesce((select count(*) from request_rows rr where rr.status in ('waiting_consent'::public.request_status, 'pending_secretary'::public.request_status, 'under_review'::public.request_status)), 0),
      'inspectionPending', coalesce((select count(*) from inspection_rows ir where ir.overall_status = 'pending'::public.car_inspection_status), 0),
      'inspectionFailed', coalesce((select count(*) from inspection_rows ir where ir.overall_status = 'failed'::public.car_inspection_status), 0),
      'weightInFailed', coalesce((select count(*) from weight_rows wr where wr.status = 'fail'::public.weigh_in_status), 0)
    ) as metrics,
    coalesce(
      (
        select jsonb_agg(alert order by sort_at desc)
        from (
          select
            ve.updated_at as sort_at,
            jsonb_build_object(
              'type', 'entry',
              'severity', case when ve.status = 'rejected'::public.entry_status then 'warning' else 'info' end,
              'title', case
                when ve.status = 'pending'::public.entry_status then 'Entry form pending review'
                when ve.status = 'active'::public.entry_status then 'Entry form active'
                when ve.status = 'rejected'::public.entry_status then 'Entry form rejected'
                else 'Entry form updated'
              end,
              'description', concat('Car #', coalesce(ve.car_number, '--'), ' is ', ve.status::text),
              'timestamp', ve.updated_at
            ) as alert
          from visible_entries ve
          where ve.status in ('pending'::public.entry_status, 'active'::public.entry_status, 'rejected'::public.entry_status)
          order by ve.updated_at desc
          limit 5
        ) recent_alerts
      ),
      '[]'::jsonb
    ) as alerts,
    jsonb_build_array(
      jsonb_build_object(
        'label', case when rf.elevated then 'Review pending entry forms' else 'Open Entry Form tab' end,
        'path', '/entry-forms',
        'count', count(*) filter (where ve.status = 'pending'::public.entry_status)
      ),
      jsonb_build_object(
        'label', 'Check profile and privacy settings',
        'path', '/settings/profile',
        'count', 0
      )
    ) as next_actions
  from role_flags rf
  left join visible_entries ve on true
  group by rf.elevated;
$$;

revoke all on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
