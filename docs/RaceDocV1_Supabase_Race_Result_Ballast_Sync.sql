-- RaceDocV1 Race Result Success Ballast Sync
-- Purpose: keep Race Result, Weight-In, and standings aligned through database-owned
-- Success Ballast calculation and next-race ballast ledger propagation.

create or replace function public.calculate_race_result_success_ballast(
  p_entry_form_id uuid,
  p_position integer,
  p_result_code text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with rule_data as (
    select
      br.ballast_type,
      br.max_ballast_kg,
      coalesce(
        (br.position_matrix ->> p_position::text)::numeric,
        (br.position_matrix #>> array['positions', p_position::text])::numeric,
        0
      ) as raw_ballast_kg
    from public.entry_forms ef
    left join public.ballast_rules br on br.event_series_rule_id = ef.event_series_rule_id
    where ef.id = p_entry_form_id
  )
  select case
    when p_result_code <> 'Classified' or p_position is null then 0
    when coalesce(ballast_type::text, 'None') <> 'SuccessBallast' then 0
    else least(raw_ballast_kg, coalesce(max_ballast_kg, raw_ballast_kg))
  end
  from rule_data;
$$;

create or replace function public.save_race_result_entry(
  p_race_result_id uuid,
  p_entry_form_id uuid,
  p_starting_position integer,
  p_position integer,
  p_result_code text,
  p_pole_position boolean default false,
  p_fastest_lap boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_result public.race_results%rowtype;
  v_entry public.entry_forms%rowtype;
  v_entry_id uuid;
  v_points numeric;
  v_success_ballast numeric;
begin
  if not public.is_race_result_editor() then
    raise exception 'Only Admin or Steward can edit Race Result entries.';
  end if;

  select * into v_result from public.race_results where id = p_race_result_id;
  if v_result.id is null then
    raise exception 'Race Result was not found.';
  end if;
  if v_result.is_official then
    raise exception 'Official Race Results are locked.';
  end if;

  select * into v_entry from public.entry_forms where id = p_entry_form_id;
  if v_entry.id is null or v_entry.event_id <> (select event_id from public.races where id = v_result.race_id) or v_entry.series_race_id <> v_result.series_race_id or v_entry.grade_id <> v_result.grade_id then
    raise exception 'Entry Form does not match this Race Result scope.';
  end if;

  v_points := public.calculate_race_result_points(p_entry_form_id, p_position, p_result_code, p_pole_position, p_fastest_lap);
  v_success_ballast := public.calculate_race_result_success_ballast(p_entry_form_id, p_position, p_result_code);

  insert into public.race_result_entries (race_result_id, entry_form_id, starting_position, "position", result_code, points, success_ballast_delta_kg, pole_position, fastest_lap)
  values (p_race_result_id, p_entry_form_id, p_starting_position, p_position, p_result_code::public.race_result_code, coalesce(v_points, 0), coalesce(v_success_ballast, 0), coalesce(p_pole_position, false), coalesce(p_fastest_lap, false))
  on conflict (race_result_id, entry_form_id) do update set
    starting_position = excluded.starting_position,
    "position" = excluded."position",
    result_code = excluded.result_code,
    points = excluded.points,
    success_ballast_delta_kg = excluded.success_ballast_delta_kg,
    pole_position = excluded.pole_position,
    fastest_lap = excluded.fastest_lap
  returning id into v_entry_id;

  update public.race_results
  set status = 'Provisional'::public.race_result_status
  where id = p_race_result_id
    and status = 'Draft'::public.race_result_status;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values (
    'race_result_entry',
    v_entry_id,
    'save',
    jsonb_build_object('position', p_position, 'result_code', p_result_code, 'points', coalesce(v_points, 0), 'success_ballast_delta_kg', coalesce(v_success_ballast, 0)),
    v_actor_profile_id
  );

  return v_entry_id;
end;
$$;

create unique index if not exists ballast_ledger_success_ballast_source_uk
  on public.ballast_ledger (source_type, source_id)
  where source_type = 'SuccessBallast' and source_id is not null;

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
  v_entry record;
  v_rank integer := 0;
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

  select next_race.id into v_next_race_id
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

  if v_next_race_id is not null then
    insert into public.ballast_ledger (
      entry_form_id,
      race_id,
      ballast_kg,
      source_type,
      source_id,
      applies_to_next_race
    )
    select
      rre.entry_form_id,
      v_next_race_id,
      rre.success_ballast_delta_kg,
      'SuccessBallast',
      rre.id,
      true
    from public.race_result_entries rre
    where rre.race_result_id = p_race_result_id
      and rre.success_ballast_delta_kg > 0
    on conflict (source_type, source_id) where source_type = 'SuccessBallast' and source_id is not null do update set
      race_id = excluded.race_id,
      ballast_kg = excluded.ballast_kg,
      applies_to_next_race = excluded.applies_to_next_race;
  end if;

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

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'race_result',
    p_race_result_id,
    'publish',
    v_result.status::text,
    'Official',
    jsonb_build_object('next_race_id', v_next_race_id),
    v_actor_profile_id
  );
end;
$$;

revoke execute on function public.calculate_race_result_success_ballast(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.save_race_result_entry(uuid, uuid, integer, integer, text, boolean, boolean) from public, anon;
revoke execute on function public.publish_race_result(uuid) from public, anon;

grant execute on function public.save_race_result_entry(uuid, uuid, integer, integer, text, boolean, boolean) to authenticated, service_role;
grant execute on function public.publish_race_result(uuid) to authenticated, service_role;
