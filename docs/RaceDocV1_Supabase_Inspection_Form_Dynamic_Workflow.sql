-- RaceDocV1 Dynamic Inspection Form Workflow
-- Purpose: make Inspection Form a dynamic pre-inspection form filled by
-- competitors/team managers, then reviewed item-by-item by scrutineers.

create or replace function public.calculate_inspection_item_applied_weight(
  p_item_id uuid,
  p_answer jsonb
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_item record;
  v_weight numeric := 0;
  v_answer_text text;
  v_selected_values text[] := array[]::text[];
  v_element jsonb;
  v_option jsonb;
  v_option_value text;
  v_option_weight_text text;
begin
  select
    iti.input_type::text as input_type,
    iti.options,
    iti.weight_effect_type::text as weight_effect_type,
    iti.fixed_weight_kg
  into v_item
  from public.inspection_template_items iti
  where iti.id = p_item_id;

  if v_item is null or p_answer is null or p_answer = 'null'::jsonb then
    return 0;
  end if;

  v_answer_text := nullif(btrim(coalesce(p_answer #>> '{}', '')), '');

  if v_item.weight_effect_type = 'Fix' and v_item.fixed_weight_kg is not null then
    if (jsonb_typeof(p_answer) = 'boolean' and p_answer::text = 'true')
      or (jsonb_typeof(p_answer) = 'array' and jsonb_array_length(p_answer) > 0)
      or (jsonb_typeof(p_answer) in ('string', 'number', 'object') and coalesce(lower(v_answer_text), '') not in ('', 'false', '0', 'no')) then
      v_weight := v_weight + v_item.fixed_weight_kg;
    end if;
  end if;

  if v_item.weight_effect_type = 'Vary' and v_answer_text ~ '^[0-9]+(\.[0-9]+)?$' then
    v_weight := v_weight + v_answer_text::numeric;
  end if;

  if jsonb_typeof(p_answer) = 'array' then
    for v_element in select value from jsonb_array_elements(p_answer)
    loop
      v_selected_values := array_append(v_selected_values, coalesce(v_element ->> 'value', v_element ->> 'label', v_element #>> '{}'));
    end loop;
  elsif jsonb_typeof(p_answer) = 'object' then
    v_selected_values := array_append(v_selected_values, coalesce(p_answer ->> 'value', p_answer ->> 'label'));
  else
    v_selected_values := array_append(v_selected_values, v_answer_text);
  end if;

  if jsonb_typeof(v_item.options) = 'array' then
    for v_option in select value from jsonb_array_elements(v_item.options)
    loop
      v_option_value := coalesce(v_option ->> 'value', v_option ->> 'label');
      v_option_weight_text := v_option ->> 'weightKg';

      if v_option_value is not null
        and v_option_weight_text ~ '^[0-9]+(\.[0-9]+)?$'
        and v_option_value = any(v_selected_values) then
        v_weight := v_weight + v_option_weight_text::numeric;
      end if;
    end loop;
  end if;

  return greatest(v_weight, 0);
end;
$$;

create or replace function public.create_inspection_form_for_entry(p_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_entry public.entry_forms%rowtype;
  v_template_id uuid;
  v_inspection_form_id uuid;
  v_version_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = p_entry_id
    and deleted_at is null
  for update;

  if v_entry.id is null then
    raise exception 'Entry Form was not found.';
  end if;

  if v_entry.status <> 'Active'::public.entry_form_status then
    raise exception 'Only Active Entry Forms can create Inspection Forms.';
  end if;

  if not (
    public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null)
    or public.can_manage_competitor(v_entry.competitor_profile_id, v_entry.season_id)
  ) then
    raise exception 'You do not have access to create this Inspection Form.';
  end if;

  select id into v_inspection_form_id
  from public.inspection_forms
  where entry_form_id = p_entry_id;

  if v_inspection_form_id is not null then
    return v_inspection_form_id;
  end if;

  select id into v_template_id
  from public.inspection_form_templates
  where event_series_rule_id = v_entry.event_series_rule_id
    and is_active = true
  order by version desc
  limit 1;

  if v_template_id is null then
    raise exception 'Inspection template is not configured for this Entry Form.';
  end if;

  insert into public.inspection_forms (
    entry_form_id,
    template_id,
    status,
    current_version_no,
    is_locked,
    created_by_id,
    updated_by_id,
    submitted_at
  ) values (
    p_entry_id,
    v_template_id,
    'Draft'::public.inspection_form_status,
    1,
    false,
    v_actor_profile_id,
    v_actor_profile_id,
    null
  ) returning id into v_inspection_form_id;

  insert into public.inspection_form_versions (
    inspection_form_id,
    version_no,
    answers_snapshot,
    status,
    inspected_by_id
  ) values (
    v_inspection_form_id,
    1,
    jsonb_build_object(
      'source', 'competitor_draft_initialized',
      'answers', '{}'::jsonb,
      'personalSnapshot', v_entry.personal_snapshot,
      'vehicleSnapshot', v_entry.vehicle_snapshot,
      'teamSnapshot', v_entry.team_snapshot
    ),
    'Draft'::public.inspection_form_status,
    null
  ) returning id into v_version_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
  values (
    'inspection_form',
    v_inspection_form_id,
    'create_draft',
    jsonb_build_object('entry_form_id', p_entry_id, 'version_id', v_version_id),
    'Draft',
    v_actor_profile_id
  );

  return v_inspection_form_id;
end;
$$;

create or replace function public.save_inspection_form_draft(
  p_entry_id uuid,
  p_answers jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_entry public.entry_forms%rowtype;
  v_form public.inspection_forms%rowtype;
  v_form_id uuid;
  v_version_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'Inspection answers must be a JSON object.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = p_entry_id
    and deleted_at is null;

  if v_entry.id is null then
    raise exception 'Entry Form was not found.';
  end if;

  if not (
    public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null)
    or public.can_manage_competitor(v_entry.competitor_profile_id, v_entry.season_id)
  ) then
    raise exception 'You do not have access to save this Inspection Form.';
  end if;

  v_form_id := public.create_inspection_form_for_entry(p_entry_id);

  select * into v_form
  from public.inspection_forms
  where id = v_form_id
  for update;

  if v_form.status <> 'Draft'::public.inspection_form_status then
    raise exception 'Inspection Form can only be edited before it is submitted for inspection.';
  end if;

  select ifv.id into v_version_id
  from public.inspection_form_versions ifv
  where ifv.inspection_form_id = v_form_id
    and ifv.version_no = v_form.current_version_no
  order by ifv.created_at desc
  limit 1;

  if v_version_id is null then
    insert into public.inspection_form_versions (
      inspection_form_id,
      version_no,
      answers_snapshot,
      status,
      inspected_by_id
    ) values (
      v_form_id,
      greatest(v_form.current_version_no, 1),
      jsonb_build_object('source', 'competitor_draft_saved', 'answers', coalesce(p_answers, '{}'::jsonb)),
      'Draft'::public.inspection_form_status,
      null
    ) returning id into v_version_id;
  else
    update public.inspection_form_versions
    set answers_snapshot = answers_snapshot
      || jsonb_build_object(
        'source', 'competitor_draft_saved',
        'answers', coalesce(p_answers, '{}'::jsonb),
        'savedAt', now()
      ),
      status = 'Draft'::public.inspection_form_status
    where id = v_version_id;
  end if;

  update public.inspection_forms
  set status = 'Draft'::public.inspection_form_status,
      is_locked = false,
      updated_by_id = v_actor_profile_id
  where id = v_form_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
  values ('inspection_form', v_form_id, 'save_draft', jsonb_build_object('version_id', v_version_id), 'Draft', v_actor_profile_id);

  return v_form_id;
end;
$$;

create or replace function public.submit_inspection_form_for_inspection(
  p_inspection_form_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_form public.inspection_forms%rowtype;
  v_entry public.entry_forms%rowtype;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_form
  from public.inspection_forms
  where id = p_inspection_form_id
  for update;

  if v_form.id is null then
    raise exception 'Inspection Form was not found.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = v_form.entry_form_id;

  if not (
    public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null)
    or public.can_manage_competitor(v_entry.competitor_profile_id, v_entry.season_id)
  ) then
    raise exception 'You do not have access to submit this Inspection Form.';
  end if;

  if v_form.status <> 'Draft'::public.inspection_form_status then
    if v_form.status = 'Pending'::public.inspection_form_status then
      return p_inspection_form_id;
    end if;

    raise exception 'Only Draft Inspection Forms can be submitted for inspection.';
  end if;

  update public.inspection_forms
  set status = 'Pending'::public.inspection_form_status,
      is_locked = true,
      submitted_at = coalesce(submitted_at, now()),
      updated_by_id = v_actor_profile_id
  where id = p_inspection_form_id;

  update public.inspection_form_versions
  set status = 'Pending'::public.inspection_form_status,
      answers_snapshot = answers_snapshot || jsonb_build_object('submittedAt', now())
  where inspection_form_id = p_inspection_form_id
    and version_no = v_form.current_version_no;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, action_by_id)
  values ('inspection_form', p_inspection_form_id, 'submit_for_inspection', v_form.status::text, 'Pending', v_actor_profile_id);

  return p_inspection_form_id;
end;
$$;

create or replace function public.get_inspection_form_detail(
  p_inspection_form_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.current_profile_id() as profile_id,
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) as can_operate,
      public.has_role('OFFSITE_SCRUTINEER', null) as can_offsite
  ), form_context as (
    select
      inf.id as inspection_form_id,
      inf.entry_form_id,
      inf.template_id,
      inf.status::text as status,
      inf.official_bop_weight_kg,
      inf.current_version_no,
      inf.submitted_at,
      inf.is_locked,
      ef.season_id,
      ef.event_id,
      ef.competitor_profile_id,
      ef.team_id,
      ef.car_number,
      ef.personal_snapshot,
      ef.driver_license_snapshot,
      ef.vehicle_snapshot,
      ef.team_snapshot,
      ef.is_eligible_to_race,
      ev.name as event_name,
      s.year as season_year,
      sr.name || ' - ' || g.name as series_class,
      coalesce(nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''), nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''), au.email, 'Competitor') as competitor_name,
      coalesce(au.email, '') as competitor_email,
      ift.name as template_name,
      ift.version as template_version
    from public.inspection_forms inf
    join public.entry_forms ef on ef.id = inf.entry_form_id
    join public.events ev on ev.id = ef.event_id
    join public.seasons s on s.id = ef.season_id
    join public.series_races sr on sr.id = ef.series_race_id
    join public.grades g on g.id = ef.grade_id
    join public.profiles p on p.id = ef.competitor_profile_id
    left join auth.users au on au.id = p.auth_user_id
    join public.inspection_form_templates ift on ift.id = inf.template_id
    cross join ctx
    where inf.id = p_inspection_form_id
      and (ctx.can_operate or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id) or public.can_access_entry_form(ef.id))
  ), latest_version as (
    select ifv.*
    from public.inspection_form_versions ifv
    join form_context fc on fc.inspection_form_id = ifv.inspection_form_id
    order by case when ifv.version_no = fc.current_version_no then 0 else 1 end, ifv.version_no desc
    limit 1
  ), item_result_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'itemId', iir.template_item_id,
      'resultStatus', iir.result_status::text,
      'answerValue', iir.answer_value,
      'appliedWeightKg', iir.applied_weight_kg,
      'comment', iir.comment
    ) order by its.sort_order, iti.sort_order), '[]'::jsonb) as item_results
    from latest_version lv
    join public.inspection_item_results iir on iir.inspection_version_id = lv.id
    left join public.inspection_template_items iti on iti.id = iir.template_item_id
    left join public.inspection_template_sections its on its.id = iti.section_id
  ), item_rows as (
    select
      iti.section_id,
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
  ), section_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'sectionId', its.id,
      'templateId', its.template_id,
      'code', its.code,
      'title', its.title,
      'sortOrder', its.sort_order,
      'isFixed', its.is_fixed,
      'items', coalesce(ir.items, '[]'::jsonb)
    ) order by its.sort_order, its.title), '[]'::jsonb) as sections
    from form_context fc
    join public.inspection_template_sections its on its.template_id = fc.template_id
    left join item_rows ir on ir.section_id = its.id
  )
  select jsonb_build_object(
    'permissions', jsonb_build_object(
      'canEditDraft', (fc.status = 'Draft' and (ctx.can_operate or public.can_manage_competitor(fc.competitor_profile_id, fc.season_id))),
      'canSubmitDraft', (fc.status = 'Draft' and (ctx.can_operate or public.can_manage_competitor(fc.competitor_profile_id, fc.season_id))),
      'canOfficialReview', ctx.can_operate,
      'canOffsiteInspect', ctx.can_offsite
    ),
    'context', jsonb_build_object(
      'inspectionFormId', fc.inspection_form_id,
      'entryId', fc.entry_form_id,
      'templateId', fc.template_id,
      'templateName', fc.template_name,
      'templateVersion', fc.template_version,
      'status', fc.status,
      'officialBopWeightKg', fc.official_bop_weight_kg,
      'currentVersionNo', fc.current_version_no,
      'submittedAt', fc.submitted_at,
      'isLocked', fc.is_locked,
      'eventName', fc.event_name,
      'seasonYear', fc.season_year,
      'seriesClass', fc.series_class,
      'carNumber', fc.car_number,
      'competitorName', fc.competitor_name,
      'competitorEmail', fc.competitor_email,
      'isEligibleToRace', fc.is_eligible_to_race,
      'personalSnapshot', fc.personal_snapshot,
      'driverLicenseSnapshot', fc.driver_license_snapshot,
      'vehicleSnapshot', fc.vehicle_snapshot,
      'teamSnapshot', fc.team_snapshot
    ),
    'template', jsonb_build_object('sections', coalesce(sr.sections, '[]'::jsonb)),
    'answers', coalesce(lv.answers_snapshot -> 'answers', '{}'::jsonb),
    'answersSnapshot', coalesce(lv.answers_snapshot, '{}'::jsonb),
    'itemResults', coalesce(irr.item_results, '[]'::jsonb)
  )
  from form_context fc
  cross join ctx
  left join latest_version lv on true
  left join section_rows sr on true
  left join item_result_rows irr on true;
$$;

create or replace function public.save_inspection_official_review(
  p_inspection_form_id uuid,
  p_answers jsonb default '{}'::jsonb,
  p_item_results jsonb default '[]'::jsonb,
  p_issue_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_form public.inspection_forms%rowtype;
  v_next_version_no integer;
  v_version_id uuid;
  v_template_item_count integer;
  v_reviewed_item_count integer;
  v_has_failed boolean;
  v_has_hold boolean;
  v_has_open boolean;
  v_has_comment boolean;
  v_next_status public.inspection_form_status;
  v_bop_total numeric := 0;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) then
    raise exception 'Only scrutineering officials can review Inspection Forms.';
  end if;

  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'Inspection answers must be a JSON object.';
  end if;

  if jsonb_typeof(coalesce(p_item_results, '[]'::jsonb)) <> 'array' then
    raise exception 'Inspection item results must be a JSON array.';
  end if;

  select * into v_form
  from public.inspection_forms
  where id = p_inspection_form_id
  for update;

  if v_form.id is null then
    raise exception 'Inspection Form was not found.';
  end if;

  if v_form.status = 'Draft'::public.inspection_form_status then
    raise exception 'Draft Inspection Forms must be submitted before official review.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_item_results, '[]'::jsonb)) result_row(value)
    where not coalesce(result_row.value ->> 'itemId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists (
        select 1
        from public.inspection_template_items iti
        join public.inspection_template_sections its on its.id = iti.section_id
        where iti.id = (result_row.value ->> 'itemId')::uuid
          and its.template_id = v_form.template_id
      )
  ) then
    raise exception 'Every item result must reference an item from this Inspection template.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_item_results, '[]'::jsonb)) result_row(value)
    where coalesce(result_row.value ->> 'resultStatus', '') not in ('Unchecked', 'Passed', 'Failed', 'Hold', 'NotApplicable')
  ) then
    raise exception 'Invalid Inspection item result status.';
  end if;

  select count(*) into v_template_item_count
  from public.inspection_template_items iti
  join public.inspection_template_sections its on its.id = iti.section_id
  where its.template_id = v_form.template_id;

  with normalized_results as (
    select distinct on ((result_row.value ->> 'itemId')::uuid)
      (result_row.value ->> 'itemId')::uuid as item_id,
      coalesce(result_row.value ->> 'resultStatus', 'Unchecked') as result_status,
      nullif(btrim(coalesce(result_row.value ->> 'comment', '')), '') as comment
    from jsonb_array_elements(coalesce(p_item_results, '[]'::jsonb)) result_row(value)
    order by (result_row.value ->> 'itemId')::uuid
  )
  select
    count(*)::integer,
    coalesce(bool_or(result_status = 'Failed'), false),
    coalesce(bool_or(result_status = 'Hold'), false),
    coalesce(bool_or(result_status = 'Unchecked'), false),
    coalesce(bool_or(comment is not null), false)
  into v_reviewed_item_count, v_has_failed, v_has_hold, v_has_open, v_has_comment
  from normalized_results;

  if (v_has_failed or v_has_hold)
    and nullif(btrim(coalesce(p_issue_note, '')), '') is null
    and not v_has_comment then
    raise exception 'Issue note or item comment is required when an Inspection item is Failed or Hold.';
  end if;

  v_next_status := case
    when v_has_failed then 'Failed'::public.inspection_form_status
    when v_has_hold then 'Hold'::public.inspection_form_status
    when v_reviewed_item_count >= v_template_item_count and not v_has_open then 'Passed'::public.inspection_form_status
    else 'Pending'::public.inspection_form_status
  end;

  select coalesce(sum(public.calculate_inspection_item_applied_weight(iti.id, coalesce(p_answers -> (iti.id::text), 'null'::jsonb))), 0)
  into v_bop_total
  from public.inspection_template_items iti
  join public.inspection_template_sections its on its.id = iti.section_id
  where its.template_id = v_form.template_id;

  v_next_version_no := v_form.current_version_no + 1;

  insert into public.inspection_form_versions (
    inspection_form_id,
    version_no,
    answers_snapshot,
    bop_base_weight_kg,
    bop_option_weight_kg,
    bop_total_weight_kg,
    status,
    inspected_by_id
  ) values (
    p_inspection_form_id,
    v_next_version_no,
    jsonb_build_object(
      'source', 'official_item_review',
      'answers', coalesce(p_answers, '{}'::jsonb),
      'itemResults', coalesce(p_item_results, '[]'::jsonb),
      'issueNote', nullif(btrim(coalesce(p_issue_note, '')), '')
    ),
    v_bop_total,
    0,
    v_bop_total,
    v_next_status,
    v_actor_profile_id
  ) returning id into v_version_id;

  with template_items as (
    select iti.id
    from public.inspection_template_items iti
    join public.inspection_template_sections its on its.id = iti.section_id
    where its.template_id = v_form.template_id
  ), normalized_results as (
    select distinct on ((result_row.value ->> 'itemId')::uuid)
      (result_row.value ->> 'itemId')::uuid as item_id,
      coalesce(result_row.value ->> 'resultStatus', 'Unchecked') as result_status,
      coalesce(result_row.value -> 'answerValue', 'null'::jsonb) as answer_value,
      nullif(btrim(coalesce(result_row.value ->> 'comment', '')), '') as comment
    from jsonb_array_elements(coalesce(p_item_results, '[]'::jsonb)) result_row(value)
    order by (result_row.value ->> 'itemId')::uuid
  )
  insert into public.inspection_item_results (
    inspection_version_id,
    template_item_id,
    result_status,
    answer_value,
    applied_weight_kg,
    comment
  )
  select
    v_version_id,
    ti.id,
    coalesce(nr.result_status, 'Unchecked')::public.inspection_item_result_status,
    coalesce(nullif(nr.answer_value, 'null'::jsonb), p_answers -> (ti.id::text), 'null'::jsonb),
    public.calculate_inspection_item_applied_weight(ti.id, coalesce(p_answers -> (ti.id::text), nr.answer_value, 'null'::jsonb)),
    nr.comment
  from template_items ti
  left join normalized_results nr on nr.item_id = ti.id;

  update public.inspection_forms
  set status = v_next_status,
      official_bop_weight_kg = v_bop_total,
      current_version_no = v_next_version_no,
      is_locked = true,
      updated_by_id = v_actor_profile_id
  where id = p_inspection_form_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'inspection_form',
    p_inspection_form_id,
    'official_item_review',
    v_form.status::text,
    v_next_status::text,
    jsonb_build_object('version_id', v_version_id, 'bop_total_weight_kg', v_bop_total, 'reviewed_item_count', v_reviewed_item_count),
    v_actor_profile_id
  );

  return v_version_id;
end;
$$;

revoke execute on function public.calculate_inspection_item_applied_weight(uuid, jsonb) from public, anon;
revoke execute on function public.save_inspection_form_draft(uuid, jsonb) from public, anon;
revoke execute on function public.submit_inspection_form_for_inspection(uuid) from public, anon;
revoke execute on function public.get_inspection_form_detail(uuid) from public, anon;
revoke execute on function public.save_inspection_official_review(uuid, jsonb, jsonb, text) from public, anon;

grant execute on function public.calculate_inspection_item_applied_weight(uuid, jsonb) to authenticated, service_role;
grant execute on function public.save_inspection_form_draft(uuid, jsonb) to authenticated, service_role;
grant execute on function public.submit_inspection_form_for_inspection(uuid) to authenticated, service_role;
grant execute on function public.get_inspection_form_detail(uuid) to authenticated, service_role;
grant execute on function public.save_inspection_official_review(uuid, jsonb, jsonb, text) to authenticated, service_role;
