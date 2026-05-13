-- RaceDocV1 Scrutineer Report Workflow
-- Purpose: generate one technical race report per Race + Series + Grade,
-- aggregate Inspection and Weight-In status, and unlock Race Result import after
-- Head Scrutineer/Admin publishes the report as Official.

create or replace function public.can_manage_scrutineer_report()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['ADMIN', 'HEAD_SCRUTINEER'], null);
$$;

create or replace function public.can_view_scrutineer_report()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK'], null);
$$;

create or replace function public.build_scrutineer_report_snapshot(
  p_race_id uuid,
  p_series_race_id uuid,
  p_grade_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with report_scope as (
    select
      r.id as race_id,
      r.name as race_name,
      r.race_order,
      r.session_type,
      e.id as event_id,
      e.name as event_name,
      e.event_order,
      s.year as season_year,
      sr.id as series_race_id,
      sr.name as series_name,
      g.id as grade_id,
      g.name as grade_name
    from public.races r
    join public.events e on e.id = r.event_id
    join public.seasons s on s.id = e.season_id
    join public.series_races sr on sr.id = p_series_race_id
    join public.grades g on g.id = p_grade_id
    where r.id = p_race_id
  ), scoped_entries as (
    select
      ef.id as entry_id,
      ef.car_number,
      ef.vehicle_snapshot,
      coalesce(nullif(btrim(concat_ws(' ', cp.first_name_en, cp.last_name_en)), ''), nullif(btrim(concat_ws(' ', cp.first_name_th, cp.last_name_th)), ''), au.email, 'Unknown competitor') as competitor_name,
      coalesce(au.email, '') as competitor_email,
      inf.id as inspection_form_id,
      inf.status::text as inspection_status,
      inf.official_bop_weight_kg,
      latest_wi.status::text as weigh_in_status,
      latest_wi.target_weight_kg,
      latest_wi.actual_weight_kg,
      latest_wi.weighed_at,
      case
        when inf.status = 'Passed'::public.inspection_form_status and latest_wi.status = 'Passed'::public.weigh_in_status then true
        else false
      end as passed_all,
      case
        when inf.id is null then 'Inspection form missing'
        when inf.status <> 'Passed'::public.inspection_form_status then 'Inspection ' || inf.status::text
        when latest_wi.id is null then 'Post-race weigh-in missing'
        when latest_wi.status <> 'Passed'::public.weigh_in_status then 'Weight-In ' || latest_wi.status::text || case when latest_wi.actual_weight_kg is not null and latest_wi.target_weight_kg is not null and latest_wi.actual_weight_kg < latest_wi.target_weight_kg then ' (' || (latest_wi.target_weight_kg - latest_wi.actual_weight_kg)::text || ' kg under)' else '' end
        else null
      end as issue_reason
    from public.entry_forms ef
    join report_scope rs on rs.event_id = ef.event_id and rs.series_race_id = ef.series_race_id and rs.grade_id = ef.grade_id
    join public.profiles cp on cp.id = ef.competitor_profile_id
    left join auth.users au on au.id = cp.auth_user_id
    left join public.inspection_forms inf on inf.entry_form_id = ef.id
    left join lateral (
      select wil.*
      from public.weigh_in_logs wil
      join public.weigh_in_sessions wis on wis.id = wil.weigh_in_session_id
      where wil.entry_form_id = ef.id
        and wis.race_id = rs.race_id
      order by wil.weighed_at desc
      limit 1
    ) latest_wi on true
    where ef.status = 'Active'::public.entry_form_status
      and ef.deleted_at is null
  )
  select jsonb_build_object(
    'context', (
      select jsonb_build_object(
        'raceId', race_id,
        'raceName', race_name,
        'raceOrder', race_order,
        'sessionType', session_type,
        'eventId', event_id,
        'eventName', event_name,
        'eventOrder', event_order,
        'seasonYear', season_year,
        'seriesRaceId', series_race_id,
        'seriesName', series_name,
        'gradeId', grade_id,
        'gradeName', grade_name
      )
      from report_scope
    ),
    'summary', jsonb_build_object(
      'totalCars', (select count(*) from scoped_entries),
      'passedCars', (select count(*) from scoped_entries where passed_all),
      'failedCars', (select count(*) from scoped_entries where not passed_all)
    ),
    'passedCars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entryId', entry_id,
        'carNumber', car_number,
        'competitorName', competitor_name,
        'competitorEmail', competitor_email,
        'inspectionStatus', inspection_status,
        'weighInStatus', weigh_in_status,
        'targetWeightKg', target_weight_kg,
        'actualWeightKg', actual_weight_kg
      ) order by car_number)
      from scoped_entries
      where passed_all
    ), '[]'::jsonb),
    'failedCars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entryId', entry_id,
        'carNumber', car_number,
        'competitorName', competitor_name,
        'competitorEmail', competitor_email,
        'inspectionStatus', inspection_status,
        'weighInStatus', weigh_in_status,
        'targetWeightKg', target_weight_kg,
        'actualWeightKg', actual_weight_kg,
        'issueReason', issue_reason
      ) order by car_number)
      from scoped_entries
      where not passed_all
    ), '[]'::jsonb),
    'generatedAt', now()
  );
$$;

create or replace function public.get_scrutineer_report_options()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'canManage', public.can_manage_scrutineer_report(),
    'races', coalesce((
      select jsonb_agg(jsonb_build_object(
        'raceId', r.id,
        'raceName', r.name,
        'raceOrder', r.race_order,
        'eventId', e.id,
        'eventName', e.name,
        'seasonYear', s.year,
        'resultsImportUnlocked', r.results_import_unlocked
      ) order by s.year desc, e.event_order, r.race_order)
      from public.races r
      join public.events e on e.id = r.event_id
      join public.seasons s on s.id = e.season_id
    ), '[]'::jsonb),
    'classes', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'seriesRaceId', sr.id,
        'seriesName', sr.name,
        'gradeId', g.id,
        'gradeName', g.name,
        'label', sr.name || ' - ' || g.name
      ))
      from public.entry_forms ef
      join public.series_races sr on sr.id = ef.series_race_id
      join public.grades g on g.id = ef.grade_id
      where ef.status = 'Active'::public.entry_form_status
        and ef.deleted_at is null
    ), '[]'::jsonb)
  )
  where public.can_view_scrutineer_report();
$$;

create or replace function public.get_scrutineer_reports()
returns table(
  report_id uuid,
  race_id uuid,
  race_name text,
  event_name text,
  season_year integer,
  series_class text,
  status text,
  total_cars integer,
  passed_cars integer,
  failed_cars integer,
  remarks text,
  signed_by_name text,
  signed_at timestamptz,
  results_import_unlocked boolean,
  report_snapshot jsonb,
  can_manage boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    srp.id as report_id,
    r.id as race_id,
    r.name as race_name,
    e.name as event_name,
    s.year as season_year,
    series.name || ' - ' || g.name as series_class,
    srp.status::text as status,
    coalesce((srp.report_snapshot #>> '{summary,totalCars}')::integer, 0) as total_cars,
    coalesce((srp.report_snapshot #>> '{summary,passedCars}')::integer, 0) as passed_cars,
    coalesce((srp.report_snapshot #>> '{summary,failedCars}')::integer, 0) as failed_cars,
    srp.remarks,
    nullif(btrim(concat_ws(' ', signer.first_name_en, signer.last_name_en)), '') as signed_by_name,
    srp.signed_at,
    r.results_import_unlocked,
    srp.report_snapshot,
    public.can_manage_scrutineer_report() as can_manage
  from public.scrutineer_reports srp
  join public.races r on r.id = srp.race_id
  join public.events e on e.id = r.event_id
  join public.seasons s on s.id = e.season_id
  join public.series_races series on series.id = srp.series_race_id
  join public.grades g on g.id = srp.grade_id
  left join public.profiles signer on signer.id = srp.signed_by_id
  where srp.deleted_at is null
    and public.can_view_scrutineer_report()
  order by s.year desc, e.event_order, r.race_order, series.name, g.sort_order;
$$;

create or replace function public.generate_scrutineer_report(
  p_race_id uuid,
  p_series_race_id uuid,
  p_grade_id uuid,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_report_id uuid;
  v_snapshot jsonb;
  v_existing_status public.scrutineer_report_status;
begin
  if not public.can_manage_scrutineer_report() then
    raise exception 'Only Admin or Head Scrutineer can generate Scrutineer Reports.';
  end if;

  select status into v_existing_status
  from public.scrutineer_reports
  where race_id = p_race_id
    and series_race_id = p_series_race_id
    and grade_id = p_grade_id
    and deleted_at is null;

  if v_existing_status = 'Official'::public.scrutineer_report_status then
    raise exception 'Official Scrutineer Reports cannot be regenerated.';
  end if;

  v_snapshot := public.build_scrutineer_report_snapshot(p_race_id, p_series_race_id, p_grade_id);

  if v_snapshot -> 'context' is null then
    raise exception 'Race, Series, or Class scope was not found.';
  end if;

  insert into public.scrutineer_reports (race_id, series_race_id, grade_id, status, report_snapshot, remarks)
  values (p_race_id, p_series_race_id, p_grade_id, 'Draft'::public.scrutineer_report_status, v_snapshot, nullif(btrim(coalesce(p_remarks, '')), ''))
  on conflict (race_id, series_race_id, grade_id) do update set
    status = 'Draft'::public.scrutineer_report_status,
    report_snapshot = excluded.report_snapshot,
    remarks = excluded.remarks
  returning id into v_report_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values ('scrutineer_report', v_report_id, 'generate', v_snapshot, v_actor_profile_id);

  return v_report_id;
end;
$$;

create or replace function public.publish_scrutineer_report(
  p_report_id uuid,
  p_remarks text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_report public.scrutineer_reports%rowtype;
  v_snapshot jsonb;
begin
  if not public.can_manage_scrutineer_report() then
    raise exception 'Only Admin or Head Scrutineer can publish Scrutineer Reports.';
  end if;

  select * into v_report
  from public.scrutineer_reports
  where id = p_report_id
    and deleted_at is null;

  if v_report.id is null then
    raise exception 'Scrutineer Report was not found.';
  end if;

  v_snapshot := public.build_scrutineer_report_snapshot(v_report.race_id, v_report.series_race_id, v_report.grade_id);

  update public.scrutineer_reports
  set
    status = 'Official'::public.scrutineer_report_status,
    report_snapshot = v_snapshot,
    remarks = nullif(btrim(coalesce(p_remarks, v_report.remarks, '')), ''),
    signed_by_id = v_actor_profile_id,
    signed_at = now(),
    signature_path = coalesce(v_report.signature_path, 'SIGNED')
  where id = p_report_id;

  update public.races
  set results_import_unlocked = true
  where id = v_report.race_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values ('scrutineer_report', p_report_id, 'publish', v_report.status::text, 'Official', v_snapshot, v_actor_profile_id);
end;
$$;

revoke execute on function public.can_manage_scrutineer_report() from public, anon;
revoke execute on function public.can_view_scrutineer_report() from public, anon;
revoke execute on function public.build_scrutineer_report_snapshot(uuid, uuid, uuid) from public, anon;
revoke execute on function public.get_scrutineer_report_options() from public, anon;
revoke execute on function public.get_scrutineer_reports() from public, anon;
revoke execute on function public.generate_scrutineer_report(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.publish_scrutineer_report(uuid, text) from public, anon;

grant execute on function public.can_manage_scrutineer_report() to authenticated, service_role;
grant execute on function public.can_view_scrutineer_report() to authenticated, service_role;
grant execute on function public.build_scrutineer_report_snapshot(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.get_scrutineer_report_options() to authenticated, service_role;
grant execute on function public.get_scrutineer_reports() to authenticated, service_role;
grant execute on function public.generate_scrutineer_report(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.publish_scrutineer_report(uuid, text) to authenticated, service_role;
