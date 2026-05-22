-- RaceDocV1 Organizer Settings Event Rule Foundation
-- Purpose: Admin-managed Event + Series Race + Grade rule anchors for later builders.

create index if not exists event_series_rules_cloned_from_id_idx
  on public.event_series_rules (cloned_from_id);

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
    ), '[]'::jsonb) as season_series_grades
    from public.season_series_grades ssg
    join public.season_series ss on ss.id = ssg.season_series_id
    join public.grades g on g.id = ssg.grade_id
  ), event_series_rule_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'eventSeriesRuleId', esr.id,
        'eventId', esr.event_id,
        'eventName', e.name,
        'seasonId', e.season_id,
        'seriesRaceId', esr.series_race_id,
        'seriesName', sr.name,
        'gradeId', esr.grade_id,
        'gradeName', g.name,
        'status', esr.status::text,
        'version', esr.version,
        'isLocked', esr.is_locked,
        'clonedFromId', esr.cloned_from_id,
        'lockedAt', esr.locked_at
      ) order by e.event_order, sr.name, g.sort_order, esr.version desc
    ), '[]'::jsonb) as event_series_rules
    from public.event_series_rules esr
    join public.events e on e.id = esr.event_id
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
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
    'seasonSeriesGrades', case when public.has_role('ADMIN', null) then season_series_grade_rows.season_series_grades else '[]'::jsonb end,
    'eventSeriesRules', case when public.has_role('ADMIN', null) then event_series_rule_rows.event_series_rules else '[]'::jsonb end,
    'seasons', case when public.has_role('ADMIN', null) then season_rows.seasons else '[]'::jsonb end,
    'events', case when public.has_role('ADMIN', null) then event_rows.events else '[]'::jsonb end,
    'races', case when public.has_role('ADMIN', null) then race_rows.races else '[]'::jsonb end
  )
  from organization_rows, circuit_rows, series_rows, grade_rows, season_series_rows, season_series_grade_rows, event_series_rule_rows, season_rows, event_rows, race_rows;
$$;

create or replace function public.save_organizer_event_series_rule(
  p_event_series_rule_id uuid default null,
  p_event_id uuid default null,
  p_series_race_id uuid default null,
  p_grade_id uuid default null,
  p_status text default 'Draft',
  p_version integer default 1,
  p_is_locked boolean default false,
  p_cloned_from_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_event_series_rule_id uuid;
  v_event_season_id uuid;
  v_status public.rule_status;
  v_is_locked boolean;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if p_event_id is null or p_series_race_id is null or p_grade_id is null then
    raise exception 'Event, Series Race, and Grade are required.';
  end if;

  if coalesce(p_version, 1) <= 0 then
    raise exception 'Rule version must be greater than zero.';
  end if;

  begin
    v_status := coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'Draft')::public.rule_status;
  exception when invalid_text_representation then
    raise exception 'Invalid rule status.';
  end;

  v_is_locked := coalesce(p_is_locked, false) or v_status = 'Locked'::public.rule_status;

  if v_is_locked then
    v_status := 'Locked'::public.rule_status;
  end if;

  select e.season_id into v_event_season_id
  from public.events e
  where e.id = p_event_id;

  if v_event_season_id is null then
    raise exception 'Event was not found.';
  end if;

  if not exists (select 1 from public.series_races where id = p_series_race_id) then
    raise exception 'Series Race was not found.';
  end if;

  if not exists (select 1 from public.grades where id = p_grade_id) then
    raise exception 'Grade was not found.';
  end if;

  if not exists (
    select 1
    from public.season_series ss
    join public.season_series_grades ssg on ssg.season_series_id = ss.id
    where ss.season_id = v_event_season_id
      and ss.series_race_id = p_series_race_id
      and ss.is_active = true
      and ssg.grade_id = p_grade_id
      and ssg.is_active = true
  ) then
    raise exception 'Series Race and Grade must be active in the Event season before creating an Event Rule.';
  end if;

  if p_cloned_from_id is not null and not exists (select 1 from public.event_series_rules where id = p_cloned_from_id) then
    raise exception 'Cloned Event Rule was not found.';
  end if;

  if p_event_series_rule_id is not null then
    select to_jsonb(esr.*) into v_old_values
    from public.event_series_rules esr
    where esr.id = p_event_series_rule_id;

    if v_old_values is null then
      raise exception 'Event Rule was not found.';
    end if;

    if (v_old_values->>'is_locked')::boolean then
      raise exception 'Locked Event Rule cannot be edited. Create a new version instead.';
    end if;

    update public.event_series_rules
    set event_id = p_event_id,
        series_race_id = p_series_race_id,
        grade_id = p_grade_id,
        status = v_status,
        version = coalesce(p_version, 1),
        is_locked = v_is_locked,
        cloned_from_id = p_cloned_from_id,
        locked_at = case when v_is_locked then coalesce(locked_at, now()) else null end
    where id = p_event_series_rule_id
    returning id, to_jsonb(public.event_series_rules.*) into v_event_series_rule_id, v_new_values;
  else
    insert into public.event_series_rules (event_id, series_race_id, grade_id, status, version, is_locked, cloned_from_id, locked_at)
    values (p_event_id, p_series_race_id, p_grade_id, v_status, coalesce(p_version, 1), v_is_locked, p_cloned_from_id, case when v_is_locked then now() else null end)
    returning id, to_jsonb(public.event_series_rules.*) into v_event_series_rule_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('event_series_rule', v_event_series_rule_id, case when p_event_series_rule_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_event_series_rule_id;
end;
$$;

revoke execute on function public.get_organizer_settings() from public, anon;
revoke execute on function public.save_organizer_event_series_rule(uuid, uuid, uuid, uuid, text, integer, boolean, uuid) from public, anon;

grant execute on function public.get_organizer_settings() to authenticated, service_role;
grant execute on function public.save_organizer_event_series_rule(uuid, uuid, uuid, uuid, text, integer, boolean, uuid) to authenticated, service_role;
