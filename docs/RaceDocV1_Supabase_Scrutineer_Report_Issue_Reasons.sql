-- RaceDocV1 Scrutineer Report Issue Reasons
-- Purpose: make Scrutineer Report failed-car reasons use the official
-- Inspection issue note and item-level comments captured by officials.

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
      latest_ifv.issue_note as inspection_issue_note,
      coalesce(item_issues.item_issues, '[]'::jsonb) as inspection_item_issues,
      item_issues.item_issue_summary as inspection_item_issue_summary,
      latest_wi.status::text as weigh_in_status,
      latest_wi.target_weight_kg,
      latest_wi.actual_weight_kg,
      latest_wi.weighed_at,
      case
        when latest_wi.actual_weight_kg is not null
         and latest_wi.target_weight_kg is not null
         and latest_wi.actual_weight_kg < latest_wi.target_weight_kg
          then latest_wi.target_weight_kg - latest_wi.actual_weight_kg
        else null
      end as missing_weight_kg,
      case
        when inf.status = 'Passed'::public.inspection_form_status and latest_wi.status = 'Passed'::public.weigh_in_status then true
        else false
      end as passed_all,
      case
        when inf.id is null then 'Inspection form missing'
        when inf.status <> 'Passed'::public.inspection_form_status then concat_ws(' - ', 'Inspection ' || inf.status::text, latest_ifv.issue_note, item_issues.item_issue_summary)
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
      select
        ifv.id,
        nullif(btrim(ifv.answers_snapshot ->> 'issueNote'), '') as issue_note
      from public.inspection_form_versions ifv
      where ifv.inspection_form_id = inf.id
      order by
        case when ifv.version_no = inf.current_version_no then 0 else 1 end,
        ifv.version_no desc
      limit 1
    ) latest_ifv on true
    left join lateral (
      select
        jsonb_agg(jsonb_build_object(
          'label', coalesce(nullif(btrim(iti.label_en), ''), iti.label_th, 'Inspection item'),
          'status', iir.result_status::text,
          'comment', nullif(btrim(iir.comment), '')
        ) order by iti.sort_order, iti.label_th) as item_issues,
        string_agg(
          coalesce(nullif(btrim(iti.label_en), ''), iti.label_th, 'Inspection item') || coalesce(': ' || nullif(btrim(iir.comment), ''), ''),
          '; ' order by iti.sort_order, iti.label_th
        ) as item_issue_summary
      from public.inspection_item_results iir
      left join public.inspection_template_items iti on iti.id = iir.template_item_id
      where iir.inspection_version_id = latest_ifv.id
        and (
          iir.result_status::text <> 'Passed'
          or nullif(btrim(iir.comment), '') is not null
        )
    ) item_issues on true
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
        'inspectionIssueNote', inspection_issue_note,
        'inspectionItemIssues', inspection_item_issues,
        'weighInStatus', weigh_in_status,
        'targetWeightKg', target_weight_kg,
        'actualWeightKg', actual_weight_kg,
        'missingWeightKg', missing_weight_kg,
        'issueReason', issue_reason
      ) order by car_number)
      from scoped_entries
      where not passed_all
    ), '[]'::jsonb),
    'generatedAt', now()
  );
$$;

revoke execute on function public.build_scrutineer_report_snapshot(uuid, uuid, uuid) from public, anon;
grant execute on function public.build_scrutineer_report_snapshot(uuid, uuid, uuid) to authenticated, service_role;
