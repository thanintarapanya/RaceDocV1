-- RaceDocV1 Organizer Settings Series/Grade Layer
-- Purpose: Admin-managed Series Race and Grade master data plus per-season activation.

create index if not exists season_series_series_race_id_idx
  on public.season_series (series_race_id);

create index if not exists season_series_grades_grade_id_idx
  on public.season_series_grades (grade_id);

create or replace function public.get_organizer_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with organization_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'organizationId', o.id,
        'name', o.name,
        'slug', o.slug,
        'isActive', o.is_active
      ) order by o.name
    ), '[]'::jsonb) as organizations
    from public.organizations o
  ), circuit_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'circuitId', c.id,
        'name', c.name,
        'location', c.location,
        'country', c.country
      ) order by c.name
    ), '[]'::jsonb) as circuits
    from public.circuits c
  ), series_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'seriesRaceId', sr.id,
        'organizationId', sr.organization_id,
        'code', sr.code,
        'name', sr.name,
        'ballastType', sr.ballast_type::text,
        'isActive', sr.is_active
      ) order by sr.name
    ), '[]'::jsonb) as series_races
    from public.series_races sr
  ), grade_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'gradeId', g.id,
        'code', g.code,
        'name', g.name,
        'sortOrder', g.sort_order
      ) order by g.sort_order, g.name
    ), '[]'::jsonb) as grades
    from public.grades g
  ), season_series_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'seasonSeriesId', ss.id,
        'seasonId', ss.season_id,
        'seriesRaceId', ss.series_race_id,
        'seriesName', sr.name,
        'isActive', ss.is_active
      ) order by sr.name
    ), '[]'::jsonb) as season_series
    from public.season_series ss
    join public.series_races sr on sr.id = ss.series_race_id
  ), season_series_grade_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'seasonSeriesGradeId', ssg.id,
        'seasonSeriesId', ssg.season_series_id,
        'seasonId', ss.season_id,
        'seriesRaceId', ss.series_race_id,
        'gradeId', ssg.grade_id,
        'gradeName', g.name,
        'isActive', ssg.is_active
      ) order by g.sort_order, g.name
    ), '[]'::jsonb) as seasonSeriesGrades
    from public.season_series_grades ssg
    join public.season_series ss on ss.id = ssg.season_series_id
    join public.grades g on g.id = ssg.grade_id
  ), race_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'raceId', r.id,
        'eventId', r.event_id,
        'name', r.name,
        'raceOrder', r.race_order,
        'sessionType', r.session_type,
        'scheduledAt', r.scheduled_at,
        'resultsImportUnlocked', r.results_import_unlocked
      ) order by r.race_order, r.name
    ), '[]'::jsonb) as races
    from public.races r
  ), event_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'seasonId', e.season_id,
        'circuitId', e.circuit_id,
        'circuitName', c.name,
        'name', e.name,
        'eventOrder', e.event_order,
        'startsOn', e.starts_on,
        'endsOn', e.ends_on,
        'status', e.status::text
      ) order by e.event_order, e.name
    ), '[]'::jsonb) as events
    from public.events e
    left join public.circuits c on c.id = e.circuit_id
  ), season_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'seasonId', s.id,
        'organizationId', s.organization_id,
        'name', s.name,
        'year', s.year,
        'plannedEventCount', s.planned_event_count,
        'status', s.status::text,
        'isActive', s.is_active,
        'activatedAt', s.activated_at
      ) order by s.year desc, s.name
    ), '[]'::jsonb) as seasons
    from public.seasons s
  )
  select jsonb_build_object(
    'canManage', public.has_role('ADMIN', null),
    'organizations', case when public.has_role('ADMIN', null) then organization_rows.organizations else '[]'::jsonb end,
    'circuits', case when public.has_role('ADMIN', null) then circuit_rows.circuits else '[]'::jsonb end,
    'seriesRaces', case when public.has_role('ADMIN', null) then series_rows.series_races else '[]'::jsonb end,
    'grades', case when public.has_role('ADMIN', null) then grade_rows.grades else '[]'::jsonb end,
    'seasonSeries', case when public.has_role('ADMIN', null) then season_series_rows.season_series else '[]'::jsonb end,
    'seasonSeriesGrades', case when public.has_role('ADMIN', null) then season_series_grade_rows.seasonSeriesGrades else '[]'::jsonb end,
    'seasons', case when public.has_role('ADMIN', null) then season_rows.seasons else '[]'::jsonb end,
    'events', case when public.has_role('ADMIN', null) then event_rows.events else '[]'::jsonb end,
    'races', case when public.has_role('ADMIN', null) then race_rows.races else '[]'::jsonb end
  )
  from organization_rows, circuit_rows, series_rows, grade_rows, season_series_rows, season_series_grade_rows, season_rows, event_rows, race_rows;
$$;

create or replace function public.save_organizer_series_race(
  p_series_race_id uuid default null,
  p_organization_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_ballast_type text default 'None',
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_organization_id uuid;
  v_series_race_id uuid;
  v_code text;
  v_ballast_type public.ballast_type;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  select id into v_organization_id
  from public.organizations
  where id = p_organization_id or (p_organization_id is null and is_active = true)
  order by is_active desc, name
  limit 1;

  if v_organization_id is null then
    raise exception 'Organization is required.';
  end if;

  v_code := upper(regexp_replace(nullif(btrim(coalesce(p_code, '')), ''), '[^a-zA-Z0-9]+', '_', 'g'));

  if v_code is null then
    raise exception 'Series code is required.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Series name is required.';
  end if;

  begin
    v_ballast_type := coalesce(nullif(btrim(coalesce(p_ballast_type, '')), ''), 'None')::public.ballast_type;
  exception when invalid_text_representation then
    raise exception 'Invalid ballast type.';
  end;

  if p_series_race_id is not null then
    select to_jsonb(sr.*) into v_old_values from public.series_races sr where sr.id = p_series_race_id;

    if v_old_values is null then
      raise exception 'Series Race was not found.';
    end if;

    update public.series_races
    set organization_id = v_organization_id,
        code = v_code,
        name = btrim(p_name),
        ballast_type = v_ballast_type,
        is_active = coalesce(p_is_active, true)
    where id = p_series_race_id
    returning id, to_jsonb(public.series_races.*) into v_series_race_id, v_new_values;
  else
    insert into public.series_races (organization_id, code, name, ballast_type, is_active)
    values (v_organization_id, v_code, btrim(p_name), v_ballast_type, coalesce(p_is_active, true))
    returning id, to_jsonb(public.series_races.*) into v_series_race_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('series_race', v_series_race_id, case when p_series_race_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_series_race_id;
end;
$$;

create or replace function public.save_organizer_grade(
  p_grade_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_grade_id uuid;
  v_code text;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  v_code := upper(regexp_replace(nullif(btrim(coalesce(p_code, '')), ''), '[^a-zA-Z0-9]+', '_', 'g'));

  if v_code is null then
    raise exception 'Grade code is required.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Grade name is required.';
  end if;

  if p_grade_id is not null then
    select to_jsonb(g.*) into v_old_values from public.grades g where g.id = p_grade_id;

    if v_old_values is null then
      raise exception 'Grade was not found.';
    end if;

    update public.grades
    set code = v_code,
        name = btrim(p_name),
        sort_order = coalesce(p_sort_order, 0)
    where id = p_grade_id
    returning id, to_jsonb(public.grades.*) into v_grade_id, v_new_values;
  else
    insert into public.grades (code, name, sort_order)
    values (v_code, btrim(p_name), coalesce(p_sort_order, 0))
    returning id, to_jsonb(public.grades.*) into v_grade_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('grade', v_grade_id, case when p_grade_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_grade_id;
end;
$$;

create or replace function public.set_organizer_season_series(
  p_season_id uuid,
  p_series_race_id uuid,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_season_series_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception 'Season was not found.';
  end if;

  if not exists (select 1 from public.series_races where id = p_series_race_id) then
    raise exception 'Series Race was not found.';
  end if;

  select to_jsonb(ss.*) into v_old_values
  from public.season_series ss
  where ss.season_id = p_season_id
    and ss.series_race_id = p_series_race_id;

  insert into public.season_series (season_id, series_race_id, is_active)
  values (p_season_id, p_series_race_id, coalesce(p_is_active, true))
  on conflict (season_id, series_race_id) do update set is_active = excluded.is_active
  returning id, to_jsonb(public.season_series.*) into v_season_series_id, v_new_values;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('season_series', v_season_series_id, case when v_old_values is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_season_series_id;
end;
$$;

create or replace function public.set_organizer_season_series_grade(
  p_season_id uuid,
  p_series_race_id uuid,
  p_grade_id uuid,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_season_series_id uuid;
  v_season_series_grade_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception 'Season was not found.';
  end if;

  if not exists (select 1 from public.series_races where id = p_series_race_id) then
    raise exception 'Series Race was not found.';
  end if;

  insert into public.season_series (season_id, series_race_id, is_active)
  values (p_season_id, p_series_race_id, true)
  on conflict (season_id, series_race_id) do update set is_active = true
  returning id into v_season_series_id;

  if not exists (select 1 from public.grades where id = p_grade_id) then
    raise exception 'Grade was not found.';
  end if;

  select to_jsonb(ssg.*) into v_old_values
  from public.season_series_grades ssg
  where ssg.season_series_id = v_season_series_id
    and ssg.grade_id = p_grade_id;

  insert into public.season_series_grades (season_series_id, grade_id, is_active)
  values (v_season_series_id, p_grade_id, coalesce(p_is_active, true))
  on conflict (season_series_id, grade_id) do update set is_active = excluded.is_active
  returning id, to_jsonb(public.season_series_grades.*) into v_season_series_grade_id, v_new_values;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('season_series_grade', v_season_series_grade_id, case when v_old_values is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_season_series_grade_id;
end;
$$;

revoke execute on function public.get_organizer_settings() from public, anon;
revoke execute on function public.save_organizer_series_race(uuid, uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.save_organizer_grade(uuid, text, text, integer) from public, anon;
revoke execute on function public.set_organizer_season_series(uuid, uuid, boolean) from public, anon;
revoke execute on function public.set_organizer_season_series_grade(uuid, uuid, uuid, boolean) from public, anon;

grant execute on function public.get_organizer_settings() to authenticated, service_role;
grant execute on function public.save_organizer_series_race(uuid, uuid, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.save_organizer_grade(uuid, text, text, integer) to authenticated, service_role;
grant execute on function public.set_organizer_season_series(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.set_organizer_season_series_grade(uuid, uuid, uuid, boolean) to authenticated, service_role;
