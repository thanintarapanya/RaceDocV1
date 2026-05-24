-- RaceDocV1 Entry Form Paper/Excel Import Foundation
-- Phase: Entry Form operations hardening
-- Purpose:
-- 1. Stage paper registration and Excel import batches before creating Entry Forms.
-- 2. Keep Admin/Secretary-only control with RLS and RPC execute grants.
-- 3. Support profile matching without auto-creating login accounts from spreadsheet data.
-- 4. Preserve audit trail for import batch creation and row match decisions.
--
-- Scope note: this foundation intentionally stages and matches import rows only.
-- Creating locked Entry Forms from matched rows belongs in the next commit RPC.

begin;

do $$
begin
  create type public.entry_import_batch_source as enum (
    'ManualPaper',
    'ExcelUpload'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.entry_import_batch_status as enum (
    'Draft',
    'Reviewing',
    'ReadyToCommit',
    'Committed',
    'Cancelled'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.entry_import_row_status as enum (
    'NeedsReview',
    'Matched',
    'Invalid',
    'Committed',
    'Skipped'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.entry_import_match_method as enum (
    'Email',
    'Phone',
    'IdentityNo',
    'PassportNo',
    'NameFallback',
    'Manual'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.entry_import_batches (
  id uuid primary key default gen_random_uuid(),
  source public.entry_import_batch_source not null,
  status public.entry_import_batch_status not null default 'Draft',
  original_filename text,
  row_count integer not null default 0,
  created_by_id uuid not null references public.profiles(id) on delete restrict,
  committed_by_id uuid references public.profiles(id) on delete set null,
  committed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_import_batches_row_count_nonnegative_chk check (row_count >= 0),
  constraint entry_import_batches_commit_consistency_chk check (
    (status = 'Committed' and committed_by_id is not null and committed_at is not null)
    or status <> 'Committed'
  )
);

create table if not exists public.entry_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.entry_import_batches(id) on delete cascade,
  row_number integer not null,
  status public.entry_import_row_status not null default 'NeedsReview',
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  matched_profile_id uuid references public.profiles(id) on delete set null,
  match_method public.entry_import_match_method,
  match_confidence numeric(5,2),
  validation_errors jsonb not null default '[]'::jsonb,
  committed_entry_form_id uuid references public.entry_forms(id) on delete set null,
  reviewed_by_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_import_rows_row_number_positive_chk check (row_number > 0),
  constraint entry_import_rows_match_confidence_range_chk check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 100)),
  constraint entry_import_rows_batch_row_uk unique (batch_id, row_number)
);

alter table public.entry_import_batches enable row level security;
alter table public.entry_import_rows enable row level security;

drop policy if exists entry_import_batches_admin_secretary_select on public.entry_import_batches;
drop policy if exists entry_import_batches_admin_secretary_insert on public.entry_import_batches;
drop policy if exists entry_import_batches_admin_secretary_update on public.entry_import_batches;
drop policy if exists entry_import_rows_admin_secretary_select on public.entry_import_rows;
drop policy if exists entry_import_rows_admin_secretary_insert on public.entry_import_rows;
drop policy if exists entry_import_rows_admin_secretary_update on public.entry_import_rows;

create policy entry_import_batches_admin_secretary_select
on public.entry_import_batches for select to authenticated
using (public.has_any_role(array['ADMIN','SECRETARY']));

create policy entry_import_batches_admin_secretary_insert
on public.entry_import_batches for insert to authenticated
with check (public.has_any_role(array['ADMIN','SECRETARY']));

create policy entry_import_batches_admin_secretary_update
on public.entry_import_batches for update to authenticated
using (public.has_any_role(array['ADMIN','SECRETARY']))
with check (public.has_any_role(array['ADMIN','SECRETARY']));

create policy entry_import_rows_admin_secretary_select
on public.entry_import_rows for select to authenticated
using (public.has_any_role(array['ADMIN','SECRETARY']));

create policy entry_import_rows_admin_secretary_insert
on public.entry_import_rows for insert to authenticated
with check (public.has_any_role(array['ADMIN','SECRETARY']));

create policy entry_import_rows_admin_secretary_update
on public.entry_import_rows for update to authenticated
using (public.has_any_role(array['ADMIN','SECRETARY']))
with check (public.has_any_role(array['ADMIN','SECRETARY']));

create index if not exists entry_import_batches_status_created_at_idx
  on public.entry_import_batches (status, created_at desc);

create index if not exists entry_import_batches_created_by_id_idx
  on public.entry_import_batches (created_by_id);

create index if not exists entry_import_rows_batch_status_idx
  on public.entry_import_rows (batch_id, status, row_number);

create index if not exists entry_import_rows_matched_profile_id_idx
  on public.entry_import_rows (matched_profile_id);

create or replace function public.create_entry_import_batch(
  p_source public.entry_import_batch_source,
  p_original_filename text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_batch_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Profile required before creating an Entry import batch.';
  end if;

  if not public.has_any_role(array['ADMIN','SECRETARY']) then
    raise exception 'Only Admin or Secretary can create Entry import batches.';
  end if;

  insert into public.entry_import_batches (source, original_filename, notes, created_by_id)
  values (p_source, nullif(btrim(coalesce(p_original_filename, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''), v_actor_profile_id)
  returning id into v_batch_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values (
    'entry_import_batch',
    v_batch_id,
    'create',
    jsonb_build_object('source', p_source, 'originalFilename', p_original_filename),
    v_actor_profile_id
  );

  return v_batch_id;
end;
$$;

create or replace function public.stage_entry_import_row(
  p_batch_id uuid,
  p_row_number integer,
  p_raw_payload jsonb,
  p_normalized_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_row_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Profile required before staging Entry import rows.';
  end if;

  if not public.has_any_role(array['ADMIN','SECRETARY']) then
    raise exception 'Only Admin or Secretary can stage Entry import rows.';
  end if;

  if p_row_number is null or p_row_number <= 0 then
    raise exception 'Import row number must be positive.';
  end if;

  if not exists (
    select 1
    from public.entry_import_batches b
    where b.id = p_batch_id
      and b.status in ('Draft', 'Reviewing')
  ) then
    raise exception 'Import batch is not editable.';
  end if;

  insert into public.entry_import_rows (batch_id, row_number, raw_payload, normalized_payload)
  values (p_batch_id, p_row_number, coalesce(p_raw_payload, '{}'::jsonb), coalesce(p_normalized_payload, '{}'::jsonb))
  on conflict (batch_id, row_number) do update set
    raw_payload = excluded.raw_payload,
    normalized_payload = excluded.normalized_payload,
    status = 'NeedsReview'::public.entry_import_row_status,
    validation_errors = '[]'::jsonb,
    matched_profile_id = null,
    match_method = null,
    match_confidence = null,
    reviewed_by_id = null,
    reviewed_at = null,
    updated_at = now()
  returning id into v_row_id;

  update public.entry_import_batches b
  set
    status = 'Reviewing'::public.entry_import_batch_status,
    row_count = (select count(*) from public.entry_import_rows r where r.batch_id = p_batch_id),
    updated_at = now()
  where b.id = p_batch_id;

  return v_row_id;
end;
$$;

create or replace function public.find_entry_import_profile_matches(p_row_payload jsonb)
returns table (
  profile_id uuid,
  display_name text,
  email text,
  phone text,
  match_method public.entry_import_match_method,
  match_confidence numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with input as (
    select
      lower(nullif(btrim(coalesce(p_row_payload->>'email', '')), '')) as email,
      regexp_replace(nullif(btrim(coalesce(p_row_payload->>'phone', '')), ''), '[^0-9+]', '', 'g') as phone,
      nullif(btrim(coalesce(p_row_payload->>'identityNo', '')), '') as identity_no,
      nullif(btrim(coalesce(p_row_payload->>'passportNo', '')), '') as passport_no,
      lower(nullif(btrim(coalesce(p_row_payload->>'firstNameTh', '') || ' ' || coalesce(p_row_payload->>'lastNameTh', '')), '')) as name_th,
      lower(nullif(btrim(coalesce(p_row_payload->>'firstNameEn', '') || ' ' || coalesce(p_row_payload->>'lastNameEn', '')), '')) as name_en
  ), candidates as (
    select
      p.id as profile_id,
      nullif(btrim(coalesce(p.first_name_en, '') || ' ' || coalesce(p.last_name_en, '')), '') as display_name,
      au.email,
      p.phone,
      case
        when input.email is not null and lower(au.email) = input.email then 'Email'::public.entry_import_match_method
        when input.phone is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = input.phone then 'Phone'::public.entry_import_match_method
        when input.identity_no is not null and p.identity_no = input.identity_no then 'IdentityNo'::public.entry_import_match_method
        when input.passport_no is not null and p.passport_no = input.passport_no then 'PassportNo'::public.entry_import_match_method
        when input.name_th is not null and lower(nullif(btrim(coalesce(p.first_name_th, '') || ' ' || coalesce(p.last_name_th, '')), '')) = input.name_th then 'NameFallback'::public.entry_import_match_method
        when input.name_en is not null and lower(nullif(btrim(coalesce(p.first_name_en, '') || ' ' || coalesce(p.last_name_en, '')), '')) = input.name_en then 'NameFallback'::public.entry_import_match_method
      end as match_method,
      case
        when input.email is not null and lower(au.email) = input.email then 100::numeric
        when input.phone is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = input.phone then 90::numeric
        when input.identity_no is not null and p.identity_no = input.identity_no then 95::numeric
        when input.passport_no is not null and p.passport_no = input.passport_no then 95::numeric
        when input.name_th is not null and lower(nullif(btrim(coalesce(p.first_name_th, '') || ' ' || coalesce(p.last_name_th, '')), '')) = input.name_th then 55::numeric
        when input.name_en is not null and lower(nullif(btrim(coalesce(p.first_name_en, '') || ' ' || coalesce(p.last_name_en, '')), '')) = input.name_en then 55::numeric
      end as match_confidence
    from public.profiles p
    left join auth.users au on au.id = p.auth_user_id
    cross join input
    where public.has_any_role(array['ADMIN','SECRETARY'])
      and (
        (input.email is not null and lower(au.email) = input.email)
        or (input.phone is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = input.phone)
        or (input.identity_no is not null and p.identity_no = input.identity_no)
        or (input.passport_no is not null and p.passport_no = input.passport_no)
        or (input.name_th is not null and lower(nullif(btrim(coalesce(p.first_name_th, '') || ' ' || coalesce(p.last_name_th, '')), '')) = input.name_th)
        or (input.name_en is not null and lower(nullif(btrim(coalesce(p.first_name_en, '') || ' ' || coalesce(p.last_name_en, '')), '')) = input.name_en)
      )
  )
  select profile_id, display_name, email, phone, match_method, match_confidence
  from candidates
  where match_method is not null
  order by match_confidence desc, display_name nulls last, email nulls last
  limit 10;
$$;

create or replace function public.set_entry_import_row_match(
  p_row_id uuid,
  p_profile_id uuid,
  p_match_method public.entry_import_match_method default 'Manual',
  p_match_confidence numeric default 100
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Profile required before matching Entry import rows.';
  end if;

  if not public.has_any_role(array['ADMIN','SECRETARY']) then
    raise exception 'Only Admin or Secretary can match Entry import rows.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_profile_id) then
    raise exception 'Matched profile does not exist.';
  end if;

  select to_jsonb(r) into v_old_values
  from public.entry_import_rows r
  where r.id = p_row_id
  for update;

  if v_old_values is null then
    raise exception 'Import row not found.';
  end if;

  update public.entry_import_rows
  set
    matched_profile_id = p_profile_id,
    match_method = coalesce(p_match_method, 'Manual'::public.entry_import_match_method),
    match_confidence = coalesce(p_match_confidence, 100),
    status = 'Matched'::public.entry_import_row_status,
    reviewed_by_id = v_actor_profile_id,
    reviewed_at = now(),
    updated_at = now()
  where id = p_row_id;

  select to_jsonb(r) into v_new_values
  from public.entry_import_rows r
  where r.id = p_row_id;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('entry_import_row', p_row_id, 'match_profile', v_old_values, v_new_values, v_actor_profile_id);
end;
$$;

revoke all on table public.entry_import_batches from public, anon, authenticated;
revoke all on table public.entry_import_rows from public, anon, authenticated;
grant select on table public.entry_import_batches to authenticated, service_role;
grant select on table public.entry_import_rows to authenticated, service_role;
grant insert, update, delete on table public.entry_import_batches to service_role;
grant insert, update, delete on table public.entry_import_rows to service_role;

revoke all on function public.create_entry_import_batch(public.entry_import_batch_source, text, text) from public, anon;
revoke all on function public.stage_entry_import_row(uuid, integer, jsonb, jsonb) from public, anon;
revoke all on function public.find_entry_import_profile_matches(jsonb) from public, anon;
revoke all on function public.set_entry_import_row_match(uuid, uuid, public.entry_import_match_method, numeric) from public, anon;
grant execute on function public.create_entry_import_batch(public.entry_import_batch_source, text, text) to authenticated;
grant execute on function public.stage_entry_import_row(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function public.find_entry_import_profile_matches(jsonb) to authenticated;
grant execute on function public.set_entry_import_row_match(uuid, uuid, public.entry_import_match_method, numeric) to authenticated;
grant execute on function public.create_entry_import_batch(public.entry_import_batch_source, text, text) to service_role;
grant execute on function public.stage_entry_import_row(uuid, integer, jsonb, jsonb) to service_role;
grant execute on function public.find_entry_import_profile_matches(jsonb) to service_role;
grant execute on function public.set_entry_import_row_match(uuid, uuid, public.entry_import_match_method, numeric) to service_role;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');

commit;
