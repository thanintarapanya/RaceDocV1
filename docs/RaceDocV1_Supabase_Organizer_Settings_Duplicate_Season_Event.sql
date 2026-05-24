-- RaceDocV1 Organizer Settings Duplicate Season/Event
-- Purpose: Admin-only RPCs to duplicate an Event or full Season with nested organizer configuration.
-- Apply after RaceDocV1_Supabase_Organizer_Settings_Weight_Rules.sql.
-- Note: Asset configuration rows are duplicated, but file_asset rows/storage objects are referenced,
-- because copying physical Storage objects is not safely possible inside a Postgres RPC.

create or replace function public.duplicate_organizer_event(
  p_source_event_id uuid,
  p_target_season_id uuid default null,
  p_name text default null,
  p_event_order integer default null,
  p_starts_on date default null,
  p_ends_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_source_event public.events%rowtype;
  v_target_season_id uuid;
  v_new_event_id uuid;
  v_new_name text;
  v_new_event_order integer;
  v_new_starts_on date;
  v_new_ends_on date;
  v_source_rule record;
  v_source_template record;
  v_source_section record;
  v_new_rule_id uuid;
  v_new_template_id uuid;
  v_new_section_id uuid;
  v_target_season_series_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can duplicate organizer settings.';
  end if;

  select * into v_source_event
  from public.events
  where id = p_source_event_id;

  if v_source_event.id is null then
    raise exception 'Source Event was not found.';
  end if;

  v_target_season_id := coalesce(p_target_season_id, v_source_event.season_id);

  if not exists (select 1 from public.seasons where id = v_target_season_id) then
    raise exception 'Target Season was not found.';
  end if;

  v_new_name := coalesce(nullif(btrim(coalesce(p_name, '')), ''), v_source_event.name || ' Copy');
  v_new_event_order := coalesce(
    p_event_order,
    (select coalesce(max(event_order), 0) + 1 from public.events where season_id = v_target_season_id)
  );
  v_new_starts_on := coalesce(p_starts_on, v_source_event.starts_on);
  v_new_ends_on := coalesce(p_ends_on, v_source_event.ends_on);

  if v_new_event_order <= 0 then
    raise exception 'Event order must be greater than zero.';
  end if;

  if v_new_starts_on is not null and v_new_ends_on is not null and v_new_ends_on < v_new_starts_on then
    raise exception 'Event end date cannot be before start date.';
  end if;

  if exists (
    select 1
    from public.events
    where season_id = v_target_season_id
      and event_order = v_new_event_order
  ) then
    raise exception 'Target Season already has an Event with this order.';
  end if;

  insert into public.events (season_id, circuit_id, name, event_order, starts_on, ends_on, status)
  values (
    v_target_season_id,
    v_source_event.circuit_id,
    v_new_name,
    v_new_event_order,
    v_new_starts_on,
    v_new_ends_on,
    'Draft'::public.event_status
  )
  returning id into v_new_event_id;

  insert into public.races (event_id, name, race_order, session_type, scheduled_at, results_import_unlocked)
  select v_new_event_id, name, race_order, session_type, scheduled_at, results_import_unlocked
  from public.races
  where event_id = v_source_event.id
  order by race_order, name;

  insert into public.print_background_assets (event_id, file_asset_id, title, orientation, is_default)
  select v_new_event_id, file_asset_id, title, orientation, is_default
  from public.print_background_assets
  where event_id = v_source_event.id
  order by orientation, is_default desc, title;

  -- Ensure the target Season has the Series/Grade links needed by copied Event Rules.
  for v_source_rule in
    select distinct series_race_id, grade_id
    from public.event_series_rules
    where event_id = v_source_event.id
  loop
    insert into public.season_series (season_id, series_race_id, is_active)
    values (v_target_season_id, v_source_rule.series_race_id, true)
    on conflict (season_id, series_race_id) do update set is_active = true
    returning id into v_target_season_series_id;

    insert into public.season_series_grades (season_series_id, grade_id, is_active)
    values (v_target_season_series_id, v_source_rule.grade_id, true)
    on conflict (season_series_id, grade_id) do update set is_active = true;
  end loop;

  for v_source_rule in
    select *
    from public.event_series_rules
    where event_id = v_source_event.id
    order by series_race_id, grade_id, version
  loop
    insert into public.event_series_rules (
      event_id,
      series_race_id,
      grade_id,
      status,
      version,
      is_locked,
      cloned_from_id,
      locked_at
    ) values (
      v_new_event_id,
      v_source_rule.series_race_id,
      v_source_rule.grade_id,
      'Draft'::public.rule_status,
      v_source_rule.version,
      false,
      v_source_rule.id,
      null
    )
    returning id into v_new_rule_id;

    insert into public.weight_rules (
      event_series_rule_id,
      name,
      engine_min_cc,
      engine_max_cc,
      base_weight_kg,
      additional_weight_rules,
      is_active,
      sort_order
    )
    select v_new_rule_id, name, engine_min_cc, engine_max_cc, base_weight_kg, additional_weight_rules, is_active, sort_order
    from public.weight_rules
    where event_series_rule_id = v_source_rule.id
    order by sort_order, name;

    insert into public.ballast_rules (
      event_series_rule_id,
      ballast_type,
      max_ballast_kg,
      join_weight_enabled,
      position_matrix,
      removal_rule
    )
    select v_new_rule_id, ballast_type, max_ballast_kg, join_weight_enabled, position_matrix, removal_rule
    from public.ballast_rules
    where event_series_rule_id = v_source_rule.id;

    insert into public.tire_rules (event_series_rule_id, tire_brand, tire_model, is_allowed)
    select v_new_rule_id, tire_brand, tire_model, is_allowed
    from public.tire_rules
    where event_series_rule_id = v_source_rule.id
    order by tire_brand, tire_model nulls first;

    insert into public.sponsor_sticker_assets (event_series_rule_id, file_asset_id, title)
    select v_new_rule_id, file_asset_id, title
    from public.sponsor_sticker_assets
    where event_series_rule_id = v_source_rule.id
    order by title;

    for v_source_template in
      select *
      from public.inspection_form_templates
      where event_series_rule_id = v_source_rule.id
      order by version, name
    loop
      insert into public.inspection_form_templates (event_series_rule_id, name, version, is_active)
      values (v_new_rule_id, v_source_template.name, v_source_template.version, v_source_template.is_active)
      returning id into v_new_template_id;

      for v_source_section in
        select *
        from public.inspection_template_sections
        where template_id = v_source_template.id
        order by sort_order, title
      loop
        insert into public.inspection_template_sections (template_id, code, title, sort_order, is_fixed)
        values (v_new_template_id, v_source_section.code, v_source_section.title, v_source_section.sort_order, v_source_section.is_fixed)
        returning id into v_new_section_id;

        insert into public.inspection_template_items (
          section_id,
          label_th,
          label_en,
          input_type,
          options,
          weight_effect_type,
          fixed_weight_kg,
          is_required,
          sort_order
        )
        select
          v_new_section_id,
          label_th,
          label_en,
          input_type,
          options,
          weight_effect_type,
          fixed_weight_kg,
          is_required,
          sort_order
        from public.inspection_template_items
        where section_id = v_source_section.id
        order by sort_order, label_th;
      end loop;
    end loop;
  end loop;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values (
    'event',
    v_new_event_id,
    'duplicate',
    to_jsonb(v_source_event),
    jsonb_build_object('eventId', v_new_event_id, 'duplicatedFromEventId', v_source_event.id, 'targetSeasonId', v_target_season_id),
    v_actor_profile_id
  );

  return v_new_event_id;
end;
$$;

create or replace function public.duplicate_organizer_season(
  p_source_season_id uuid,
  p_name text default null,
  p_year integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_source_season public.seasons%rowtype;
  v_new_season_id uuid;
  v_new_name text;
  v_new_year integer;
  v_source_season_series record;
  v_new_season_series_id uuid;
  v_source_event record;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can duplicate organizer settings.';
  end if;

  select * into v_source_season
  from public.seasons
  where id = p_source_season_id;

  if v_source_season.id is null then
    raise exception 'Source Season was not found.';
  end if;

  v_new_name := coalesce(nullif(btrim(coalesce(p_name, '')), ''), v_source_season.name || ' Copy');
  v_new_year := coalesce(p_year, v_source_season.year + 1);

  if v_new_year < 2000 then
    raise exception 'Season year must be 2000 or later.';
  end if;

  if p_year is null then
    while exists (
      select 1
      from public.seasons
      where organization_id = v_source_season.organization_id
        and year = v_new_year
    ) loop
      v_new_year := v_new_year + 1;
    end loop;
  elsif exists (
    select 1
    from public.seasons
    where organization_id = v_source_season.organization_id
      and year = v_new_year
  ) then
    raise exception 'This organization already has a Season for the target year.';
  end if;

  insert into public.seasons (organization_id, name, year, status, is_active, activated_at, created_by_id)
  values (
    v_source_season.organization_id,
    v_new_name,
    v_new_year,
    'Draft'::public.season_status,
    false,
    null,
    v_actor_profile_id
  )
  returning id into v_new_season_id;

  for v_source_season_series in
    select *
    from public.season_series
    where season_id = v_source_season.id
    order by series_race_id
  loop
    insert into public.season_series (season_id, series_race_id, is_active)
    values (v_new_season_id, v_source_season_series.series_race_id, v_source_season_series.is_active)
    returning id into v_new_season_series_id;

    insert into public.season_series_grades (season_series_id, grade_id, is_active)
    select v_new_season_series_id, grade_id, is_active
    from public.season_series_grades
    where season_series_id = v_source_season_series.id
    order by grade_id;
  end loop;

  for v_source_event in
    select *
    from public.events
    where season_id = v_source_season.id
    order by event_order, name
  loop
    perform public.duplicate_organizer_event(
      v_source_event.id,
      v_new_season_id,
      v_source_event.name,
      v_source_event.event_order,
      v_source_event.starts_on,
      v_source_event.ends_on
    );
  end loop;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values (
    'season',
    v_new_season_id,
    'duplicate',
    to_jsonb(v_source_season),
    jsonb_build_object('seasonId', v_new_season_id, 'duplicatedFromSeasonId', v_source_season.id, 'year', v_new_year),
    v_actor_profile_id
  );

  return v_new_season_id;
end;
$$;

revoke execute on function public.duplicate_organizer_event(uuid, uuid, text, integer, date, date) from public, anon;
revoke execute on function public.duplicate_organizer_season(uuid, text, integer) from public, anon;

grant execute on function public.duplicate_organizer_event(uuid, uuid, text, integer, date, date) to authenticated, service_role;
grant execute on function public.duplicate_organizer_season(uuid, text, integer) to authenticated, service_role;
