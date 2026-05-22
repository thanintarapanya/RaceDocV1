-- RaceDocV1 Admin Soft Delete Actions
-- Purpose: Admin-only soft-delete RPCs that feed the Recently Delete Restore Center.
-- Apply after RaceDocV1_Supabase_Recently_Deleted_Restore_Center.sql.

drop index if exists public.entry_forms_one_active_per_competitor_event_uk;
create unique index entry_forms_one_active_per_competitor_event_uk
  on public.entry_forms (competitor_profile_id, event_id)
  where status = 'Active'::public.entry_form_status
    and deleted_at is null;

alter table public.scrutineer_reports
  drop constraint if exists scrutineer_reports_scope_uk;

create unique index if not exists scrutineer_reports_scope_active_uk
  on public.scrutineer_reports (race_id, series_race_id, grade_id)
  where deleted_at is null;

create or replace function public.soft_delete_entry_form(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_entry public.entry_forms%rowtype;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can delete Entry Forms.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = p_entry_id
  for update;

  if v_entry.id is null then
    raise exception 'Entry Form was not found.';
  end if;

  if v_entry.deleted_at is not null then
    raise exception 'Entry Form is already deleted.';
  end if;

  update public.entry_forms
  set deleted_at = now(),
      deleted_by_id = v_actor_profile_id,
      updated_at = now(),
      updated_by_id = v_actor_profile_id
  where id = p_entry_id;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, previous_status, new_status, action_by_id)
  values (
    'entry_form',
    p_entry_id,
    'soft_delete',
    to_jsonb(v_entry),
    jsonb_build_object('deletedAt', now(), 'deletedById', v_actor_profile_id),
    v_entry.status::text,
    v_entry.status::text,
    v_actor_profile_id
  );

  return jsonb_build_object('deleted', true, 'entityType', 'entry_form', 'entityId', p_entry_id);
end;
$$;

create or replace function public.soft_delete_competitor_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_request public.competitor_requests%rowtype;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can delete Competitor Requests.';
  end if;

  select * into v_request
  from public.competitor_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Competitor Request was not found.';
  end if;

  if v_request.deleted_at is not null then
    raise exception 'Competitor Request is already deleted.';
  end if;

  update public.competitor_requests
  set deleted_at = now(),
      deleted_by_id = v_actor_profile_id,
      updated_at = now()
  where id = p_request_id;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, previous_status, new_status, action_by_id)
  values (
    'competitor_request',
    p_request_id,
    'soft_delete',
    to_jsonb(v_request),
    jsonb_build_object('deletedAt', now(), 'deletedById', v_actor_profile_id),
    v_request.status::text,
    v_request.status::text,
    v_actor_profile_id
  );

  return jsonb_build_object('deleted', true, 'entityType', 'competitor_request', 'entityId', p_request_id);
end;
$$;

create or replace function public.soft_delete_scrutineer_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_report public.scrutineer_reports%rowtype;
  v_race_still_unlocked boolean;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can delete Scrutineer Reports.';
  end if;

  select * into v_report
  from public.scrutineer_reports
  where id = p_report_id
  for update;

  if v_report.id is null then
    raise exception 'Scrutineer Report was not found.';
  end if;

  if v_report.deleted_at is not null then
    raise exception 'Scrutineer Report is already deleted.';
  end if;

  update public.scrutineer_reports
  set deleted_at = now(),
      deleted_by_id = v_actor_profile_id
  where id = p_report_id;

  if v_report.status = 'Official'::public.scrutineer_report_status then
    select exists (
      select 1
      from public.scrutineer_reports srp
      where srp.race_id = v_report.race_id
        and srp.id <> p_report_id
        and srp.status = 'Official'::public.scrutineer_report_status
        and srp.deleted_at is null
    ) into v_race_still_unlocked;

    update public.races
    set results_import_unlocked = v_race_still_unlocked
    where id = v_report.race_id;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, previous_status, new_status, action_by_id)
  values (
    'scrutineer_report',
    p_report_id,
    'soft_delete',
    to_jsonb(v_report),
    jsonb_build_object('deletedAt', now(), 'deletedById', v_actor_profile_id),
    v_report.status::text,
    v_report.status::text,
    v_actor_profile_id
  );

  return jsonb_build_object('deleted', true, 'entityType', 'scrutineer_report', 'entityId', p_report_id);
end;
$$;

create or replace function public.generate_scrutineer_report(
  p_race_id uuid,
  p_series_race_id uuid,
  p_grade_id uuid,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_report_id uuid;
  v_snapshot jsonb;
  v_existing_status public.scrutineer_report_status;
begin
  if not public.can_manage_scrutineer_report() then
    raise exception 'Only Admin or Head Scrutineer can generate Scrutineer Reports.';
  end if;

  select id, status into v_report_id, v_existing_status
  from public.scrutineer_reports
  where race_id = p_race_id
    and series_race_id = p_series_race_id
    and grade_id = p_grade_id
    and deleted_at is null;

  if v_existing_status = 'Official'::public.scrutineer_report_status then
    raise exception 'Official Scrutineer Reports cannot be regenerated.';
  end if;

  v_snapshot := public.build_scrutineer_report_snapshot(p_race_id, p_series_race_id, p_grade_id);

  if v_snapshot -> 'context' is null then
    raise exception 'Race, Series, or Class scope was not found.';
  end if;

  if v_report_id is null then
    insert into public.scrutineer_reports (race_id, series_race_id, grade_id, status, report_snapshot, remarks)
    values (p_race_id, p_series_race_id, p_grade_id, 'Draft'::public.scrutineer_report_status, v_snapshot, nullif(btrim(coalesce(p_remarks, '')), ''))
    returning id into v_report_id;
  else
    update public.scrutineer_reports
    set status = 'Draft'::public.scrutineer_report_status,
        report_snapshot = v_snapshot,
        remarks = nullif(btrim(coalesce(p_remarks, '')), '')
    where id = v_report_id;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values ('scrutineer_report', v_report_id, 'generate', v_snapshot, v_actor_profile_id);

  return v_report_id;
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
  v_entry public.entry_forms%rowtype;
  v_request public.competitor_requests%rowtype;
  v_report public.scrutineer_reports%rowtype;
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
    select * into v_entry
    from public.entry_forms
    where id = p_entity_id
    for update;

    if v_entry.id is null then
      raise exception 'Entry Form was not found.';
    end if;
    if v_entry.deleted_at is null then
      raise exception 'Entry Form is not deleted.';
    end if;
    if v_entry.deleted_at < now() - interval '30 days' then
      raise exception 'Entry Form restore window has expired.';
    end if;
    if v_entry.status = 'Active'::public.entry_form_status and exists (
      select 1
      from public.entry_forms ef
      where ef.id <> p_entity_id
        and ef.competitor_profile_id = v_entry.competitor_profile_id
        and ef.event_id = v_entry.event_id
        and ef.status = 'Active'::public.entry_form_status
        and ef.deleted_at is null
    ) then
      raise exception 'Cannot restore Entry Form because another Active Entry Form exists for this competitor and event.';
    end if;

    v_old_deleted_at := v_entry.deleted_at;
    v_old_deleted_by_id := v_entry.deleted_by_id;
    v_previous_status := v_entry.status::text;

    update public.entry_forms
    set deleted_at = null,
        deleted_by_id = null,
        updated_at = now(),
        updated_by_id = v_actor_profile_id
    where id = p_entity_id;

  elsif v_entity_type = 'competitor_request' then
    select * into v_request
    from public.competitor_requests
    where id = p_entity_id
    for update;

    if v_request.id is null then
      raise exception 'Competitor Request was not found.';
    end if;
    if v_request.deleted_at is null then
      raise exception 'Competitor Request is not deleted.';
    end if;
    if v_request.deleted_at < now() - interval '30 days' then
      raise exception 'Competitor Request restore window has expired.';
    end if;
    if exists (
      select 1
      from public.entry_forms ef
      where ef.id = v_request.entry_form_id
        and ef.deleted_at is not null
    ) then
      raise exception 'Cannot restore Competitor Request while its Entry Form is still deleted.';
    end if;

    v_old_deleted_at := v_request.deleted_at;
    v_old_deleted_by_id := v_request.deleted_by_id;
    v_previous_status := v_request.status::text;

    update public.competitor_requests
    set deleted_at = null,
        deleted_by_id = null,
        updated_at = now()
    where id = p_entity_id;

  elsif v_entity_type = 'scrutineer_report' then
    select * into v_report
    from public.scrutineer_reports
    where id = p_entity_id
    for update;

    if v_report.id is null then
      raise exception 'Scrutineer Report was not found.';
    end if;
    if v_report.deleted_at is null then
      raise exception 'Scrutineer Report is not deleted.';
    end if;
    if v_report.deleted_at < now() - interval '30 days' then
      raise exception 'Scrutineer Report restore window has expired.';
    end if;
    if exists (
      select 1
      from public.scrutineer_reports srp
      where srp.id <> p_entity_id
        and srp.race_id = v_report.race_id
        and srp.series_race_id = v_report.series_race_id
        and srp.grade_id = v_report.grade_id
        and srp.deleted_at is null
    ) then
      raise exception 'Cannot restore Scrutineer Report because another report exists for this race, series, and grade.';
    end if;

    v_old_deleted_at := v_report.deleted_at;
    v_old_deleted_by_id := v_report.deleted_by_id;
    v_previous_status := v_report.status::text;

    update public.scrutineer_reports
    set deleted_at = null,
        deleted_by_id = null
    where id = p_entity_id;

    if v_report.status = 'Official'::public.scrutineer_report_status then
      update public.races
      set results_import_unlocked = true
      where id = v_report.race_id;
    end if;

  elsif v_entity_type = 'file_asset' then
    select deleted_at, deleted_by_id, null::text
      into v_old_deleted_at, v_old_deleted_by_id, v_previous_status
    from public.file_assets
    where id = p_entity_id
    for update;

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

revoke execute on function public.soft_delete_entry_form(uuid) from public, anon;
revoke execute on function public.soft_delete_competitor_request(uuid) from public, anon;
revoke execute on function public.soft_delete_scrutineer_report(uuid) from public, anon;

grant execute on function public.soft_delete_entry_form(uuid) to authenticated, service_role;
grant execute on function public.soft_delete_competitor_request(uuid) to authenticated, service_role;
grant execute on function public.soft_delete_scrutineer_report(uuid) to authenticated, service_role;
