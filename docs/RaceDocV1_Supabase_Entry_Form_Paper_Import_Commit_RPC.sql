-- RaceDocV1 Entry Form Paper/Excel Import Commit RPC
-- Phase: Entry Form operations hardening
-- Purpose:
-- 1. Convert fully matched paper/CSV import batches into real Pending Entry Forms.
-- 2. Preserve ownership by assigning Entry Forms to the matched competitor profile.
-- 3. Preserve audit trail by recording the race-office actor who committed the batch.
--
-- Apply after: RaceDocV1_Supabase_Entry_Form_Paper_Import_Foundation.sql

begin;

create or replace function public.commit_entry_import_batch(p_batch_id uuid)
returns table (
  import_batch_id uuid,
  committed_row_count integer,
  entry_ids uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_import_batch public.entry_import_batches%rowtype;
  v_unmatched_count integer;
  v_matched_count integer;
  v_entry_ids uuid[] := array[]::uuid[];
  v_row public.entry_import_rows%rowtype;
  v_payload jsonb;
  v_competitor_profile_id uuid;
  v_event_name text;
  v_series_name text;
  v_grade_name text;
  v_car_number text;
  v_event_id uuid;
  v_season_id uuid;
  v_series_race_id uuid;
  v_grade_id uuid;
  v_rule_id uuid;
  v_entry_batch_id uuid;
  v_entry_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Profile required before committing Entry import batches.';
  end if;

  if not public.has_any_role(array['ADMIN','SECRETARY']) then
    raise exception 'Only Admin or Secretary can commit Entry import batches.';
  end if;

  select * into v_import_batch
  from public.entry_import_batches b
  where b.id = p_batch_id
  for update;

  if v_import_batch.id is null then
    raise exception 'Import batch not found.';
  end if;

  if v_import_batch.status = 'Committed'::public.entry_import_batch_status then
    raise exception 'Import batch is already committed.';
  end if;

  if v_import_batch.status = 'Cancelled'::public.entry_import_batch_status then
    raise exception 'Cancelled import batches cannot be committed.';
  end if;

  select count(*) into v_matched_count
  from public.entry_import_rows r
  where r.batch_id = p_batch_id
    and r.status = 'Matched'::public.entry_import_row_status;

  if v_matched_count = 0 then
    raise exception 'At least one matched import row is required before commit.';
  end if;

  select count(*) into v_unmatched_count
  from public.entry_import_rows r
  where r.batch_id = p_batch_id
    and r.status <> 'Matched'::public.entry_import_row_status;

  if v_unmatched_count > 0 then
    raise exception 'Every import row must be matched before committing the batch.';
  end if;

  for v_row in
    select *
    from public.entry_import_rows r
    where r.batch_id = p_batch_id
      and r.status = 'Matched'::public.entry_import_row_status
    order by r.row_number
    for update
  loop
    v_payload := coalesce(v_row.normalized_payload, '{}'::jsonb) || coalesce(v_row.raw_payload, '{}'::jsonb);
    v_competitor_profile_id := v_row.matched_profile_id;
    v_event_name := coalesce(nullif(btrim(v_payload #>> '{entry,eventName}'), ''), nullif(btrim(v_payload ->> 'eventName'), ''));
    v_series_name := coalesce(nullif(btrim(v_payload #>> '{entry,seriesName}'), ''), nullif(btrim(v_payload ->> 'seriesName'), ''));
    v_grade_name := coalesce(nullif(btrim(v_payload #>> '{entry,gradeName}'), ''), nullif(btrim(v_payload ->> 'gradeName'), ''));
    v_car_number := coalesce(nullif(btrim(v_payload #>> '{entry,carNumber}'), ''), nullif(btrim(v_payload ->> 'carNumber'), ''));

    if v_competitor_profile_id is null then
      raise exception 'Import row % has no matched profile.', v_row.row_number;
    end if;

    if v_event_name is null or v_series_name is null or v_grade_name is null or v_car_number is null then
      raise exception 'Import row % needs event, series, grade, and car number before commit.', v_row.row_number;
    end if;

    select e.id, e.season_id into v_event_id, v_season_id
    from public.events e
    join public.seasons s on s.id = e.season_id
    where lower(e.name) = lower(v_event_name)
      and s.is_active = true
      and s.status = 'Active'::public.season_status
      and e.status in ('RegistrationOpen'::public.event_status, 'Active'::public.event_status)
    order by e.event_order asc
    limit 1;

    if v_event_id is null then
      raise exception 'Import row % references an event that is not open in the active season: %.', v_row.row_number, v_event_name;
    end if;

    select sr.id, g.id, esr.id
    into v_series_race_id, v_grade_id, v_rule_id
    from public.event_series_rules esr
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
    where esr.event_id = v_event_id
      and lower(sr.name) = lower(v_series_name)
      and lower(g.name) = lower(v_grade_name)
      and esr.status in ('Active'::public.rule_status, 'Locked'::public.rule_status)
    order by esr.version desc
    limit 1;

    if v_rule_id is null then
      raise exception 'Import row % references an event/series/grade combination that is not configured.', v_row.row_number;
    end if;

    if exists (
      select 1
      from public.entry_forms ef
      where ef.competitor_profile_id = v_competitor_profile_id
        and ef.event_id = v_event_id
        and ef.deleted_at is null
        and ef.status in ('Pending'::public.entry_form_status, 'Active'::public.entry_form_status)
    ) then
      raise exception 'Import row % would duplicate an existing Pending or Active Entry Form for this competitor/event.', v_row.row_number;
    end if;

    insert into public.entry_form_batches (competitor_profile_id, submitted_by_id, team_id, status)
    values (v_competitor_profile_id, v_actor_profile_id, null, 'Pending'::public.entry_form_status)
    returning id into v_entry_batch_id;

    insert into public.entry_forms (
      batch_id,
      season_id,
      event_id,
      series_race_id,
      grade_id,
      competitor_profile_id,
      team_id,
      event_series_rule_id,
      car_number,
      status,
      payment_status,
      is_locked,
      personal_snapshot,
      driver_license_snapshot,
      vehicle_snapshot,
      team_snapshot,
      signature_path,
      created_by_id,
      updated_by_id
    ) values (
      v_entry_batch_id,
      v_season_id,
      v_event_id,
      v_series_race_id,
      v_grade_id,
      v_competitor_profile_id,
      null,
      v_rule_id,
      v_car_number,
      'Pending'::public.entry_form_status,
      'Pending'::public.payment_status,
      false,
      coalesce(v_payload -> 'personalSnapshot', '{}'::jsonb),
      coalesce(v_payload -> 'driverLicense', '{}'::jsonb),
      coalesce(v_payload -> 'vehicle', '{}'::jsonb),
      coalesce(v_payload -> 'teamSnapshot', '{}'::jsonb),
      null,
      v_actor_profile_id,
      v_actor_profile_id
    ) returning id into v_entry_id;

    update public.entry_import_rows
    set
      status = 'Committed'::public.entry_import_row_status,
      committed_entry_form_id = v_entry_id,
      updated_at = now()
    where id = v_row.id;

    insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
    values (
      'entry_form',
      v_entry_id,
      'paper_import_commit',
      jsonb_build_object('importBatchId', p_batch_id, 'importRowId', v_row.id, 'rowNumber', v_row.row_number),
      'Pending',
      v_actor_profile_id
    );

    insert into public.audit_logs (entity_type, entity_id, action, new_values, previous_status, new_status, action_by_id)
    values (
      'entry_import_row',
      v_row.id,
      'commit_entry_form',
      jsonb_build_object('entryFormId', v_entry_id, 'entryFormBatchId', v_entry_batch_id),
      'Matched',
      'Committed',
      v_actor_profile_id
    );

    v_entry_ids := array_append(v_entry_ids, v_entry_id);
  end loop;

  update public.entry_import_batches
  set
    status = 'Committed'::public.entry_import_batch_status,
    committed_by_id = v_actor_profile_id,
    committed_at = now(),
    row_count = v_matched_count,
    updated_at = now()
  where id = p_batch_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, previous_status, new_status, action_by_id)
  values (
    'entry_import_batch',
    p_batch_id,
    'commit',
    jsonb_build_object('entryIds', v_entry_ids, 'rowCount', v_matched_count),
    v_import_batch.status::text,
    'Committed',
    v_actor_profile_id
  );

  import_batch_id := p_batch_id;
  committed_row_count := v_matched_count;
  entry_ids := v_entry_ids;
  return next;
end;
$$;

revoke all on function public.commit_entry_import_batch(uuid) from public, anon;
grant execute on function public.commit_entry_import_batch(uuid) to authenticated;
grant execute on function public.commit_entry_import_batch(uuid) to service_role;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');

commit;
