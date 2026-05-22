-- RaceDocV1 Recently Deleted Restore Center
-- Purpose: Admin-only RPCs for reviewing and restoring soft-deleted operational records.
-- Scope: Entry Forms, Competitor Requests, Scrutineer Reports, and File Assets.
-- Retention: Items remain restorable for 30 days after deleted_at. This script does not hard-delete records.

create index if not exists entry_forms_deleted_at_idx
  on public.entry_forms (deleted_at desc)
  where deleted_at is not null;

create index if not exists entry_forms_deleted_by_id_idx
  on public.entry_forms (deleted_by_id)
  where deleted_by_id is not null;

create index if not exists competitor_requests_deleted_at_idx
  on public.competitor_requests (deleted_at desc)
  where deleted_at is not null;

create index if not exists competitor_requests_deleted_by_id_idx
  on public.competitor_requests (deleted_by_id)
  where deleted_by_id is not null;

create index if not exists scrutineer_reports_deleted_at_idx
  on public.scrutineer_reports (deleted_at desc)
  where deleted_at is not null;

create index if not exists scrutineer_reports_deleted_by_id_idx
  on public.scrutineer_reports (deleted_by_id)
  where deleted_by_id is not null;

create index if not exists file_assets_deleted_at_idx
  on public.file_assets (deleted_at desc)
  where deleted_at is not null;

create index if not exists file_assets_deleted_by_id_idx
  on public.file_assets (deleted_by_id)
  where deleted_by_id is not null;

create or replace function public.get_recently_deleted_items(
  p_entity_type text default 'all',
  p_search text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_entity_type text := lower(coalesce(nullif(btrim(p_entity_type), ''), 'all'));
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_items jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can view recently deleted records.';
  end if;

  if v_entity_type not in ('all', 'entry_form', 'competitor_request', 'scrutineer_report', 'file_asset') then
    raise exception 'Unsupported recently deleted entity type: %', p_entity_type;
  end if;

  with deleted_items as (
    select
      'entry_form'::text as entity_type,
      ef.id as entity_id,
      concat('Entry Form #', ef.car_number) as title,
      concat_ws(' / ', e.name, sr.name, g.name) as subtitle,
      ef.status::text as status,
      ef.deleted_at,
      ef.deleted_by_id,
      concat_ws(' ', dp.first_name_en, dp.last_name_en, dp.first_name_th, dp.last_name_th) as deleted_by_name,
      jsonb_build_object(
        'carNumber', ef.car_number,
        'eventName', e.name,
        'seriesRace', sr.name,
        'grade', g.name,
        'status', ef.status::text,
        'competitorProfileId', ef.competitor_profile_id
      ) as metadata,
      concat_ws(' ', ef.car_number, e.name, sr.name, g.name, ef.status::text) as searchable_text
    from public.entry_forms ef
    join public.events e on e.id = ef.event_id
    join public.series_races sr on sr.id = ef.series_race_id
    join public.grades g on g.id = ef.grade_id
    left join public.profiles dp on dp.id = ef.deleted_by_id
    where ef.deleted_at is not null

    union all

    select
      'competitor_request'::text as entity_type,
      cr.id as entity_id,
      concat('Competitor Request ', cr.queue_no) as title,
      concat_ws(' / ', cr.topic, e.name, sr.name, g.name) as subtitle,
      cr.status::text as status,
      cr.deleted_at,
      cr.deleted_by_id,
      concat_ws(' ', dp.first_name_en, dp.last_name_en, dp.first_name_th, dp.last_name_th) as deleted_by_name,
      jsonb_build_object(
        'queueNo', cr.queue_no,
        'topic', cr.topic,
        'eventName', e.name,
        'seriesRace', sr.name,
        'grade', g.name,
        'status', cr.status::text,
        'requesterProfileId', cr.requester_profile_id
      ) as metadata,
      concat_ws(' ', cr.queue_no, cr.topic, e.name, sr.name, g.name, cr.status::text) as searchable_text
    from public.competitor_requests cr
    join public.entry_forms ef on ef.id = cr.entry_form_id
    join public.events e on e.id = ef.event_id
    join public.series_races sr on sr.id = ef.series_race_id
    join public.grades g on g.id = ef.grade_id
    left join public.profiles dp on dp.id = cr.deleted_by_id
    where cr.deleted_at is not null

    union all

    select
      'scrutineer_report'::text as entity_type,
      srp.id as entity_id,
      concat('Scrutineer Report ', r.name) as title,
      concat_ws(' / ', e.name, srx.name, g.name) as subtitle,
      srp.status::text as status,
      srp.deleted_at,
      srp.deleted_by_id,
      concat_ws(' ', dp.first_name_en, dp.last_name_en, dp.first_name_th, dp.last_name_th) as deleted_by_name,
      jsonb_build_object(
        'eventName', e.name,
        'raceName', r.name,
        'seriesRace', srx.name,
        'grade', g.name,
        'status', srp.status::text
      ) as metadata,
      concat_ws(' ', e.name, r.name, srx.name, g.name, srp.status::text) as searchable_text
    from public.scrutineer_reports srp
    join public.races r on r.id = srp.race_id
    join public.events e on e.id = r.event_id
    join public.series_races srx on srx.id = srp.series_race_id
    join public.grades g on g.id = srp.grade_id
    left join public.profiles dp on dp.id = srp.deleted_by_id
    where srp.deleted_at is not null

    union all

    select
      'file_asset'::text as entity_type,
      fa.id as entity_id,
      fa.filename as title,
      concat_ws(' / ', fa.bucket, fa.path) as subtitle,
      null::text as status,
      fa.deleted_at,
      fa.deleted_by_id,
      concat_ws(' ', dp.first_name_en, dp.last_name_en, dp.first_name_th, dp.last_name_th) as deleted_by_name,
      jsonb_build_object(
        'bucket', fa.bucket,
        'path', fa.path,
        'filename', fa.filename,
        'mimeType', fa.mime_type,
        'sizeBytes', fa.size_bytes
      ) as metadata,
      concat_ws(' ', fa.filename, fa.bucket, fa.path, fa.mime_type) as searchable_text
    from public.file_assets fa
    left join public.profiles dp on dp.id = fa.deleted_by_id
    where fa.deleted_at is not null
  ), filtered_items as (
    select *
    from deleted_items
    where (v_entity_type = 'all' or entity_type = v_entity_type)
      and (v_search is null or searchable_text ilike '%' || v_search || '%')
    order by deleted_at desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entityType', entity_type,
        'entityId', entity_id,
        'title', title,
        'subtitle', subtitle,
        'status', status,
        'deletedAt', deleted_at,
        'deletedById', deleted_by_id,
        'deletedByName', nullif(btrim(coalesce(deleted_by_name, '')), ''),
        'restoreExpiresAt', deleted_at + interval '30 days',
        'isRestorable', deleted_at >= now() - interval '30 days',
        'metadata', metadata
      )
      order by deleted_at desc
    ),
    '[]'::jsonb
  ) into v_items
  from filtered_items;

  return jsonb_build_object(
    'canManage', true,
    'retentionDays', 30,
    'items', v_items
  );
end;
$$;

create or replace function public.restore_recently_deleted_item(
  p_entity_type text,
  p_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_entity_type text := lower(coalesce(nullif(btrim(p_entity_type), ''), ''));
  v_old_deleted_at timestamptz;
  v_old_deleted_by_id uuid;
  v_previous_status text;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can restore recently deleted records.';
  end if;

  if p_entity_id is null then
    raise exception 'Entity id is required.';
  end if;

  if v_entity_type = 'entry_form' then
    select deleted_at, deleted_by_id, status::text
      into v_old_deleted_at, v_old_deleted_by_id, v_previous_status
    from public.entry_forms
    where id = p_entity_id;

    if not found then
      raise exception 'Entry Form was not found.';
    end if;
    if v_old_deleted_at is null then
      raise exception 'Entry Form is not deleted.';
    end if;
    if v_old_deleted_at < now() - interval '30 days' then
      raise exception 'Entry Form restore window has expired.';
    end if;

    update public.entry_forms
    set deleted_at = null,
        deleted_by_id = null,
        updated_at = now(),
        updated_by_id = v_actor_profile_id
    where id = p_entity_id;

  elsif v_entity_type = 'competitor_request' then
    select deleted_at, deleted_by_id, status::text
      into v_old_deleted_at, v_old_deleted_by_id, v_previous_status
    from public.competitor_requests
    where id = p_entity_id;

    if not found then
      raise exception 'Competitor Request was not found.';
    end if;
    if v_old_deleted_at is null then
      raise exception 'Competitor Request is not deleted.';
    end if;
    if v_old_deleted_at < now() - interval '30 days' then
      raise exception 'Competitor Request restore window has expired.';
    end if;

    update public.competitor_requests
    set deleted_at = null,
        deleted_by_id = null,
        updated_at = now()
    where id = p_entity_id;

  elsif v_entity_type = 'scrutineer_report' then
    select deleted_at, deleted_by_id, status::text
      into v_old_deleted_at, v_old_deleted_by_id, v_previous_status
    from public.scrutineer_reports
    where id = p_entity_id;

    if not found then
      raise exception 'Scrutineer Report was not found.';
    end if;
    if v_old_deleted_at is null then
      raise exception 'Scrutineer Report is not deleted.';
    end if;
    if v_old_deleted_at < now() - interval '30 days' then
      raise exception 'Scrutineer Report restore window has expired.';
    end if;

    update public.scrutineer_reports
    set deleted_at = null,
        deleted_by_id = null
    where id = p_entity_id;

  elsif v_entity_type = 'file_asset' then
    select deleted_at, deleted_by_id, null::text
      into v_old_deleted_at, v_old_deleted_by_id, v_previous_status
    from public.file_assets
    where id = p_entity_id;

    if not found then
      raise exception 'File Asset was not found.';
    end if;
    if v_old_deleted_at is null then
      raise exception 'File Asset is not deleted.';
    end if;
    if v_old_deleted_at < now() - interval '30 days' then
      raise exception 'File Asset restore window has expired.';
    end if;

    update public.file_assets
    set deleted_at = null,
        deleted_by_id = null
    where id = p_entity_id;

  else
    raise exception 'Unsupported recently deleted entity type: %', p_entity_type;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, previous_status, new_status, action_by_id)
  values (
    v_entity_type,
    p_entity_id,
    'restore',
    jsonb_build_object('deletedAt', v_old_deleted_at, 'deletedById', v_old_deleted_by_id),
    jsonb_build_object('deletedAt', null, 'deletedById', null),
    v_previous_status,
    v_previous_status,
    v_actor_profile_id
  );

  return jsonb_build_object(
    'restored', true,
    'entityType', v_entity_type,
    'entityId', p_entity_id
  );
end;
$$;

revoke execute on function public.get_recently_deleted_items(text, text, integer) from public, anon;
revoke execute on function public.restore_recently_deleted_item(text, uuid) from public, anon;

grant execute on function public.get_recently_deleted_items(text, text, integer) to authenticated, service_role;
grant execute on function public.restore_recently_deleted_item(text, uuid) to authenticated, service_role;
