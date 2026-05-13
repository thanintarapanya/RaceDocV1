-- RaceDocV1 Race Result Workflow
-- Purpose: manual first-slice result entry, Scrutineer Report interlock,
-- official sign-off, and database-owned championship standings cache update.

create or replace function public.get_race_result_options()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'canEdit', public.is_race_result_editor(),
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
  );
$$;

create or replace function public.get_race_results()
returns table(
  race_result_id uuid,
  race_id uuid,
  race_name text,
  event_name text,
  season_year integer,
  series_class text,
  status text,
  is_official boolean,
  results_import_unlocked boolean,
  entry_count integer,
  signed_off_by_name text,
  signed_off_at timestamptz,
  can_edit boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rr.id as race_result_id,
    r.id as race_id,
    r.name as race_name,
    e.name as event_name,
    s.year as season_year,
    sr.name || ' - ' || g.name as series_class,
    rr.status::text as status,
    rr.is_official,
    r.results_import_unlocked,
    (select count(*)::integer from public.race_result_entries rre where rre.race_result_id = rr.id) as entry_count,
    nullif(btrim(concat_ws(' ', signer.first_name_en, signer.last_name_en)), '') as signed_off_by_name,
    rr.signed_off_at,
    public.is_race_result_editor() as can_edit
  from public.race_results rr
  join public.races r on r.id = rr.race_id
  join public.events e on e.id = r.event_id
  join public.seasons s on s.id = e.season_id
  join public.series_races sr on sr.id = rr.series_race_id
  join public.grades g on g.id = rr.grade_id
  left join public.profiles signer on signer.id = rr.signed_off_by_id
  order by s.year desc, e.event_order, r.race_order, sr.name, g.sort_order;
$$;

create or replace function public.get_race_result_entries(p_race_result_id uuid)
returns table(
  race_result_id uuid,
  race_result_status text,
  is_official boolean,
  race_name text,
  event_name text,
  season_year integer,
  series_class text,
  results_import_unlocked boolean,
  entry_id uuid,
  race_result_entry_id uuid,
  car_number text,
  competitor_name text,
  competitor_email text,
  starting_position integer,
  finish_position integer,
  result_code text,
  points numeric,
  success_ballast_delta_kg numeric,
  pole_position boolean,
  fastest_lap boolean,
  can_edit boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rr.id as race_result_id,
    rr.status::text as race_result_status,
    rr.is_official,
    r.name as race_name,
    e.name as event_name,
    s.year as season_year,
    sr.name || ' - ' || g.name as series_class,
    r.results_import_unlocked,
    ef.id as entry_id,
    rre.id as race_result_entry_id,
    ef.car_number,
    coalesce(nullif(btrim(concat_ws(' ', cp.first_name_en, cp.last_name_en)), ''), nullif(btrim(concat_ws(' ', cp.first_name_th, cp.last_name_th)), ''), au.email, 'Unknown competitor') as competitor_name,
    coalesce(au.email, '') as competitor_email,
    rre.starting_position,
    rre."position" as finish_position,
    coalesce(rre.result_code::text, 'Classified') as result_code,
    coalesce(rre.points, 0) as points,
    coalesce(rre.success_ballast_delta_kg, 0) as success_ballast_delta_kg,
    coalesce(rre.pole_position, false) as pole_position,
    coalesce(rre.fastest_lap, false) as fastest_lap,
    public.is_race_result_editor() and rr.is_official = false as can_edit
  from public.race_results rr
  join public.races r on r.id = rr.race_id
  join public.events e on e.id = r.event_id
  join public.seasons s on s.id = e.season_id
  join public.series_races sr on sr.id = rr.series_race_id
  join public.grades g on g.id = rr.grade_id
  join public.entry_forms ef on ef.event_id = e.id and ef.series_race_id = rr.series_race_id and ef.grade_id = rr.grade_id and ef.status = 'Active'::public.entry_form_status and ef.deleted_at is null
  join public.profiles cp on cp.id = ef.competitor_profile_id
  left join auth.users au on au.id = cp.auth_user_id
  left join public.race_result_entries rre on rre.race_result_id = rr.id and rre.entry_form_id = ef.id
  where rr.id = p_race_result_id
  order by coalesce(rre."position", 9999), ef.car_number;
$$;

create or replace function public.create_race_result(
  p_race_id uuid,
  p_series_race_id uuid,
  p_grade_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_result_id uuid;
  v_scrutineer_report_id uuid;
begin
  if not public.is_race_result_editor() then
    raise exception 'Only Admin or Steward can create Race Results.';
  end if;

  if not exists (select 1 from public.races where id = p_race_id and results_import_unlocked = true) then
    raise exception 'Race Result import is locked until the Scrutineer Report is Official.';
  end if;

  select id into v_scrutineer_report_id
  from public.scrutineer_reports
  where race_id = p_race_id
    and series_race_id = p_series_race_id
    and grade_id = p_grade_id
    and status = 'Official'::public.scrutineer_report_status
    and deleted_at is null
  limit 1;

  if v_scrutineer_report_id is null then
    raise exception 'Official Scrutineer Report is required for this Race / Series / Class.';
  end if;

  insert into public.race_results (race_id, series_race_id, grade_id, status, is_official, imported_by_id, scrutineer_report_id)
  values (p_race_id, p_series_race_id, p_grade_id, 'Draft'::public.race_result_status, false, v_actor_profile_id, v_scrutineer_report_id)
  on conflict (race_id, series_race_id, grade_id) do update set
    imported_by_id = excluded.imported_by_id
  returning id into v_result_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values ('race_result', v_result_id, 'create', jsonb_build_object('race_id', p_race_id, 'series_race_id', p_series_race_id, 'grade_id', p_grade_id), v_actor_profile_id);

  return v_result_id;
end;
$$;

create or replace function public.calculate_race_result_points(
  p_entry_form_id uuid,
  p_position integer,
  p_result_code text,
  p_pole_position boolean,
  p_fastest_lap boolean
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_result_code <> 'Classified' or p_position is null then 0
    else coalesce((pr.position_points ->> p_position::text)::numeric, 0)
      + case when coalesce(p_pole_position, false) then coalesce((pr.bonus_points ->> 'pole')::numeric, 0) else 0 end
      + case when coalesce(p_fastest_lap, false) then coalesce((pr.bonus_points ->> 'fastest_lap')::numeric, 0) else 0 end
  end
  from public.entry_forms ef
  left join public.point_rules pr on pr.event_series_rule_id = ef.event_series_rule_id
  where ef.id = p_entry_form_id;
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

  insert into public.race_result_entries (race_result_id, entry_form_id, starting_position, "position", result_code, points, pole_position, fastest_lap)
  values (p_race_result_id, p_entry_form_id, p_starting_position, p_position, p_result_code::public.race_result_code, coalesce(v_points, 0), coalesce(p_pole_position, false), coalesce(p_fastest_lap, false))
  on conflict (race_result_id, entry_form_id) do update set
    starting_position = excluded.starting_position,
    "position" = excluded."position",
    result_code = excluded.result_code,
    points = excluded.points,
    pole_position = excluded.pole_position,
    fastest_lap = excluded.fastest_lap
  returning id into v_entry_id;

  update public.race_results
  set status = 'Provisional'::public.race_result_status
  where id = p_race_result_id
    and status = 'Draft'::public.race_result_status;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values ('race_result_entry', v_entry_id, 'save', jsonb_build_object('position', p_position, 'result_code', p_result_code, 'points', coalesce(v_points, 0)), v_actor_profile_id);

  return v_entry_id;
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

  select e.season_id into v_season_id
  from public.races r
  join public.events e on e.id = r.event_id
  where r.id = v_result.race_id;

  update public.race_results
  set status = 'Official'::public.race_result_status,
      is_official = true,
      signed_off_by_id = v_actor_profile_id,
      signed_off_at = now(),
      signature_path = coalesce(signature_path, 'SIGNED')
  where id = p_race_result_id;

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

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, action_by_id)
  values ('race_result', p_race_result_id, 'publish', v_result.status::text, 'Official', v_actor_profile_id);
end;
$$;

revoke execute on function public.get_race_result_options() from public, anon;
revoke execute on function public.get_race_results() from public, anon;
revoke execute on function public.get_race_result_entries(uuid) from public, anon;
revoke execute on function public.create_race_result(uuid, uuid, uuid) from public, anon;
revoke execute on function public.calculate_race_result_points(uuid, integer, text, boolean, boolean) from public, anon;
revoke execute on function public.save_race_result_entry(uuid, uuid, integer, integer, text, boolean, boolean) from public, anon;
revoke execute on function public.publish_race_result(uuid) from public, anon;

grant execute on function public.get_race_result_options() to authenticated, service_role;
grant execute on function public.get_race_results() to authenticated, service_role;
grant execute on function public.get_race_result_entries(uuid) to authenticated, service_role;
grant execute on function public.create_race_result(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.calculate_race_result_points(uuid, integer, text, boolean, boolean) to authenticated, service_role;
grant execute on function public.save_race_result_entry(uuid, uuid, integer, integer, text, boolean, boolean) to authenticated, service_role;
grant execute on function public.publish_race_result(uuid) to authenticated, service_role;
