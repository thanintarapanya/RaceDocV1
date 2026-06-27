-- RaceDocV1 Organizer Settings Ballast Rule Foundation
-- Purpose: Admin-managed ballast rules scoped to Event Rules.
-- Apply after RaceDocV1_Supabase_Organizer_Settings_Inspection_Form_Builder.sql.

create or replace function public.get_organizer_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with organization_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('organizationId', o.id, 'name', o.name, 'slug', o.slug, 'isActive', o.is_active) order by o.name), '[]'::jsonb) as organizations
    from public.organizations o
  ), circuit_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('circuitId', c.id, 'name', c.name, 'location', c.location, 'country', c.country) order by c.name), '[]'::jsonb) as circuits
    from public.circuits c
  ), series_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('seriesRaceId', sr.id, 'organizationId', sr.organization_id, 'code', sr.code, 'name', sr.name, 'ballastType', sr.ballast_type::text, 'isActive', sr.is_active) order by sr.name), '[]'::jsonb) as series_races
    from public.series_races sr
  ), grade_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('gradeId', g.id, 'code', g.code, 'name', g.name, 'sortOrder', g.sort_order) order by g.sort_order, g.name), '[]'::jsonb) as grades
    from public.grades g
  ), season_series_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('seasonSeriesId', ss.id, 'seasonId', ss.season_id, 'seriesRaceId', ss.series_race_id, 'seriesName', sr.name, 'isActive', ss.is_active) order by sr.name), '[]'::jsonb) as season_series
    from public.season_series ss
    join public.series_races sr on sr.id = ss.series_race_id
  ), season_series_grade_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('seasonSeriesGradeId', ssg.id, 'seasonSeriesId', ssg.season_series_id, 'seasonId', ss.season_id, 'seriesRaceId', ss.series_race_id, 'gradeId', ssg.grade_id, 'gradeName', g.name, 'isActive', ssg.is_active) order by g.sort_order, g.name), '[]'::jsonb) as season_series_grades
    from public.season_series_grades ssg
    join public.season_series ss on ss.id = ssg.season_series_id
    join public.grades g on g.id = ssg.grade_id
  ), event_series_rule_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('eventSeriesRuleId', esr.id, 'eventId', esr.event_id, 'eventName', e.name, 'seasonId', e.season_id, 'seriesRaceId', esr.series_race_id, 'seriesName', sr.name, 'gradeId', esr.grade_id, 'gradeName', g.name, 'status', esr.status::text, 'version', esr.version, 'isLocked', esr.is_locked, 'clonedFromId', esr.cloned_from_id, 'lockedAt', esr.locked_at) order by e.event_order, sr.name, g.sort_order, esr.version desc), '[]'::jsonb) as event_series_rules
    from public.event_series_rules esr
    join public.events e on e.id = esr.event_id
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
  ), ballast_rule_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'ballastRuleId', br.id,
      'eventSeriesRuleId', br.event_series_rule_id,
      'eventId', e.id,
      'eventName', e.name,
      'seriesRaceId', sr.id,
      'seriesName', sr.name,
      'gradeId', g.id,
      'gradeName', g.name,
      'ballastType', br.ballast_type::text,
      'maxBallastKg', br.max_ballast_kg,
      'joinWeightEnabled', br.join_weight_enabled,
      'positionMatrix', br.position_matrix,
      'removalRule', br.removal_rule
    ) order by e.event_order, sr.name, g.sort_order), '[]'::jsonb) as ballast_rules
    from public.ballast_rules br
    join public.event_series_rules esr on esr.id = br.event_series_rule_id
    join public.events e on e.id = esr.event_id
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
  ), inspection_item_rows as (
    select iti.section_id,
      jsonb_agg(jsonb_build_object(
        'itemId', iti.id,
        'sectionId', iti.section_id,
        'labelTh', iti.label_th,
        'labelEn', iti.label_en,
        'inputType', iti.input_type::text,
        'options', iti.options,
        'weightEffectType', iti.weight_effect_type::text,
        'fixedWeightKg', iti.fixed_weight_kg,
        'isRequired', iti.is_required,
        'sortOrder', iti.sort_order
      ) order by iti.sort_order, iti.label_th) as items
    from public.inspection_template_items iti
    group by iti.section_id
  ), inspection_section_rows as (
    select its.template_id,
      jsonb_agg(jsonb_build_object(
        'sectionId', its.id,
        'templateId', its.template_id,
        'code', its.code,
        'title', its.title,
        'sortOrder', its.sort_order,
        'isFixed', its.is_fixed,
        'items', coalesce(iir.items, '[]'::jsonb)
      ) order by its.sort_order, its.title) as sections
    from public.inspection_template_sections its
    left join inspection_item_rows iir on iir.section_id = its.id
    group by its.template_id
  ), inspection_template_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'templateId', ift.id,
      'eventSeriesRuleId', ift.event_series_rule_id,
      'eventId', e.id,
      'eventName', e.name,
      'seriesRaceId', sr.id,
      'seriesName', sr.name,
      'gradeId', g.id,
      'gradeName', g.name,
      'name', ift.name,
      'version', ift.version,
      'isActive', ift.is_active,
      'sections', coalesce(isr.sections, '[]'::jsonb)
    ) order by e.event_order, sr.name, g.sort_order, ift.version desc), '[]'::jsonb) as inspection_templates
    from public.inspection_form_templates ift
    join public.event_series_rules esr on esr.id = ift.event_series_rule_id
    join public.events e on e.id = esr.event_id
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
    left join inspection_section_rows isr on isr.template_id = ift.id
  ), race_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('raceId', r.id, 'eventId', r.event_id, 'name', r.name, 'raceOrder', r.race_order, 'sessionType', r.session_type, 'scheduledAt', r.scheduled_at, 'resultsImportUnlocked', r.results_import_unlocked) order by r.race_order, r.name), '[]'::jsonb) as races
    from public.races r
  ), event_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('eventId', e.id, 'seasonId', e.season_id, 'circuitId', e.circuit_id, 'circuitName', c.name, 'name', e.name, 'eventOrder', e.event_order, 'startsOn', e.starts_on, 'endsOn', e.ends_on, 'status', e.status::text) order by e.event_order, e.name), '[]'::jsonb) as events
    from public.events e
    left join public.circuits c on c.id = e.circuit_id
  ), season_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('seasonId', s.id, 'organizationId', s.organization_id, 'name', s.name, 'year', s.year, 'plannedEventCount', s.planned_event_count, 'status', s.status::text, 'isActive', s.is_active, 'activatedAt', s.activated_at) order by s.year desc, s.name), '[]'::jsonb) as seasons
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
    'ballastRules', case when public.has_role('ADMIN', null) then ballast_rule_rows.ballast_rules else '[]'::jsonb end,
    'inspectionTemplates', case when public.has_role('ADMIN', null) then inspection_template_rows.inspection_templates else '[]'::jsonb end,
    'seasons', case when public.has_role('ADMIN', null) then season_rows.seasons else '[]'::jsonb end,
    'events', case when public.has_role('ADMIN', null) then event_rows.events else '[]'::jsonb end,
    'races', case when public.has_role('ADMIN', null) then race_rows.races else '[]'::jsonb end
  )
  from organization_rows, circuit_rows, series_rows, grade_rows, season_series_rows, season_series_grade_rows, event_series_rule_rows, ballast_rule_rows, inspection_template_rows, season_rows, event_rows, race_rows;
$$;

create or replace function public.save_organizer_ballast_rule(
  p_ballast_rule_id uuid default null,
  p_event_series_rule_id uuid default null,
  p_ballast_type text default 'None',
  p_max_ballast_kg numeric default null,
  p_join_weight_enabled boolean default false,
  p_position_matrix jsonb default '{}'::jsonb,
  p_removal_rule jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_ballast_rule_id uuid;
  v_ballast_type public.ballast_type;
  v_event_rule public.event_series_rules%rowtype;
  v_position_matrix jsonb := coalesce(p_position_matrix, '{}'::jsonb);
  v_removal_rule jsonb := coalesce(p_removal_rule, '{}'::jsonb);
  v_position_entry record;
  v_nested_entry record;
  v_position_text text;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  select * into v_event_rule from public.event_series_rules where id = p_event_series_rule_id;
  if v_event_rule.id is null then
    raise exception 'Event Rule was not found.';
  end if;

  if v_event_rule.is_locked then
    raise exception 'Locked Event Rules cannot be changed.';
  end if;

  begin
    v_ballast_type := coalesce(nullif(btrim(coalesce(p_ballast_type, '')), ''), 'None')::public.ballast_type;
  exception when invalid_text_representation then
    raise exception 'Invalid ballast type.';
  end;

  if p_max_ballast_kg is not null and p_max_ballast_kg < 0 then
    raise exception 'Maximum ballast cannot be negative.';
  end if;

  if jsonb_typeof(v_position_matrix) <> 'object' then
    raise exception 'Position matrix must be a JSON object.';
  end if;

  if jsonb_typeof(v_removal_rule) <> 'object' then
    raise exception 'Removal rule must be a JSON object.';
  end if;

  for v_position_entry in select key, value from jsonb_each(v_position_matrix)
  loop
    if v_position_entry.key = 'positions' then
      if jsonb_typeof(v_position_entry.value) <> 'object' then
        raise exception 'Position matrix positions must be a JSON object.';
      end if;

      for v_nested_entry in select key, value from jsonb_each(v_position_entry.value)
      loop
        v_position_text := trim(both '"' from v_nested_entry.value::text);
        if jsonb_typeof(v_nested_entry.value) not in ('number', 'string') or v_position_text !~ '^[0-9]+(\.[0-9]+)?$' then
          raise exception 'Position ballast values must be non-negative numbers.';
        end if;
      end loop;
    else
      v_position_text := trim(both '"' from v_position_entry.value::text);
      if jsonb_typeof(v_position_entry.value) not in ('number', 'string') or v_position_text !~ '^[0-9]+(\.[0-9]+)?$' then
        raise exception 'Position ballast values must be non-negative numbers.';
      end if;
    end if;
  end loop;

  if p_ballast_rule_id is not null then
    select to_jsonb(br.*) into v_old_values
    from public.ballast_rules br
    where br.id = p_ballast_rule_id;

    if v_old_values is null then
      raise exception 'Ballast rule was not found.';
    end if;

    update public.ballast_rules
    set event_series_rule_id = p_event_series_rule_id,
        ballast_type = v_ballast_type,
        max_ballast_kg = p_max_ballast_kg,
        join_weight_enabled = coalesce(p_join_weight_enabled, false),
        position_matrix = v_position_matrix,
        removal_rule = v_removal_rule
    where id = p_ballast_rule_id
    returning id, to_jsonb(public.ballast_rules.*) into v_ballast_rule_id, v_new_values;
  else
    insert into public.ballast_rules (event_series_rule_id, ballast_type, max_ballast_kg, join_weight_enabled, position_matrix, removal_rule)
    values (p_event_series_rule_id, v_ballast_type, p_max_ballast_kg, coalesce(p_join_weight_enabled, false), v_position_matrix, v_removal_rule)
    returning id, to_jsonb(public.ballast_rules.*) into v_ballast_rule_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('ballast_rule', v_ballast_rule_id, case when p_ballast_rule_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_ballast_rule_id;
end;
$$;

revoke execute on function public.get_organizer_settings() from public, anon;
revoke execute on function public.save_organizer_ballast_rule(uuid, uuid, text, numeric, boolean, jsonb, jsonb) from public, anon;

grant execute on function public.get_organizer_settings() to authenticated, service_role;
grant execute on function public.save_organizer_ballast_rule(uuid, uuid, text, numeric, boolean, jsonb, jsonb) to authenticated, service_role;
