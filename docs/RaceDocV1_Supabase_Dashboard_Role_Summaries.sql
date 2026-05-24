-- RaceDocV1 Dashboard Role Summaries
-- Purpose: replace the basic dashboard payload with role-aware metrics, alerts, and next actions.

begin;

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
  with ctx as (
    select
      public.current_profile_id() as profile_id,
      public.has_role('ADMIN', null) as is_admin,
      public.has_role('SECRETARY', null) as is_secretary,
      public.has_role('HEAD_SCRUTINEER', null) as is_head_scrutineer,
      public.has_role('SCRUTINEER_STAFF', null) as is_scrutineer_staff,
      public.has_role('OFFSITE_SCRUTINEER', null) as is_offsite_scrutineer,
      public.has_role('CHAIRMAN', null) as is_president,
      public.has_role('STEWARD', null) as is_steward,
      public.has_role('CLERK', null) as is_clerk,
      public.has_role('TEAM_MANAGER', null) as is_team_manager,
      public.has_role('COMPETITOR', null) as is_competitor
  ), role_scope as (
    select
      ctx.*,
      (
        ctx.is_admin
        or ctx.is_secretary
        or ctx.is_head_scrutineer
        or ctx.is_scrutineer_staff
        or ctx.is_offsite_scrutineer
        or ctx.is_president
        or ctx.is_steward
        or ctx.is_clerk
      ) as can_read_all_entries,
      case
        when ctx.is_admin then 'admin'
        when ctx.is_secretary then 'secretary'
        when ctx.is_head_scrutineer then 'head_scrutineer'
        when ctx.is_scrutineer_staff or ctx.is_offsite_scrutineer then 'scrutineer'
        when ctx.is_president or ctx.is_steward or ctx.is_clerk then 'committee'
        when ctx.is_team_manager then 'team_manager'
        when ctx.is_competitor then 'competitor'
        else 'authenticated'
      end as scope
    from ctx
  ), visible_entries as (
    select
      ef.*,
      ev.name as event_name,
      ev.event_order,
      s.year as season_year,
      sr.name as series_name,
      g.name as grade_name
    from public.entry_forms ef
    join public.events ev on ev.id = ef.event_id
    join public.seasons s on s.id = ef.season_id
    join public.series_races sr on sr.id = ef.series_race_id
    join public.grades g on g.id = ef.grade_id
    cross join role_scope rs
    where ef.deleted_at is null
      and (
        rs.can_read_all_entries
        or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id)
      )
  ), visible_requests as (
    select cr.*
    from public.competitor_requests cr
    join public.entry_forms ef on ef.id = cr.entry_form_id
    cross join role_scope rs
    where cr.deleted_at is null
      and (
        rs.is_admin
        or rs.is_secretary
        or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id)
        or cr.requester_profile_id = rs.profile_id
        or exists (
          select 1
          from public.request_approvals ra
          where ra.competitor_request_id = cr.id
            and ra.approver_profile_id = rs.profile_id
        )
      )
  ), entry_metrics as (
    select
      count(*) filter (where status = 'Draft'::public.entry_form_status)::int as draft_entry_forms,
      count(*) filter (where status = 'Pending'::public.entry_form_status)::int as pending_entry_forms,
      count(*) filter (where status = 'Active'::public.entry_form_status)::int as active_entry_forms,
      count(*) filter (where status = 'Rejected'::public.entry_form_status)::int as rejected_entry_forms,
      count(*) filter (where status = 'Active'::public.entry_form_status and is_eligible_to_race = true)::int as eligible_to_race
    from visible_entries
  ), request_metrics as (
    select
      count(*) filter (where status in ('Need Racer Approval'::public.competitor_request_status, 'Pending'::public.competitor_request_status, 'In Review'::public.competitor_request_status))::int as pending_requests,
      count(*) filter (where status = 'Need Racer Approval'::public.competitor_request_status)::int as racer_approval_required,
      count(*) filter (where status = 'Approved'::public.competitor_request_status)::int as approved_requests,
      count(*) filter (where status = 'Rejected'::public.competitor_request_status)::int as rejected_requests
    from visible_requests
  ), request_review_metrics as (
    select count(*)::int as request_review_queue
    from public.request_approvals ra
    cross join role_scope rs
    where ra.approver_profile_id = rs.profile_id
      and ra.status = 'Pending'::public.request_approval_status
  ), inspection_metrics as (
    select
      count(*) filter (where inf.status = 'Draft'::public.inspection_form_status)::int as inspection_draft,
      count(*) filter (where inf.status = 'Pending'::public.inspection_form_status)::int as inspection_pending,
      count(*) filter (where inf.status = 'Hold'::public.inspection_form_status)::int as inspection_hold,
      count(*) filter (where inf.status = 'Failed'::public.inspection_form_status)::int as inspection_failed,
      count(*) filter (where inf.status = 'Passed'::public.inspection_form_status)::int as inspection_passed
    from public.inspection_forms inf
    join visible_entries ve on ve.id = inf.entry_form_id
  ), weight_metrics as (
    select
      count(*) filter (where wl.status = 'Pending'::public.weigh_in_status)::int as weight_in_pending,
      count(*) filter (where wl.status = 'Passed'::public.weigh_in_status)::int as weight_in_passed,
      count(*) filter (where wl.status = 'Failed'::public.weigh_in_status)::int as weight_in_failed
    from public.weigh_in_logs wl
    join visible_entries ve on ve.id = wl.entry_form_id
    where wl.status <> 'Void'::public.weigh_in_status
  ), scrutineer_report_metrics as (
    select
      count(*) filter (where srp.status = 'Draft'::public.scrutineer_report_status)::int as scrutineer_reports_draft,
      count(*) filter (where srp.status = 'Official'::public.scrutineer_report_status)::int as scrutineer_reports_official
    from public.scrutineer_reports srp
    cross join role_scope rs
    where srp.deleted_at is null
      and rs.can_read_all_entries
  ), race_result_metrics as (
    select
      count(*) filter (where rr.status = 'Draft'::public.race_result_status)::int as race_results_draft,
      count(*) filter (where rr.status = 'Provisional'::public.race_result_status)::int as race_results_provisional,
      count(*) filter (where rr.is_official = true)::int as race_results_official
    from public.race_results rr
  ), notification_metrics as (
    select count(*) filter (where n.is_read = false)::int as unread_notifications
    from public.notifications n
    cross join role_scope rs
    where n.recipient_profile_id = rs.profile_id
  ), team_metrics as (
    select count(distinct tm.competitor_profile_id)::int as team_competitors
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    cross join role_scope rs
    where t.owner_profile_id = rs.profile_id
      and tm.status = 'Accepted'::public.invitation_status
      and tm.revoked_at is null
  ), alert_candidates as (
    select
      n.created_at as sort_at,
      jsonb_build_object(
        'type', 'notification',
        'severity', 'info',
        'title', n.title,
        'description', coalesce(n.body, 'Open the linked workflow for details.'),
        'timestamp', n.created_at,
        'path', case n.link_entity_type
          when 'entry_form' then '/entry-forms'
          when 'competitor_request' then '/competitor-requests'
          when 'inspection_form' then '/inspection-forms'
          when 'weigh_in' then '/weight-in'
          when 'scrutineer_report' then '/scrutineer-reports'
          when 'race_result' then '/race-results'
          else '/dashboard'
        end
      ) as alert
    from public.notifications n
    cross join role_scope rs
    where n.recipient_profile_id = rs.profile_id
      and n.is_read = false

    union all

    select
      ve.updated_at as sort_at,
      jsonb_build_object(
        'type', 'entry_form',
        'severity', case when ve.status = 'Rejected'::public.entry_form_status then 'danger' else 'info' end,
        'title', 'Entry Form ' || ve.status::text,
        'description', ve.event_name || ' / ' || ve.series_name || ' - ' || ve.grade_name || ' / Car ' || ve.car_number,
        'timestamp', ve.updated_at,
        'path', '/entry-forms'
      ) as alert
    from visible_entries ve
    where ve.status in ('Pending'::public.entry_form_status, 'Active'::public.entry_form_status, 'Rejected'::public.entry_form_status)

    union all

    select
      now() as sort_at,
      jsonb_build_object(
        'type', 'technical_issue',
        'severity', 'warning',
        'title', 'Technical checks require attention',
        'description', count(*)::text || ' visible inspection or weight-in issue(s) are not cleared.',
        'timestamp', now(),
        'path', '/inspection-forms'
      ) as alert
    from role_scope rs
    cross join inspection_metrics im
    cross join weight_metrics wm
    where rs.can_read_all_entries
      and (coalesce(im.inspection_hold, 0) + coalesce(im.inspection_failed, 0) + coalesce(wm.weight_in_failed, 0)) > 0
  ), alert_rows as (
    select coalesce(jsonb_agg(alert order by sort_at desc), '[]'::jsonb) as alerts
    from (
      select alert, sort_at
      from alert_candidates
      order by sort_at desc
      limit 6
    ) recent_alerts
  ), metric_payload as (
    select jsonb_build_object(
      'draftEntryForms', coalesce(em.draft_entry_forms, 0),
      'pendingEntryForms', coalesce(em.pending_entry_forms, 0),
      'activeEntryForms', coalesce(em.active_entry_forms, 0),
      'rejectedEntryForms', coalesce(em.rejected_entry_forms, 0),
      'eligibleToRace', coalesce(em.eligible_to_race, 0),
      'pendingRequests', coalesce(rm.pending_requests, 0),
      'racerApprovalRequired', coalesce(rm.racer_approval_required, 0),
      'approvedRequests', coalesce(rm.approved_requests, 0),
      'rejectedRequests', coalesce(rm.rejected_requests, 0),
      'requestReviewQueue', coalesce(rrm.request_review_queue, 0),
      'inspectionDraft', coalesce(im.inspection_draft, 0),
      'inspectionPending', coalesce(im.inspection_pending, 0),
      'inspectionHold', coalesce(im.inspection_hold, 0),
      'inspectionFailed', coalesce(im.inspection_failed, 0),
      'inspectionPassed', coalesce(im.inspection_passed, 0),
      'weightInPending', coalesce(wm.weight_in_pending, 0),
      'weightInPassed', coalesce(wm.weight_in_passed, 0),
      'weightInFailed', coalesce(wm.weight_in_failed, 0),
      'scrutineerReportsDraft', coalesce(srm.scrutineer_reports_draft, 0),
      'scrutineerReportsOfficial', coalesce(srm.scrutineer_reports_official, 0),
      'raceResultsDraft', coalesce(rrsm.race_results_draft, 0),
      'raceResultsProvisional', coalesce(rrsm.race_results_provisional, 0),
      'raceResultsOfficial', coalesce(rrsm.race_results_official, 0),
      'unreadNotifications', coalesce(nm.unread_notifications, 0),
      'teamCompetitors', coalesce(tm.team_competitors, 0)
    ) as metrics
    from entry_metrics em
    cross join request_metrics rm
    cross join request_review_metrics rrm
    cross join inspection_metrics im
    cross join weight_metrics wm
    cross join scrutineer_report_metrics srm
    cross join race_result_metrics rrsm
    cross join notification_metrics nm
    cross join team_metrics tm
  ), action_rows as (
    select case
      when rs.is_admin then jsonb_build_array(
        jsonb_build_object('label', 'Open Organizer Settings', 'path', '/organizer-settings', 'count', 0),
        jsonb_build_object('label', 'Manage User & Role', 'path', '/settings/user-roles', 'count', 0),
        jsonb_build_object('label', 'Review Audit Trail', 'path', '/audit-trail', 'count', 0)
      )
      when rs.is_secretary then jsonb_build_array(
        jsonb_build_object('label', 'Review Entry Forms', 'path', '/entry-forms', 'count', mp.metrics -> 'pendingEntryForms'),
        jsonb_build_object('label', 'Open Checklist', 'path', '/checklist', 'count', mp.metrics -> 'activeEntryForms'),
        jsonb_build_object('label', 'Process Competitor Requests', 'path', '/competitor-requests', 'count', mp.metrics -> 'pendingRequests')
      )
      when rs.is_head_scrutineer then jsonb_build_array(
        jsonb_build_object('label', 'Work Inspection Queue', 'path', '/inspection-forms', 'count', (mp.metrics ->> 'inspectionPending')::int + (mp.metrics ->> 'inspectionHold')::int + (mp.metrics ->> 'inspectionFailed')::int),
        jsonb_build_object('label', 'Open Weight-In', 'path', '/weight-in', 'count', (mp.metrics ->> 'weightInPending')::int + (mp.metrics ->> 'weightInFailed')::int),
        jsonb_build_object('label', 'Publish Scrutineer Reports', 'path', '/scrutineer-reports', 'count', mp.metrics -> 'scrutineerReportsDraft')
      )
      when rs.is_scrutineer_staff or rs.is_offsite_scrutineer then jsonb_build_array(
        jsonb_build_object('label', 'Open Inspection Forms', 'path', '/inspection-forms', 'count', (mp.metrics ->> 'inspectionPending')::int + (mp.metrics ->> 'inspectionHold')::int),
        jsonb_build_object('label', 'Open Weight-In', 'path', '/weight-in', 'count', (mp.metrics ->> 'weightInPending')::int + (mp.metrics ->> 'weightInFailed')::int),
        jsonb_build_object('label', 'View Checklist', 'path', '/checklist', 'count', mp.metrics -> 'activeEntryForms')
      )
      when rs.is_president or rs.is_steward or rs.is_clerk then jsonb_build_array(
        jsonb_build_object('label', 'Review Assigned Requests', 'path', '/competitor-requests', 'count', mp.metrics -> 'requestReviewQueue'),
        jsonb_build_object('label', 'View Race Results', 'path', '/race-results', 'count', mp.metrics -> 'raceResultsProvisional'),
        jsonb_build_object('label', 'View Scrutineer Reports', 'path', '/scrutineer-reports', 'count', mp.metrics -> 'scrutineerReportsOfficial')
      )
      else jsonb_build_array(
        jsonb_build_object('label', 'Open Entry Forms', 'path', '/entry-forms', 'count', (mp.metrics ->> 'pendingEntryForms')::int + (mp.metrics ->> 'activeEntryForms')::int),
        jsonb_build_object('label', 'Track Inspection Status', 'path', '/inspection-forms', 'count', (mp.metrics ->> 'inspectionHold')::int + (mp.metrics ->> 'inspectionFailed')::int),
        jsonb_build_object('label', 'Open Competitor Requests', 'path', '/competitor-requests', 'count', mp.metrics -> 'pendingRequests')
      )
    end as next_actions
    from role_scope rs
    cross join metric_payload mp
  )
  select
    rs.scope,
    mp.metrics,
    ar.alerts,
    act.next_actions
  from role_scope rs
  cross join metric_payload mp
  cross join alert_rows ar
  cross join action_rows act;
$$;

revoke all on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated, service_role;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');

commit;
