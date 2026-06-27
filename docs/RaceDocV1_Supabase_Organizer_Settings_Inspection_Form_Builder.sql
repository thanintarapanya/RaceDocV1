-- RaceDocV1 Organizer Settings Inspection Form Builder Foundation
-- Purpose: Admin-managed inspection template versions, sections, and items scoped to Event Rules.
-- Apply after RaceDocV1_Supabase_Organizer_Settings_Event_Rules.sql.

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
    'inspectionTemplates', case when public.has_role('ADMIN', null) then inspection_template_rows.inspection_templates else '[]'::jsonb end,
    'seasons', case when public.has_role('ADMIN', null) then season_rows.seasons else '[]'::jsonb end,
    'events', case when public.has_role('ADMIN', null) then event_rows.events else '[]'::jsonb end,
    'races', case when public.has_role('ADMIN', null) then race_rows.races else '[]'::jsonb end
  )
  from organization_rows, circuit_rows, series_rows, grade_rows, season_series_rows, season_series_grade_rows, event_series_rule_rows, inspection_template_rows, season_rows, event_rows, race_rows;
$$;

create or replace function public.save_organizer_inspection_template_version(
  p_template_id uuid default null,
  p_event_series_rule_id uuid default null,
  p_name text default null,
  p_version integer default null,
  p_is_active boolean default false,
  p_clone_from_template_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_template_id uuid;
  v_source_section record;
  v_new_section_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if p_event_series_rule_id is null then
    raise exception 'Event Rule is required.';
  end if;

  if not exists (select 1 from public.event_series_rules where id = p_event_series_rule_id) then
    raise exception 'Event Rule was not found.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Template name is required.';
  end if;

  if coalesce(p_version, 1) <= 0 then
    raise exception 'Template version must be greater than zero.';
  end if;

  if p_clone_from_template_id is not null and not exists (select 1 from public.inspection_form_templates where id = p_clone_from_template_id) then
    raise exception 'Clone source template was not found.';
  end if;

  if coalesce(p_is_active, false) then
    update public.inspection_form_templates
    set is_active = false
    where event_series_rule_id = p_event_series_rule_id
      and (p_template_id is null or id <> p_template_id);
  end if;

  if p_template_id is not null then
    select to_jsonb(ift.*) into v_old_values
    from public.inspection_form_templates ift
    where ift.id = p_template_id;

    if v_old_values is null then
      raise exception 'Inspection template was not found.';
    end if;

    update public.inspection_form_templates
    set event_series_rule_id = p_event_series_rule_id,
        name = btrim(p_name),
        version = coalesce(p_version, 1),
        is_active = coalesce(p_is_active, false)
    where id = p_template_id
    returning id, to_jsonb(public.inspection_form_templates.*) into v_template_id, v_new_values;
  else
    insert into public.inspection_form_templates (event_series_rule_id, name, version, is_active)
    values (p_event_series_rule_id, btrim(p_name), coalesce(p_version, 1), coalesce(p_is_active, false))
    returning id, to_jsonb(public.inspection_form_templates.*) into v_template_id, v_new_values;

    if p_clone_from_template_id is not null then
      for v_source_section in
        select * from public.inspection_template_sections where template_id = p_clone_from_template_id order by sort_order
      loop
        insert into public.inspection_template_sections (template_id, code, title, sort_order, is_fixed)
        values (v_template_id, v_source_section.code, v_source_section.title, v_source_section.sort_order, v_source_section.is_fixed)
        returning id into v_new_section_id;

        insert into public.inspection_template_items (section_id, label_th, label_en, input_type, options, weight_effect_type, fixed_weight_kg, is_required, sort_order)
        select v_new_section_id, label_th, label_en, input_type, options, weight_effect_type, fixed_weight_kg, is_required, sort_order
        from public.inspection_template_items
        where section_id = v_source_section.id
        order by sort_order;
      end loop;
    end if;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('inspection_form_template', v_template_id, case when p_template_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_template_id;
end;
$$;

create or replace function public.save_organizer_inspection_template_section(
  p_section_id uuid default null,
  p_template_id uuid default null,
  p_code text default null,
  p_title text default null,
  p_sort_order integer default 0,
  p_is_fixed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_section_id uuid;
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

  if not exists (select 1 from public.inspection_form_templates where id = p_template_id) then
    raise exception 'Inspection template was not found.';
  end if;

  v_code := lower(regexp_replace(nullif(btrim(coalesce(p_code, '')), ''), '[^a-zA-Z0-9]+', '_', 'g'));

  if v_code is null then
    raise exception 'Section code is required.';
  end if;

  if nullif(btrim(coalesce(p_title, '')), '') is null then
    raise exception 'Section title is required.';
  end if;

  if p_section_id is not null then
    select to_jsonb(its.*) into v_old_values from public.inspection_template_sections its where its.id = p_section_id;

    if v_old_values is null then
      raise exception 'Inspection section was not found.';
    end if;

    update public.inspection_template_sections
    set template_id = p_template_id,
        code = v_code,
        title = btrim(p_title),
        sort_order = coalesce(p_sort_order, 0),
        is_fixed = coalesce(p_is_fixed, false)
    where id = p_section_id
    returning id, to_jsonb(public.inspection_template_sections.*) into v_section_id, v_new_values;
  else
    insert into public.inspection_template_sections (template_id, code, title, sort_order, is_fixed)
    values (p_template_id, v_code, btrim(p_title), coalesce(p_sort_order, 0), coalesce(p_is_fixed, false))
    returning id, to_jsonb(public.inspection_template_sections.*) into v_section_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('inspection_template_section', v_section_id, case when p_section_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_section_id;
end;
$$;

create or replace function public.save_organizer_inspection_template_item(
  p_item_id uuid default null,
  p_section_id uuid default null,
  p_label_th text default null,
  p_label_en text default null,
  p_input_type text default 'Checkbox',
  p_options jsonb default '[]'::jsonb,
  p_weight_effect_type text default 'None',
  p_fixed_weight_kg numeric default null,
  p_is_required boolean default false,
  p_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_item_id uuid;
  v_input_type public.inspection_input_type;
  v_weight_effect_type public.weight_effect_type;
  v_fixed_weight_kg numeric;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  if not exists (select 1 from public.inspection_template_sections where id = p_section_id) then
    raise exception 'Inspection section was not found.';
  end if;

  if nullif(btrim(coalesce(p_label_th, '')), '') is null then
    raise exception 'Thai label is required.';
  end if;

  if jsonb_typeof(coalesce(p_options, '[]'::jsonb)) <> 'array' then
    raise exception 'Options must be a JSON array.';
  end if;

  begin
    v_input_type := coalesce(nullif(btrim(coalesce(p_input_type, '')), ''), 'Checkbox')::public.inspection_input_type;
  exception when invalid_text_representation then
    raise exception 'Invalid input type.';
  end;

  begin
    v_weight_effect_type := coalesce(nullif(btrim(coalesce(p_weight_effect_type, '')), ''), 'None')::public.weight_effect_type;
  exception when invalid_text_representation then
    raise exception 'Invalid weight effect type.';
  end;

  v_fixed_weight_kg := case when v_weight_effect_type = 'Fix'::public.weight_effect_type then p_fixed_weight_kg else null end;

  if v_weight_effect_type = 'Fix'::public.weight_effect_type and v_fixed_weight_kg is null then
    raise exception 'Fixed weight is required when weight effect is Fix.';
  end if;

  if v_fixed_weight_kg is not null and v_fixed_weight_kg < 0 then
    raise exception 'Fixed weight cannot be negative.';
  end if;

  if p_item_id is not null then
    select to_jsonb(iti.*) into v_old_values from public.inspection_template_items iti where iti.id = p_item_id;

    if v_old_values is null then
      raise exception 'Inspection item was not found.';
    end if;

    update public.inspection_template_items
    set section_id = p_section_id,
        label_th = btrim(p_label_th),
        label_en = nullif(btrim(coalesce(p_label_en, '')), ''),
        input_type = v_input_type,
        options = coalesce(p_options, '[]'::jsonb),
        weight_effect_type = v_weight_effect_type,
        fixed_weight_kg = v_fixed_weight_kg,
        is_required = coalesce(p_is_required, false),
        sort_order = coalesce(p_sort_order, 0)
    where id = p_item_id
    returning id, to_jsonb(public.inspection_template_items.*) into v_item_id, v_new_values;
  else
    insert into public.inspection_template_items (section_id, label_th, label_en, input_type, options, weight_effect_type, fixed_weight_kg, is_required, sort_order)
    values (p_section_id, btrim(p_label_th), nullif(btrim(coalesce(p_label_en, '')), ''), v_input_type, coalesce(p_options, '[]'::jsonb), v_weight_effect_type, v_fixed_weight_kg, coalesce(p_is_required, false), coalesce(p_sort_order, 0))
    returning id, to_jsonb(public.inspection_template_items.*) into v_item_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('inspection_template_item', v_item_id, case when p_item_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_item_id;
end;
$$;

revoke execute on function public.get_organizer_settings() from public, anon;
revoke execute on function public.save_organizer_inspection_template_version(uuid, uuid, text, integer, boolean, uuid) from public, anon;
revoke execute on function public.save_organizer_inspection_template_section(uuid, uuid, text, text, integer, boolean) from public, anon;
revoke execute on function public.save_organizer_inspection_template_item(uuid, uuid, text, text, text, jsonb, text, numeric, boolean, integer) from public, anon;

grant execute on function public.get_organizer_settings() to authenticated, service_role;
grant execute on function public.save_organizer_inspection_template_version(uuid, uuid, text, integer, boolean, uuid) to authenticated, service_role;
grant execute on function public.save_organizer_inspection_template_section(uuid, uuid, text, text, integer, boolean) to authenticated, service_role;
grant execute on function public.save_organizer_inspection_template_item(uuid, uuid, text, text, text, jsonb, text, numeric, boolean, integer) to authenticated, service_role;
