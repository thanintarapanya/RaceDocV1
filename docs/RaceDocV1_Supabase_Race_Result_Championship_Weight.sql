-- RaceDocV1 Race Result Championship Weight
-- Purpose: support non-accumulated Championship Weight from official standings,
-- and make carried ballast rows point at the Entry Form for the race being
-- weighed, including when the next race is in a later Event.

begin;

create unique index if not exists ballast_ledger_championship_weight_source_uk
  on public.ballast_ledger (source_type, source_id)
  where source_type = 'ChampionshipWeight'
    and source_id is not null;

create or replace function public.calculate_weight_in_join_weight(
  p_entry_form_id uuid,
  p_race_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with current_context as (
    select
      ef.id as entry_form_id,
      ef.competitor_profile_id,
      ef.season_id,
      ef.series_race_id,
      ef.grade_id,
      r.id as race_id,
      r.race_order,
      e.event_order,
      br.ballast_type,
      br.join_weight_enabled,
      br.max_ballast_kg,
      br.position_matrix
    from public.entry_forms ef
    join public.races r on r.id = p_race_id
    join public.events e on e.id = r.event_id
    left join public.ballast_rules br on br.event_series_rule_id = ef.event_series_rule_id
    where ef.id = p_entry_form_id
      and ef.deleted_at is null
  ), prior_race as (
    select 1
    from current_context cc
    join public.events pe on pe.season_id = cc.season_id
    join public.races pr on pr.event_id = pe.id
    where pe.event_order < cc.event_order
       or (pe.event_order = cc.event_order and pr.race_order < cc.race_order)
    limit 1
  ), prior_result_participation as (
    select 1
    from current_context cc
    join public.entry_forms pef
      on pef.competitor_profile_id = cc.competitor_profile_id
     and pef.season_id = cc.season_id
     and pef.series_race_id = cc.series_race_id
     and pef.grade_id = cc.grade_id
     and pef.deleted_at is null
    join public.race_result_entries rre on rre.entry_form_id = pef.id
    join public.race_results rr on rr.id = rre.race_result_id and rr.is_official = true
    join public.races rrace on rrace.id = rr.race_id
    join public.events re on re.id = rrace.event_id
    where re.event_order < cc.event_order
       or (re.event_order = cc.event_order and rrace.race_order < cc.race_order)
    limit 1
  ), prior_weigh_in_participation as (
    select 1
    from current_context cc
    join public.entry_forms pef
      on pef.competitor_profile_id = cc.competitor_profile_id
     and pef.season_id = cc.season_id
     and pef.series_race_id = cc.series_race_id
     and pef.grade_id = cc.grade_id
     and pef.deleted_at is null
    join public.weigh_in_logs wil on wil.entry_form_id = pef.id
    join public.weigh_in_sessions wis on wis.id = wil.weigh_in_session_id
    join public.races wr on wr.id = wis.race_id
    join public.events we on we.id = wr.event_id
    where we.event_order < cc.event_order
       or (we.event_order = cc.event_order and wr.race_order < cc.race_order)
    limit 1
  ), manual_join as (
    select 1
    from current_context cc
    join public.ballast_ledger bl on bl.entry_form_id = cc.entry_form_id
    where bl.source_type = 'JoinWeight'
      and bl.applies_to_next_race = true
      and (bl.race_id is null or bl.race_id = cc.race_id)
    limit 1
  ), class_success_totals as (
    select
      bl.entry_form_id,
      sum(bl.ballast_kg) as total_ballast_kg
    from current_context cc
    join public.ballast_ledger bl
      on bl.source_type = 'SuccessBallast'
     and bl.applies_to_next_race = true
     and (bl.race_id is null or bl.race_id = cc.race_id)
    join public.entry_forms ef
      on ef.id = bl.entry_form_id
     and ef.season_id = cc.season_id
     and ef.series_race_id = cc.series_race_id
     and ef.grade_id = cc.grade_id
     and ef.status = 'Active'::public.entry_form_status
     and ef.deleted_at is null
     and ef.id <> cc.entry_form_id
    group by bl.entry_form_id
  ), class_championship_totals as (
    select
      bl.entry_form_id,
      sum(bl.ballast_kg) as total_ballast_kg
    from current_context cc
    join public.ballast_ledger bl
      on bl.source_type = 'ChampionshipWeight'
     and bl.applies_to_next_race = true
     and (bl.race_id is null or bl.race_id = cc.race_id)
    join public.entry_forms ef
      on ef.id = bl.entry_form_id
     and ef.season_id = cc.season_id
     and ef.series_race_id = cc.series_race_id
     and ef.grade_id = cc.grade_id
     and ef.status = 'Active'::public.entry_form_status
     and ef.deleted_at is null
     and ef.id <> cc.entry_form_id
    group by bl.entry_form_id
  ), class_max as (
    select
      (select max(total_ballast_kg) from class_success_totals) as max_success_ballast_kg,
      (select max(total_ballast_kg) from class_championship_totals) as max_championship_weight_kg
  )
  select coalesce((
    select case
      when coalesce(cc.join_weight_enabled, false) = false then 0
      when cc.event_order <= 1 then 0
      when not exists (select 1 from prior_race) then 0
      when exists (select 1 from prior_result_participation) then 0
      when exists (select 1 from prior_weigh_in_participation) then 0
      when exists (select 1 from manual_join) then 0
      when coalesce(cc.ballast_type::text, 'None') = 'SuccessBallast' then
        case
          when cm.max_success_ballast_kg is null then 0
          when cc.max_ballast_kg is null then cm.max_success_ballast_kg
          else least(cm.max_success_ballast_kg, cc.max_ballast_kg)
        end
      when coalesce(cc.ballast_type::text, 'None') = 'ChampionshipWeight' then
        case
          when cm.max_championship_weight_kg is not null and cc.max_ballast_kg is not null then least(cm.max_championship_weight_kg, cc.max_ballast_kg)
          when cm.max_championship_weight_kg is not null then cm.max_championship_weight_kg
          when cc.max_ballast_kg is not null then least(coalesce((cc.position_matrix ->> '1')::numeric, (cc.position_matrix #>> array['positions', '1'])::numeric, 0), cc.max_ballast_kg)
          else coalesce((cc.position_matrix ->> '1')::numeric, (cc.position_matrix #>> array['positions', '1'])::numeric, 0)
        end
      else 0
    end
    from current_context cc
    cross join class_max cm
  ), 0);
$$;

create or replace function public.get_weight_in_entries(p_session_id uuid)
returns table(
  entry_id uuid,
  weigh_in_session_id uuid,
  latest_log_id uuid,
  event_name text,
  race_name text,
  session_type text,
  season_year integer,
  series_class text,
  car_number text,
  competitor_name text,
  competitor_email text,
  vehicle_summary text,
  inspection_status text,
  bop_base_weight_kg numeric,
  bop_option_weight_kg numeric,
  success_ballast_kg numeric,
  penalty_weight_kg numeric,
  join_weight_kg numeric,
  target_weight_kg numeric,
  actual_weight_kg numeric,
  status text,
  missing_weight_kg numeric,
  weighed_at timestamptz,
  weighed_by_name text,
  can_edit boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) as can_operate,
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK'], null) as can_read_all
  ), session_row as (
    select wis.*, r.event_id, r.name as race_name, e.name as event_name
    from public.weigh_in_sessions wis
    join public.races r on r.id = wis.race_id
    join public.events e on e.id = r.event_id
    where wis.id = p_session_id
  ), latest_inspection as (
    select distinct on (inf.entry_form_id)
      inf.entry_form_id,
      inf.id as inspection_form_id,
      inf.status,
      coalesce(ifv.bop_base_weight_kg, inf.official_bop_weight_kg, 0) as bop_base_weight_kg,
      coalesce(ifv.bop_option_weight_kg, 0) as bop_option_weight_kg
    from public.inspection_forms inf
    left join public.inspection_form_versions ifv
      on ifv.inspection_form_id = inf.id
     and ifv.version_no = inf.current_version_no
    order by inf.entry_form_id, inf.current_version_no desc
  ), ballast as (
    select
      bl.entry_form_id,
      coalesce(sum(bl.ballast_kg) filter (where bl.source_type in ('SuccessBallast', 'ChampionshipWeight')), 0) as success_ballast_kg,
      coalesce(sum(bl.ballast_kg) filter (where bl.source_type = 'Penalty'), 0) as penalty_weight_kg,
      coalesce(sum(bl.ballast_kg) filter (where bl.source_type = 'JoinWeight'), 0) as manual_join_weight_kg
    from public.ballast_ledger bl
    join session_row sr on true
    where bl.applies_to_next_race = true
      and (bl.race_id is null or bl.race_id = sr.race_id)
    group by bl.entry_form_id
  ), latest_log as (
    select distinct on (wil.entry_form_id)
      wil.*,
      coalesce(nullif(btrim(concat_ws(' ', wp.first_name_th, wp.last_name_th)), ''), nullif(btrim(concat_ws(' ', wp.first_name_en, wp.last_name_en)), ''), 'Official') as weighed_by_name
    from public.weigh_in_logs wil
    left join public.profiles wp on wp.id = wil.weighed_by_id
    where wil.weigh_in_session_id = p_session_id
    order by wil.entry_form_id, wil.weighed_at desc, wil.id desc
  )
  select
    ef.id as entry_id,
    sr.id as weigh_in_session_id,
    ll.id as latest_log_id,
    sr.event_name,
    sr.race_name,
    sr.session_type,
    s.year as season_year,
    ser.name || ' - ' || g.name as series_class,
    ef.car_number,
    coalesce(
      nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''),
      nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''),
      au.email,
      'Competitor'
    ) as competitor_name,
    coalesce(au.email, '') as competitor_email,
    nullif(btrim(concat_ws(' ', ef.vehicle_snapshot ->> 'manufacturer', ef.vehicle_snapshot ->> 'model')), '') as vehicle_summary,
    coalesce(li.status::text, 'NotInspected') as inspection_status,
    coalesce(li.bop_base_weight_kg, 0) as bop_base_weight_kg,
    coalesce(li.bop_option_weight_kg, 0) as bop_option_weight_kg,
    coalesce(b.success_ballast_kg, 0) as success_ballast_kg,
    coalesce(b.penalty_weight_kg, 0) as penalty_weight_kg,
    coalesce(b.manual_join_weight_kg, 0) + coalesce(aj.automatic_join_weight_kg, 0) as join_weight_kg,
    coalesce(
      ll.target_weight_kg,
      coalesce(li.bop_base_weight_kg, 0)
        + coalesce(li.bop_option_weight_kg, 0)
        + coalesce(b.success_ballast_kg, 0)
        + coalesce(b.penalty_weight_kg, 0)
        + coalesce(b.manual_join_weight_kg, 0)
        + coalesce(aj.automatic_join_weight_kg, 0)
    ) as target_weight_kg,
    ll.actual_weight_kg,
    coalesce(ll.status::text, 'Pending') as status,
    case
      when ll.actual_weight_kg is null then null
      when ll.actual_weight_kg >= ll.target_weight_kg then 0
      else ll.target_weight_kg - ll.actual_weight_kg
    end as missing_weight_kg,
    ll.weighed_at,
    ll.weighed_by_name,
    ctx.can_operate as can_edit
  from session_row sr
  join public.entry_forms ef on ef.event_id = sr.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races ser on ser.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles p on p.id = ef.competitor_profile_id
  left join auth.users au on au.id = p.auth_user_id
  left join latest_inspection li on li.entry_form_id = ef.id
  left join ballast b on b.entry_form_id = ef.id
  left join latest_log ll on ll.entry_form_id = ef.id
  left join lateral (
    select public.calculate_weight_in_join_weight(ef.id, sr.race_id) as automatic_join_weight_kg
  ) aj on true
  cross join ctx
  where ef.deleted_at is null
    and ef.status = 'Active'::public.entry_form_status
    and (ctx.can_read_all or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))
  order by ser.name, g.sort_order, ef.car_number;
$$;

create or replace function public.save_weigh_in_log(
  p_session_id uuid,
  p_entry_id uuid,
  p_actual_weight_kg numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_session public.weigh_in_sessions%rowtype;
  v_entry public.entry_forms%rowtype;
  v_inspection_form_id uuid;
  v_bop_base numeric := 0;
  v_bop_option numeric := 0;
  v_success numeric := 0;
  v_penalty numeric := 0;
  v_join numeric := 0;
  v_target numeric := 0;
  v_status public.weigh_in_status;
  v_log_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) then
    raise exception 'Only officials can save Weight-In logs.';
  end if;

  if p_actual_weight_kg is null or p_actual_weight_kg < 0 then
    raise exception 'Actual weight must be a non-negative number.';
  end if;

  select * into v_session
  from public.weigh_in_sessions
  where id = p_session_id;

  if v_session.id is null then
    raise exception 'Weight-In session was not found.';
  end if;

  if v_session.status <> 'Open'::public.weigh_in_session_status then
    raise exception 'Weight-In session is not open.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = p_entry_id
    and deleted_at is null;

  if v_entry.id is null then
    raise exception 'Entry Form was not found.';
  end if;

  if v_entry.status <> 'Active'::public.entry_form_status then
    raise exception 'Only Active Entry Forms can be weighed.';
  end if;

  select
    inf.id,
    coalesce(ifv.bop_base_weight_kg, inf.official_bop_weight_kg, 0),
    coalesce(ifv.bop_option_weight_kg, 0)
  into v_inspection_form_id, v_bop_base, v_bop_option
  from public.inspection_forms inf
  left join public.inspection_form_versions ifv
    on ifv.inspection_form_id = inf.id
   and ifv.version_no = inf.current_version_no
  where inf.entry_form_id = p_entry_id
  order by inf.current_version_no desc
  limit 1;

  select
    coalesce(sum(ballast_kg) filter (where source_type in ('SuccessBallast', 'ChampionshipWeight')), 0),
    coalesce(sum(ballast_kg) filter (where source_type = 'Penalty'), 0),
    coalesce(sum(ballast_kg) filter (where source_type = 'JoinWeight'), 0)
  into v_success, v_penalty, v_join
  from public.ballast_ledger
  where entry_form_id = p_entry_id
    and applies_to_next_race = true
    and (race_id is null or race_id = v_session.race_id);

  v_join := coalesce(v_join, 0) + public.calculate_weight_in_join_weight(p_entry_id, v_session.race_id);
  v_target := coalesce(v_bop_base, 0) + coalesce(v_bop_option, 0) + coalesce(v_success, 0) + coalesce(v_penalty, 0) + coalesce(v_join, 0);
  v_status := case when p_actual_weight_kg >= v_target then 'Passed'::public.weigh_in_status else 'Failed'::public.weigh_in_status end;

  insert into public.weigh_in_logs (
    weigh_in_session_id,
    entry_form_id,
    inspection_form_id,
    bop_base_weight_kg,
    bop_option_weight_kg,
    success_ballast_kg,
    penalty_weight_kg,
    join_weight_kg,
    target_weight_kg,
    actual_weight_kg,
    status,
    weighed_by_id,
    weighed_at
  ) values (
    p_session_id,
    p_entry_id,
    v_inspection_form_id,
    coalesce(v_bop_base, 0),
    coalesce(v_bop_option, 0),
    coalesce(v_success, 0),
    coalesce(v_penalty, 0),
    coalesce(v_join, 0),
    v_target,
    p_actual_weight_kg,
    v_status,
    v_actor_profile_id,
    now()
  ) returning id into v_log_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
  values (
    'weigh_in_log',
    v_log_id,
    'save_actual_weight',
    jsonb_build_object('entry_form_id', p_entry_id, 'target_weight_kg', v_target, 'actual_weight_kg', p_actual_weight_kg, 'join_weight_kg', coalesce(v_join, 0)),
    v_status::text,
    v_actor_profile_id
  );

  return v_log_id;
end;
$$;

create or replace function public.publish_race_result(p_race_result_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_result public.race_results%rowtype;
  v_season_id uuid;
  v_event_id uuid;
  v_event_order integer;
  v_race_order integer;
  v_next_race_id uuid;
  v_next_event_id uuid;
  v_entry record;
  v_ballast_entry record;
  v_championship_entry record;
  v_rank integer := 0;
  v_current_success_ballast numeric := 0;
  v_new_success_ballast numeric := 0;
  v_championship_weight numeric := 0;
begin
  if not public.is_race_result_editor() then
    raise exception 'Only Admin or Steward can publish Race Results.';
  end if;

  select * into v_result from public.race_results where id = p_race_result_id;
  if v_result.id is null then
    raise exception 'Race Result was not found.';
  end if;
  if v_result.is_official then
    raise exception 'Race Result is already Official.';
  end if;

  select e.season_id, e.id, e.event_order, r.race_order
  into v_season_id, v_event_id, v_event_order, v_race_order
  from public.races r
  join public.events e on e.id = r.event_id
  where r.id = v_result.race_id;

  select next_race.id, next_event.id into v_next_race_id, v_next_event_id
  from public.races next_race
  join public.events next_event on next_event.id = next_race.event_id
  where next_event.season_id = v_season_id
    and (
      (next_event.id = v_event_id and next_race.race_order > v_race_order)
      or next_event.event_order > v_event_order
    )
  order by next_event.event_order, next_race.race_order
  limit 1;

  update public.race_results
  set status = 'Official'::public.race_result_status,
      is_official = true,
      signed_off_by_id = v_actor_profile_id,
      signed_off_at = now(),
      signature_path = coalesce(signature_path, 'SIGNED')
  where id = p_race_result_id;

  delete from public.ballast_ledger bl
  using public.race_result_entries rre
  where bl.source_type = 'SuccessBallast'
    and bl.source_id = rre.id
    and rre.race_result_id = p_race_result_id;

  for v_ballast_entry in
    select
      rre.id as race_result_entry_id,
      rre.entry_form_id,
      rre."position" as finish_position,
      rre.result_code::text as result_code,
      br.max_ballast_kg,
      coalesce(next_entry.id, rre.entry_form_id) as next_entry_form_id,
      case
        when br.ballast_type = 'SuccessBallast'::public.ballast_type
         and rre."position" is not null
         and ((br.position_matrix ? rre."position"::text) or (br.position_matrix #> array['positions', rre."position"::text]) is not null)
        then true
        else false
      end as has_award_position,
      case
        when br.ballast_type = 'SuccessBallast'::public.ballast_type
         and rre."position" is not null
        then coalesce(
          (br.position_matrix ->> rre."position"::text)::numeric,
          (br.position_matrix #>> array['positions', rre."position"::text])::numeric,
          0
        )
        else 0
      end as configured_ballast_kg
    from public.race_result_entries rre
    join public.entry_forms ef on ef.id = rre.entry_form_id
    left join public.ballast_rules br on br.event_series_rule_id = ef.event_series_rule_id
    left join public.entry_forms next_entry
      on next_entry.event_id = v_next_event_id
     and next_entry.competitor_profile_id = ef.competitor_profile_id
     and next_entry.season_id = ef.season_id
     and next_entry.series_race_id = ef.series_race_id
     and next_entry.grade_id = ef.grade_id
     and next_entry.status = 'Active'::public.entry_form_status
     and next_entry.deleted_at is null
    where rre.race_result_id = p_race_result_id
  loop
    if v_next_race_id is null then
      continue;
    end if;

    if v_ballast_entry.result_code <> 'Classified' or not v_ballast_entry.has_award_position then
      delete from public.ballast_ledger bl
      where bl.id = (
        select remove_bl.id
        from public.ballast_ledger remove_bl
        where remove_bl.entry_form_id = v_ballast_entry.entry_form_id
          and remove_bl.race_id = v_result.race_id
          and remove_bl.source_type = 'SuccessBallast'
          and remove_bl.applies_to_next_race = true
        order by remove_bl.ballast_kg desc, remove_bl.created_at asc, remove_bl.id
        limit 1
      );

      update public.ballast_ledger bl
      set race_id = v_next_race_id,
          entry_form_id = v_ballast_entry.next_entry_form_id
      where bl.entry_form_id = v_ballast_entry.entry_form_id
        and bl.race_id = v_result.race_id
        and bl.source_type = 'SuccessBallast'
        and bl.applies_to_next_race = true;

      update public.race_result_entries
      set success_ballast_delta_kg = 0
      where id = v_ballast_entry.race_result_entry_id;

      continue;
    end if;

    select coalesce(sum(bl.ballast_kg), 0)
      into v_current_success_ballast
    from public.ballast_ledger bl
    where bl.entry_form_id = v_ballast_entry.entry_form_id
      and bl.race_id = v_result.race_id
      and bl.source_type = 'SuccessBallast'
      and bl.applies_to_next_race = true;

    v_new_success_ballast := greatest(
      0,
      least(
        coalesce(v_ballast_entry.configured_ballast_kg, 0),
        coalesce(v_ballast_entry.max_ballast_kg, v_current_success_ballast + coalesce(v_ballast_entry.configured_ballast_kg, 0)) - v_current_success_ballast
      )
    );

    update public.ballast_ledger bl
    set race_id = v_next_race_id,
        entry_form_id = v_ballast_entry.next_entry_form_id
    where bl.entry_form_id = v_ballast_entry.entry_form_id
      and bl.race_id = v_result.race_id
      and bl.source_type = 'SuccessBallast'
      and bl.applies_to_next_race = true;

    if v_new_success_ballast > 0 then
      insert into public.ballast_ledger (
        entry_form_id,
        race_id,
        ballast_kg,
        source_type,
        source_id,
        applies_to_next_race
      ) values (
        v_ballast_entry.next_entry_form_id,
        v_next_race_id,
        v_new_success_ballast,
        'SuccessBallast',
        v_ballast_entry.race_result_entry_id,
        true
      )
      on conflict (source_type, source_id) where source_type = 'SuccessBallast' and source_id is not null do update set
        entry_form_id = excluded.entry_form_id,
        race_id = excluded.race_id,
        ballast_kg = excluded.ballast_kg,
        applies_to_next_race = excluded.applies_to_next_race;
    end if;

    update public.race_result_entries
    set success_ballast_delta_kg = v_new_success_ballast
    where id = v_ballast_entry.race_result_entry_id;
  end loop;

  for v_entry in
    select ef.competitor_profile_id, ef.team_id, sum(rre.points)::integer as total_points
    from public.race_result_entries rre
    join public.race_results rr on rr.id = rre.race_result_id
    join public.races r on r.id = rr.race_id
    join public.events e on e.id = r.event_id
    join public.entry_forms ef on ef.id = rre.entry_form_id
    where e.season_id = v_season_id
      and rr.series_race_id = v_result.series_race_id
      and rr.grade_id = v_result.grade_id
      and rr.is_official = true
    group by ef.competitor_profile_id, ef.team_id
  loop
    insert into public.championship_standings (season_id, series_race_id, grade_id, competitor_profile_id, team_id, total_points, calculated_at)
    values (v_season_id, v_result.series_race_id, v_result.grade_id, v_entry.competitor_profile_id, v_entry.team_id, v_entry.total_points, now())
    on conflict (season_id, series_race_id, grade_id, competitor_profile_id) do update set
      team_id = excluded.team_id,
      total_points = excluded.total_points,
      calculated_at = now();

    perform public.recalculate_championship_standing_podium_counts(v_season_id, v_result.series_race_id, v_result.grade_id, v_entry.competitor_profile_id);
  end loop;

  update public.championship_standings cs
  set current_ballast_kg = coalesce((
    select sum(bl.ballast_kg)
    from public.ballast_ledger bl
    join public.entry_forms ef on ef.id = bl.entry_form_id
    where ef.competitor_profile_id = cs.competitor_profile_id
      and ef.season_id = cs.season_id
      and ef.series_race_id = cs.series_race_id
      and ef.grade_id = cs.grade_id
      and bl.source_type = 'SuccessBallast'
      and bl.applies_to_next_race = true
      and v_next_race_id is not null
      and bl.race_id = v_next_race_id
  ), 0),
      calculated_at = now()
  where cs.season_id = v_season_id
    and cs.series_race_id = v_result.series_race_id
    and cs.grade_id = v_result.grade_id;

  for v_entry in
    select id
    from public.championship_standings
    where season_id = v_season_id
      and series_race_id = v_result.series_race_id
      and grade_id = v_result.grade_id
    order by total_points desc, p1_count desc, p2_count desc, p3_count desc, calculated_at asc
  loop
    v_rank := v_rank + 1;
    update public.championship_standings set rank = v_rank, calculated_at = now() where id = v_entry.id;
  end loop;

  if v_next_race_id is not null then
    delete from public.ballast_ledger bl
    using public.championship_standings cs
    where bl.source_type = 'ChampionshipWeight'
      and bl.source_id = cs.id
      and bl.race_id = v_next_race_id
      and cs.season_id = v_season_id
      and cs.series_race_id = v_result.series_race_id
      and cs.grade_id = v_result.grade_id
      and not exists (
        select 1
        from public.entry_forms next_entry
        join public.ballast_rules br on br.event_series_rule_id = next_entry.event_series_rule_id
        where next_entry.event_id = v_next_event_id
          and next_entry.competitor_profile_id = cs.competitor_profile_id
          and next_entry.season_id = cs.season_id
          and next_entry.series_race_id = cs.series_race_id
          and next_entry.grade_id = cs.grade_id
          and next_entry.status = 'Active'::public.entry_form_status
          and next_entry.deleted_at is null
          and br.ballast_type = 'ChampionshipWeight'::public.ballast_type
      );

    for v_championship_entry in
      select
        cs.id as standing_id,
        cs.competitor_profile_id,
        cs.rank,
        next_entry.id as next_entry_form_id,
        br.max_ballast_kg,
        br.position_matrix
      from public.championship_standings cs
      join public.entry_forms next_entry
        on next_entry.event_id = v_next_event_id
       and next_entry.competitor_profile_id = cs.competitor_profile_id
       and next_entry.season_id = cs.season_id
       and next_entry.series_race_id = cs.series_race_id
       and next_entry.grade_id = cs.grade_id
       and next_entry.status = 'Active'::public.entry_form_status
       and next_entry.deleted_at is null
      join public.ballast_rules br
        on br.event_series_rule_id = next_entry.event_series_rule_id
       and br.ballast_type = 'ChampionshipWeight'::public.ballast_type
      where cs.season_id = v_season_id
        and cs.series_race_id = v_result.series_race_id
        and cs.grade_id = v_result.grade_id
    loop
      v_championship_weight := greatest(0, coalesce(
        (v_championship_entry.position_matrix ->> v_championship_entry.rank::text)::numeric,
        (v_championship_entry.position_matrix #>> array['positions', v_championship_entry.rank::text])::numeric,
        0
      ));

      if v_championship_entry.max_ballast_kg is not null then
        v_championship_weight := least(v_championship_weight, v_championship_entry.max_ballast_kg);
      end if;

      update public.race_result_entries rre
      set success_ballast_delta_kg = v_championship_weight
      from public.entry_forms current_entry
      where current_entry.id = rre.entry_form_id
        and rre.race_result_id = p_race_result_id
        and current_entry.competitor_profile_id = v_championship_entry.competitor_profile_id;

      update public.championship_standings
      set current_ballast_kg = v_championship_weight,
          calculated_at = now()
      where id = v_championship_entry.standing_id;

      if v_championship_weight > 0 then
        insert into public.ballast_ledger (
          entry_form_id,
          race_id,
          ballast_kg,
          source_type,
          source_id,
          applies_to_next_race
        ) values (
          v_championship_entry.next_entry_form_id,
          v_next_race_id,
          v_championship_weight,
          'ChampionshipWeight',
          v_championship_entry.standing_id,
          true
        )
        on conflict (source_type, source_id) where source_type = 'ChampionshipWeight' and source_id is not null do update set
          entry_form_id = excluded.entry_form_id,
          race_id = excluded.race_id,
          ballast_kg = excluded.ballast_kg,
          applies_to_next_race = excluded.applies_to_next_race;
      else
        delete from public.ballast_ledger
        where source_type = 'ChampionshipWeight'
          and source_id = v_championship_entry.standing_id;
      end if;
    end loop;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'race_result',
    p_race_result_id,
    'publish',
    v_result.status::text,
    'Official',
    jsonb_build_object('next_race_id', v_next_race_id, 'success_ballast_mode', 'accumulated_with_heaviest_removal', 'championship_weight_mode', 'standings_rank_non_accumulated'),
    v_actor_profile_id
  );
end;
$$;

revoke execute on function public.calculate_weight_in_join_weight(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.get_weight_in_entries(uuid) from public, anon;
revoke execute on function public.save_weigh_in_log(uuid, uuid, numeric) from public, anon;
revoke execute on function public.publish_race_result(uuid) from public, anon;

grant execute on function public.calculate_weight_in_join_weight(uuid, uuid) to service_role;
grant execute on function public.get_weight_in_entries(uuid) to authenticated, service_role;
grant execute on function public.save_weigh_in_log(uuid, uuid, numeric) to authenticated, service_role;
grant execute on function public.publish_race_result(uuid) to authenticated, service_role;

commit;
