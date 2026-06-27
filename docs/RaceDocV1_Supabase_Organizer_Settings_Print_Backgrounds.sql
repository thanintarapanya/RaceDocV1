-- RaceDocV1 Organizer Settings A4 Print Background Foundation
-- Purpose: Admin-managed A4 PDF/export background assets scoped to Events.
-- Apply after RaceDocV1_Supabase_Organizer_Settings_Sponsor_Sticker_Storage_Hardening.sql.

update storage.buckets
set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']::text[]
where id = 'organizer_assets';

drop policy if exists organizer_assets_select_admin on storage.objects;
drop policy if exists organizer_assets_insert_admin on storage.objects;
drop policy if exists organizer_assets_update_admin on storage.objects;
drop policy if exists organizer_assets_delete_admin on storage.objects;

create policy organizer_assets_select_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'organizer_assets'
  and public.has_role('ADMIN', null)
  and (storage.foldername(name))[1] in ('sponsor-stickers', 'print-backgrounds')
);

create policy organizer_assets_insert_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'organizer_assets'
  and public.has_role('ADMIN', null)
  and (storage.foldername(name))[1] in ('sponsor-stickers', 'print-backgrounds')
);

create policy organizer_assets_update_admin
on storage.objects for update to authenticated
using (
  bucket_id = 'organizer_assets'
  and public.has_role('ADMIN', null)
  and (storage.foldername(name))[1] in ('sponsor-stickers', 'print-backgrounds')
)
with check (
  bucket_id = 'organizer_assets'
  and public.has_role('ADMIN', null)
  and (storage.foldername(name))[1] in ('sponsor-stickers', 'print-backgrounds')
);

create policy organizer_assets_delete_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'organizer_assets'
  and public.has_role('ADMIN', null)
  and (storage.foldername(name))[1] in ('sponsor-stickers', 'print-backgrounds')
);

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
    select coalesce(jsonb_agg(jsonb_build_object('ballastRuleId', br.id, 'eventSeriesRuleId', br.event_series_rule_id, 'eventId', e.id, 'eventName', e.name, 'seriesRaceId', sr.id, 'seriesName', sr.name, 'gradeId', g.id, 'gradeName', g.name, 'ballastType', br.ballast_type::text, 'maxBallastKg', br.max_ballast_kg, 'joinWeightEnabled', br.join_weight_enabled, 'positionMatrix', br.position_matrix, 'removalRule', br.removal_rule) order by e.event_order, sr.name, g.sort_order), '[]'::jsonb) as ballast_rules
    from public.ballast_rules br
    join public.event_series_rules esr on esr.id = br.event_series_rule_id
    join public.events e on e.id = esr.event_id
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
  ), tire_rule_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('tireRuleId', tr.id, 'eventSeriesRuleId', tr.event_series_rule_id, 'eventId', e.id, 'eventName', e.name, 'seriesRaceId', sr.id, 'seriesName', sr.name, 'gradeId', g.id, 'gradeName', g.name, 'tireBrand', tr.tire_brand, 'tireModel', tr.tire_model, 'isAllowed', tr.is_allowed) order by e.event_order, sr.name, g.sort_order, tr.tire_brand, tr.tire_model nulls first), '[]'::jsonb) as tire_rules
    from public.tire_rules tr
    join public.event_series_rules esr on esr.id = tr.event_series_rule_id
    join public.events e on e.id = esr.event_id
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
  ), sponsor_sticker_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('sponsorStickerAssetId', ssa.id, 'eventSeriesRuleId', ssa.event_series_rule_id, 'eventId', e.id, 'eventName', e.name, 'seriesRaceId', sr.id, 'seriesName', sr.name, 'gradeId', g.id, 'gradeName', g.name, 'title', ssa.title, 'fileAssetId', fa.id, 'bucket', fa.bucket, 'path', fa.path, 'filename', fa.filename, 'mimeType', fa.mime_type, 'sizeBytes', fa.size_bytes) order by e.event_order, sr.name, g.sort_order, ssa.title), '[]'::jsonb) as sponsor_sticker_assets
    from public.sponsor_sticker_assets ssa
    join public.file_assets fa on fa.id = ssa.file_asset_id and fa.deleted_at is null
    join public.event_series_rules esr on esr.id = ssa.event_series_rule_id
    join public.events e on e.id = esr.event_id
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
  ), print_background_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('printBackgroundAssetId', pba.id, 'eventId', e.id, 'eventName', e.name, 'seasonId', e.season_id, 'eventOrder', e.event_order, 'title', pba.title, 'isDefault', pba.is_default, 'fileAssetId', fa.id, 'bucket', fa.bucket, 'path', fa.path, 'filename', fa.filename, 'mimeType', fa.mime_type, 'sizeBytes', fa.size_bytes) order by e.event_order, pba.is_default desc, pba.title), '[]'::jsonb) as print_background_assets
    from public.print_background_assets pba
    join public.file_assets fa on fa.id = pba.file_asset_id and fa.deleted_at is null
    join public.events e on e.id = pba.event_id
  ), inspection_item_rows as (
    select iti.section_id,
      jsonb_agg(jsonb_build_object('itemId', iti.id, 'sectionId', iti.section_id, 'labelTh', iti.label_th, 'labelEn', iti.label_en, 'inputType', iti.input_type::text, 'options', iti.options, 'weightEffectType', iti.weight_effect_type::text, 'fixedWeightKg', iti.fixed_weight_kg, 'isRequired', iti.is_required, 'sortOrder', iti.sort_order) order by iti.sort_order, iti.label_th) as items
    from public.inspection_template_items iti
    group by iti.section_id
  ), inspection_section_rows as (
    select its.template_id,
      jsonb_agg(jsonb_build_object('sectionId', its.id, 'templateId', its.template_id, 'code', its.code, 'title', its.title, 'sortOrder', its.sort_order, 'isFixed', its.is_fixed, 'items', coalesce(iir.items, '[]'::jsonb)) order by its.sort_order, its.title) as sections
    from public.inspection_template_sections its
    left join inspection_item_rows iir on iir.section_id = its.id
    group by its.template_id
  ), inspection_template_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('templateId', ift.id, 'eventSeriesRuleId', ift.event_series_rule_id, 'eventId', e.id, 'eventName', e.name, 'seriesRaceId', sr.id, 'seriesName', sr.name, 'gradeId', g.id, 'gradeName', g.name, 'name', ift.name, 'version', ift.version, 'isActive', ift.is_active, 'sections', coalesce(isr.sections, '[]'::jsonb)) order by e.event_order, sr.name, g.sort_order, ift.version desc), '[]'::jsonb) as inspection_templates
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
    'tireRules', case when public.has_role('ADMIN', null) then tire_rule_rows.tire_rules else '[]'::jsonb end,
    'sponsorStickerAssets', case when public.has_role('ADMIN', null) then sponsor_sticker_rows.sponsor_sticker_assets else '[]'::jsonb end,
    'printBackgroundAssets', case when public.has_role('ADMIN', null) then print_background_rows.print_background_assets else '[]'::jsonb end,
    'inspectionTemplates', case when public.has_role('ADMIN', null) then inspection_template_rows.inspection_templates else '[]'::jsonb end,
    'seasons', case when public.has_role('ADMIN', null) then season_rows.seasons else '[]'::jsonb end,
    'events', case when public.has_role('ADMIN', null) then event_rows.events else '[]'::jsonb end,
    'races', case when public.has_role('ADMIN', null) then race_rows.races else '[]'::jsonb end
  )
  from organization_rows, circuit_rows, series_rows, grade_rows, season_series_rows, season_series_grade_rows, event_series_rule_rows, ballast_rule_rows, tire_rule_rows, sponsor_sticker_rows, print_background_rows, inspection_template_rows, season_rows, event_rows, race_rows;
$$;

create or replace function public.save_organizer_print_background_asset(
  p_print_background_asset_id uuid default null,
  p_event_id uuid default null,
  p_title text default null,
  p_is_default boolean default false,
  p_path text default null,
  p_filename text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_event public.events%rowtype;
  v_existing public.print_background_assets%rowtype;
  v_file_asset_id uuid;
  v_print_background_asset_id uuid;
  v_title text;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null then
    raise exception 'Event was not found.';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_title is null then
    raise exception 'Print background title is required.';
  end if;

  if p_print_background_asset_id is not null then
    select * into v_existing from public.print_background_assets where id = p_print_background_asset_id;
    if v_existing.id is null then
      raise exception 'Print background asset was not found.';
    end if;
    select to_jsonb(pba.*) into v_old_values from public.print_background_assets pba where pba.id = p_print_background_asset_id;
    v_file_asset_id := v_existing.file_asset_id;
  end if;

  if nullif(btrim(coalesce(p_path, '')), '') is not null then
    if split_part(p_path, '/', 1) <> 'print-backgrounds' or position('..' in p_path) > 0 then
      raise exception 'Print background path must be under print-backgrounds/.';
    end if;

    if coalesce(p_mime_type, '') not in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf') then
      raise exception 'Print background must be PNG, JPEG, WebP, or PDF.';
    end if;

    if p_size_bytes is not null and p_size_bytes < 0 then
      raise exception 'File size cannot be negative.';
    end if;

    insert into public.file_assets (bucket, path, filename, mime_type, size_bytes, uploaded_by_id)
    values ('organizer_assets', p_path, coalesce(nullif(p_filename, ''), p_path), p_mime_type, p_size_bytes, v_actor_profile_id)
    on conflict (bucket, path) do update set
      filename = excluded.filename,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      uploaded_by_id = excluded.uploaded_by_id,
      deleted_at = null,
      deleted_by_id = null
    returning id into v_file_asset_id;
  elsif p_print_background_asset_id is null then
    raise exception 'Print background file is required.';
  end if;

  if coalesce(p_is_default, false) then
    update public.print_background_assets
    set is_default = false
    where event_id = p_event_id
      and (p_print_background_asset_id is null or id <> p_print_background_asset_id);
  end if;

  if p_print_background_asset_id is not null then
    update public.print_background_assets
    set event_id = p_event_id,
        file_asset_id = v_file_asset_id,
        title = v_title,
        is_default = coalesce(p_is_default, false)
    where id = p_print_background_asset_id
    returning id, to_jsonb(public.print_background_assets.*) into v_print_background_asset_id, v_new_values;
  else
    insert into public.print_background_assets (event_id, file_asset_id, title, is_default)
    values (p_event_id, v_file_asset_id, v_title, coalesce(p_is_default, false))
    returning id, to_jsonb(public.print_background_assets.*) into v_print_background_asset_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('print_background_asset', v_print_background_asset_id, case when p_print_background_asset_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_print_background_asset_id;
end;
$$;

revoke execute on function public.get_organizer_settings() from public, anon;
revoke execute on function public.save_organizer_print_background_asset(uuid, uuid, text, boolean, text, text, text, bigint) from public, anon;

grant execute on function public.get_organizer_settings() to authenticated, service_role;
grant execute on function public.save_organizer_print_background_asset(uuid, uuid, text, boolean, text, text, text, bigint) to authenticated, service_role;
