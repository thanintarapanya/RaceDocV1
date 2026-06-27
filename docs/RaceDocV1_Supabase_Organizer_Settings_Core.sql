-- RaceDocV1 Organizer Settings Core
-- Purpose: Admin-managed Season/Event/Race calendar foundation.

create index if not exists seasons_created_by_id_idx
  on public.seasons (created_by_id);

alter table public.seasons
  add column if not exists planned_event_count integer not null default 1;

alter table public.seasons
  drop constraint if exists seasons_planned_event_count_positive_chk;

alter table public.seasons
  add constraint seasons_planned_event_count_positive_chk check (planned_event_count > 0);

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
    'seasons', case when public.has_role('ADMIN', null) then season_rows.seasons else '[]'::jsonb end,
    'events', case when public.has_role('ADMIN', null) then event_rows.events else '[]'::jsonb end,
    'races', case when public.has_role('ADMIN', null) then race_rows.races else '[]'::jsonb end
  )
  from organization_rows, circuit_rows, season_rows, event_rows, race_rows;
$$;

create or replace function public.save_organizer_circuit(
  p_circuit_id uuid default null,
  p_name text default null,
  p_location text default null,
  p_country text default 'Thailand'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_circuit_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Circuit name is required.';
  end if;

  if p_circuit_id is not null then
    select to_jsonb(c.*) into v_old_values from public.circuits c where c.id = p_circuit_id;

    if v_old_values is null then
      raise exception 'Circuit was not found.';
    end if;

    update public.circuits
    set name = btrim(p_name),
        location = nullif(btrim(coalesce(p_location, '')), ''),
        country = coalesce(nullif(btrim(coalesce(p_country, '')), ''), 'Thailand')
    where id = p_circuit_id
    returning id, to_jsonb(public.circuits.*) into v_circuit_id, v_new_values;
  else
    insert into public.circuits (name, location, country)
    values (
      btrim(p_name),
      nullif(btrim(coalesce(p_location, '')), ''),
      coalesce(nullif(btrim(coalesce(p_country, '')), ''), 'Thailand')
    )
    returning id, to_jsonb(public.circuits.*) into v_circuit_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('circuit', v_circuit_id, case when p_circuit_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_circuit_id;
end;
$$;

create or replace function public.save_organizer_season(
  p_season_id uuid default null,
  p_organization_id uuid default null,
  p_name text default null,
  p_year integer default null,
  p_planned_event_count integer default 1,
  p_status text default 'Draft',
  p_is_active boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_organization_id uuid;
  v_season_id uuid;
  v_status public.season_status;
  v_old_values jsonb;
  v_new_values jsonb;
  v_previous_status text;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Season name is required.';
  end if;

  if coalesce(p_year, 0) < 2000 then
    raise exception 'Season year must be 2000 or later.';
  end if;

  if coalesce(p_planned_event_count, 0) <= 0 then
    raise exception 'Planned event count must be greater than zero.';
  end if;

  begin
    v_status := coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'Draft')::public.season_status;
  exception when invalid_text_representation then
    raise exception 'Invalid season status.';
  end;

  select id into v_organization_id
  from public.organizations
  where id = p_organization_id or (p_organization_id is null and is_active = true)
  order by is_active desc, name
  limit 1;

  if v_organization_id is null then
    raise exception 'Organization is required.';
  end if;

  if p_is_active or v_status = 'Active'::public.season_status then
    update public.seasons
    set is_active = false,
        status = case when status = 'Active'::public.season_status then 'Completed'::public.season_status else status end
    where organization_id = v_organization_id
      and (p_season_id is null or id <> p_season_id)
      and is_active = true;

    v_status := 'Active'::public.season_status;
  end if;

  if p_season_id is not null then
    select to_jsonb(s.*), s.status::text into v_old_values, v_previous_status from public.seasons s where s.id = p_season_id;

    if v_old_values is null then
      raise exception 'Season was not found.';
    end if;

    update public.seasons
    set organization_id = v_organization_id,
        name = btrim(p_name),
        year = p_year,
        planned_event_count = p_planned_event_count,
        status = v_status,
        is_active = (p_is_active or v_status = 'Active'::public.season_status),
        activated_at = case when (p_is_active or v_status = 'Active'::public.season_status) and activated_at is null then now() else activated_at end
    where id = p_season_id
    returning id, to_jsonb(public.seasons.*) into v_season_id, v_new_values;
  else
    insert into public.seasons (organization_id, name, year, planned_event_count, status, is_active, activated_at, created_by_id)
    values (
      v_organization_id,
      btrim(p_name),
      p_year,
      p_planned_event_count,
      v_status,
      (p_is_active or v_status = 'Active'::public.season_status),
      case when (p_is_active or v_status = 'Active'::public.season_status) then now() else null end,
      v_actor_profile_id
    )
    returning id, to_jsonb(public.seasons.*) into v_season_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, previous_status, new_status, action_by_id)
  values ('season', v_season_id, case when p_season_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_previous_status, v_status::text, v_actor_profile_id);

  return v_season_id;
end;
$$;

create or replace function public.save_organizer_event(
  p_event_id uuid default null,
  p_season_id uuid default null,
  p_circuit_id uuid default null,
  p_name text default null,
  p_event_order integer default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_status text default 'Draft'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_event_id uuid;
  v_status public.event_status;
  v_old_values jsonb;
  v_new_values jsonb;
  v_previous_status text;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if p_season_id is null then
    raise exception 'Season is required.';
  end if;

  if not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception 'Season was not found.';
  end if;

  if p_circuit_id is not null and not exists (select 1 from public.circuits where id = p_circuit_id) then
    raise exception 'Circuit was not found.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Event name is required.';
  end if;

  if coalesce(p_event_order, 0) <= 0 then
    raise exception 'Event order must be greater than zero.';
  end if;

  if p_starts_on is not null and p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'Event end date cannot be before start date.';
  end if;

  begin
    v_status := coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'Draft')::public.event_status;
  exception when invalid_text_representation then
    raise exception 'Invalid event status.';
  end;

  if p_event_id is not null then
    select to_jsonb(e.*), e.status::text into v_old_values, v_previous_status from public.events e where e.id = p_event_id;

    if v_old_values is null then
      raise exception 'Event was not found.';
    end if;

    update public.events
    set season_id = p_season_id,
        circuit_id = p_circuit_id,
        name = btrim(p_name),
        event_order = p_event_order,
        starts_on = p_starts_on,
        ends_on = p_ends_on,
        status = v_status
    where id = p_event_id
    returning id, to_jsonb(public.events.*) into v_event_id, v_new_values;
  else
    insert into public.events (season_id, circuit_id, name, event_order, starts_on, ends_on, status)
    values (p_season_id, p_circuit_id, btrim(p_name), p_event_order, p_starts_on, p_ends_on, v_status)
    returning id, to_jsonb(public.events.*) into v_event_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, previous_status, new_status, action_by_id)
  values ('event', v_event_id, case when p_event_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_previous_status, v_status::text, v_actor_profile_id);

  return v_event_id;
end;
$$;

create or replace function public.save_organizer_race(
  p_race_id uuid default null,
  p_event_id uuid default null,
  p_name text default null,
  p_race_order integer default null,
  p_session_type text default 'Race',
  p_scheduled_at timestamptz default null,
  p_results_import_unlocked boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_race_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if p_event_id is null then
    raise exception 'Event is required.';
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Event was not found.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Race name is required.';
  end if;

  if coalesce(p_race_order, 0) <= 0 then
    raise exception 'Race order must be greater than zero.';
  end if;

  if p_race_id is not null then
    select to_jsonb(r.*) into v_old_values from public.races r where r.id = p_race_id;

    if v_old_values is null then
      raise exception 'Race was not found.';
    end if;

    update public.races
    set event_id = p_event_id,
        name = btrim(p_name),
        race_order = p_race_order,
        session_type = coalesce(nullif(btrim(coalesce(p_session_type, '')), ''), 'Race'),
        scheduled_at = p_scheduled_at,
        results_import_unlocked = coalesce(p_results_import_unlocked, false)
    where id = p_race_id
    returning id, to_jsonb(public.races.*) into v_race_id, v_new_values;
  else
    insert into public.races (event_id, name, race_order, session_type, scheduled_at, results_import_unlocked)
    values (
      p_event_id,
      btrim(p_name),
      p_race_order,
      coalesce(nullif(btrim(coalesce(p_session_type, '')), ''), 'Race'),
      p_scheduled_at,
      coalesce(p_results_import_unlocked, false)
    )
    returning id, to_jsonb(public.races.*) into v_race_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('race', v_race_id, case when p_race_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_race_id;
end;
$$;

revoke execute on function public.get_organizer_settings() from public, anon;
revoke execute on function public.save_organizer_circuit(uuid, text, text, text) from public, anon;
revoke execute on function public.save_organizer_season(uuid, uuid, text, integer, text, boolean) from public, anon;
revoke execute on function public.save_organizer_season(uuid, uuid, text, integer, integer, text, boolean) from public, anon;
revoke execute on function public.save_organizer_event(uuid, uuid, uuid, text, integer, date, date, text) from public, anon;
revoke execute on function public.save_organizer_race(uuid, uuid, text, integer, text, timestamptz, boolean) from public, anon;

grant execute on function public.get_organizer_settings() to authenticated, service_role;
grant execute on function public.save_organizer_circuit(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.save_organizer_season(uuid, uuid, text, integer, integer, text, boolean) to authenticated, service_role;
grant execute on function public.save_organizer_event(uuid, uuid, uuid, text, integer, date, date, text) to authenticated, service_role;
grant execute on function public.save_organizer_race(uuid, uuid, text, integer, text, timestamptz, boolean) to authenticated, service_role;
