-- RaceDocV1 Inspection Form Version History
-- Purpose: expose role-safe version history for dynamic Inspection Forms so
-- officials and owners can visually compare answer/review changes over time.

create or replace function public.get_inspection_form_version_history(
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
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) as can_operate
  ), form_context as (
    select
      inf.id as inspection_form_id,
      inf.entry_form_id,
      inf.template_id,
      inf.status::text as status,
      inf.current_version_no,
      ef.season_id,
      ef.competitor_profile_id,
      ef.car_number,
      ev.name as event_name,
      s.year as season_year,
      sr.name || ' - ' || g.name as series_class,
      coalesce(nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''), nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''), au.email, 'Competitor') as competitor_name
    from public.inspection_forms inf
    join public.entry_forms ef on ef.id = inf.entry_form_id
    join public.events ev on ev.id = ef.event_id
    join public.seasons s on s.id = ef.season_id
    join public.series_races sr on sr.id = ef.series_race_id
    join public.grades g on g.id = ef.grade_id
    join public.profiles p on p.id = ef.competitor_profile_id
    left join auth.users au on au.id = p.auth_user_id
    cross join ctx
    where inf.id = p_inspection_form_id
      and (ctx.can_operate or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id) or public.can_access_entry_form(ef.id))
  ), item_catalog as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'itemId', iti.id,
      'sectionId', its.id,
      'sectionTitle', its.title,
      'sectionSortOrder', its.sort_order,
      'labelTh', iti.label_th,
      'labelEn', iti.label_en,
      'inputType', iti.input_type::text,
      'weightEffectType', iti.weight_effect_type::text,
      'sortOrder', iti.sort_order
    ) order by its.sort_order, iti.sort_order, iti.label_th), '[]'::jsonb) as items
    from form_context fc
    join public.inspection_template_sections its on its.template_id = fc.template_id
    join public.inspection_template_items iti on iti.section_id = its.id
  ), version_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'versionId', ifv.id,
      'versionNo', ifv.version_no,
      'status', ifv.status::text,
      'source', ifv.answers_snapshot ->> 'source',
      'createdAt', ifv.created_at,
      'inspectedById', ifv.inspected_by_id,
      'inspectedByName', coalesce(nullif(btrim(concat_ws(' ', inspector.first_name_th, inspector.last_name_th)), ''), nullif(btrim(concat_ws(' ', inspector.first_name_en, inspector.last_name_en)), ''), 'System / competitor'),
      'bopBaseWeightKg', ifv.bop_base_weight_kg,
      'bopOptionWeightKg', ifv.bop_option_weight_kg,
      'bopTotalWeightKg', ifv.bop_total_weight_kg,
      'issueNote', ifv.answers_snapshot ->> 'issueNote',
      'answers', coalesce(ifv.answers_snapshot -> 'answers', '{}'::jsonb),
      'answersSnapshot', ifv.answers_snapshot,
      'itemResults', coalesce(item_results.item_results, '[]'::jsonb)
    ) order by ifv.version_no desc), '[]'::jsonb) as versions
    from form_context fc
    join public.inspection_form_versions ifv on ifv.inspection_form_id = fc.inspection_form_id
    left join public.profiles inspector on inspector.id = ifv.inspected_by_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'itemId', iir.template_item_id,
        'resultStatus', iir.result_status::text,
        'answerValue', iir.answer_value,
        'appliedWeightKg', iir.applied_weight_kg,
        'comment', iir.comment
      ) order by its.sort_order, iti.sort_order, iti.label_th) as item_results
      from public.inspection_item_results iir
      left join public.inspection_template_items iti on iti.id = iir.template_item_id
      left join public.inspection_template_sections its on its.id = iti.section_id
      where iir.inspection_version_id = ifv.id
    ) item_results on true
  )
  select jsonb_build_object(
    'context', jsonb_build_object(
      'inspectionFormId', fc.inspection_form_id,
      'entryId', fc.entry_form_id,
      'templateId', fc.template_id,
      'status', fc.status,
      'currentVersionNo', fc.current_version_no,
      'carNumber', fc.car_number,
      'eventName', fc.event_name,
      'seasonYear', fc.season_year,
      'seriesClass', fc.series_class,
      'competitorName', fc.competitor_name
    ),
    'itemCatalog', item_catalog.items,
    'versions', version_rows.versions
  )
  from form_context fc
  cross join item_catalog
  cross join version_rows;
$$;

revoke execute on function public.get_inspection_form_version_history(uuid) from public, anon;
grant execute on function public.get_inspection_form_version_history(uuid) to authenticated, service_role;
