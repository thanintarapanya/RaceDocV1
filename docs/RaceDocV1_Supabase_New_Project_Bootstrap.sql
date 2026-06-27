-- RaceDocV1 Supabase bootstrap for project xmgtuutrqhmrgdgycuhh.
-- Purpose: bring the corrected Supabase project up to the current frontend contract.
-- Important: this targets the live base schema that uses profiles/roles/user_roles/entry_forms.
-- It intentionally does not recreate the older users/role_assignments/entries schema.

-- 1. Base roles and PT Maxnitron demo race context.
insert into public.roles (code, name, description) values
  ('ADMIN', 'Admin', 'ผู้ดูแลระบบสูงสุด'),
  ('SECRETARY', 'Secretary', 'เลขาธิการสนาม'),
  ('HEAD_SCRUTINEER', 'Head Scrutineer', 'หัวหน้าทีมตรวจสภาพรถ'),
  ('SCRUTINEER_STAFF', 'Scrutineer Staff', 'เจ้าหน้าที่ตรวจสภาพหน้างาน'),
  ('OFFSITE_SCRUTINEER', 'Off-Site Scrutineer Staff', 'เจ้าหน้าที่ตรวจสภาพนอกสถานที่'),
  ('CHAIRMAN', 'President', 'ประธาน'),
  ('STEWARD', 'Steward', 'กรรมการผู้ตัดสิน'),
  ('CLERK', 'Clerk of the course', 'นายสนาม'),
  ('TEAM_MANAGER', 'Team Manager', 'ผู้จัดการทีม'),
  ('COMPETITOR', 'Competitor', 'นักแข่ง')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.organizations (name, slug, brand_settings, is_active)
values ('PT Maxnitron Racing Series', 'pt-maxnitron', '{"accent":"#FF4500"}'::jsonb, true)
on conflict (slug) do update set
  name = excluded.name,
  brand_settings = excluded.brand_settings,
  is_active = true;

insert into public.circuits (name, location, country)
select 'PT Maxnitron Official Circuit', 'Thailand', 'Thailand'
where not exists (
  select 1 from public.circuits where name = 'PT Maxnitron Official Circuit'
);

with org as (
  select id from public.organizations where slug = 'pt-maxnitron' limit 1
)
insert into public.seasons (organization_id, name, year, planned_event_count, status, is_active, activated_at)
select id, 'PT Maxnitron 2026', 2026, 3, 'Active'::public.season_status, true, now()
from org
on conflict (organization_id, year) do update set
  name = excluded.name,
  planned_event_count = excluded.planned_event_count,
  status = 'Active'::public.season_status,
  is_active = true,
  activated_at = coalesce(public.seasons.activated_at, now());

with org as (
  select id from public.organizations where slug = 'pt-maxnitron' limit 1
)
insert into public.series_races (organization_id, code, name, ballast_type, is_active)
select org.id, seed.code, seed.name, seed.ballast_type::public.ballast_type, true
from org
cross join (
  values
    ('SIAM_ECO', 'SIAM ECO', 'SuccessBallast'),
    ('SIAM_TRUCK', 'SIAM TRUCK', 'SuccessBallast')
) as seed(code, name, ballast_type)
on conflict (organization_id, code) do update set
  name = excluded.name,
  ballast_type = excluded.ballast_type,
  is_active = true;

insert into public.grades (code, name, sort_order)
values
  ('PRO', 'Pro', 1),
  ('AM', 'Am', 2)
on conflict (code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

with org as (
  select id from public.organizations where slug = 'pt-maxnitron' limit 1
), season as (
  select s.id from public.seasons s join org on org.id = s.organization_id where s.year = 2026 limit 1
), circuit as (
  select id from public.circuits where name = 'PT Maxnitron Official Circuit' limit 1
)
insert into public.events (season_id, circuit_id, name, event_order, starts_on, ends_on, status)
select season.id, circuit.id, 'Event 1', 1, '2026-06-05'::date, '2026-06-07'::date, 'RegistrationOpen'::public.event_status
from season cross join circuit
on conflict (season_id, event_order) do update set
  name = excluded.name,
  circuit_id = excluded.circuit_id,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = 'RegistrationOpen'::public.event_status;

with org as (
  select id from public.organizations where slug = 'pt-maxnitron' limit 1
), season as (
  select s.id from public.seasons s join org on org.id = s.organization_id where s.year = 2026 limit 1
), event as (
  select e.id from public.events e join season on season.id = e.season_id where e.event_order = 1 limit 1
)
insert into public.races (event_id, name, race_order, session_type, scheduled_at, results_import_unlocked)
select event.id, seed.name, seed.race_order, 'Race', seed.scheduled_at::timestamptz, false
from event
cross join (
  values
    ('Race 1', 1, '2026-06-06 10:00:00+07'),
    ('Race 2', 2, '2026-06-06 15:00:00+07'),
    ('Race 3', 3, '2026-06-07 13:00:00+07')
) as seed(name, race_order, scheduled_at)
on conflict (event_id, race_order) do update set
  name = excluded.name,
  session_type = excluded.session_type,
  scheduled_at = excluded.scheduled_at;

with org as (
  select id from public.organizations where slug = 'pt-maxnitron' limit 1
), season as (
  select s.id from public.seasons s join org on org.id = s.organization_id where s.year = 2026 limit 1
), series as (
  select sr.id from public.series_races sr join org on org.id = sr.organization_id where sr.code in ('SIAM_ECO', 'SIAM_TRUCK')
)
insert into public.season_series (season_id, series_race_id, is_active)
select season.id, series.id, true
from season cross join series
on conflict (season_id, series_race_id) do update set is_active = true;

with org as (
  select id from public.organizations where slug = 'pt-maxnitron' limit 1
), season as (
  select s.id from public.seasons s join org on org.id = s.organization_id where s.year = 2026 limit 1
), season_series as (
  select ss.id
  from public.season_series ss
  join season on season.id = ss.season_id
), grades as (
  select id from public.grades where code in ('PRO', 'AM')
)
insert into public.season_series_grades (season_series_id, grade_id, is_active)
select season_series.id, grades.id, true
from season_series cross join grades
on conflict (season_series_id, grade_id) do update set is_active = true;

with org as (
  select id from public.organizations where slug = 'pt-maxnitron' limit 1
), season as (
  select s.id from public.seasons s join org on org.id = s.organization_id where s.year = 2026 limit 1
), event as (
  select e.id from public.events e join season on season.id = e.season_id where e.event_order = 1 limit 1
), series_grades as (
  select sr.id as series_race_id, g.id as grade_id
  from public.series_races sr
  join org on org.id = sr.organization_id
  cross join public.grades g
  where sr.code in ('SIAM_ECO', 'SIAM_TRUCK')
    and g.code in ('PRO', 'AM')
)
insert into public.event_series_rules (event_id, series_race_id, grade_id, status, version, is_locked)
select event.id, series_grades.series_race_id, series_grades.grade_id, 'Active'::public.rule_status, 1, false
from event cross join series_grades
on conflict (event_id, series_race_id, grade_id, version) do update set
  status = 'Active'::public.rule_status;

-- 2. Storage bucket and policies used by Entry Form document/signature uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'competitor_assets',
  'competitor_assets',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists competitor_assets_select_own_folder on storage.objects;
drop policy if exists competitor_assets_insert_own_folder on storage.objects;
drop policy if exists competitor_assets_update_own_folder on storage.objects;
drop policy if exists competitor_assets_delete_own_folder on storage.objects;

create policy competitor_assets_select_own_folder
on storage.objects for select to authenticated
using (
  bucket_id = 'competitor_assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy competitor_assets_insert_own_folder
on storage.objects for insert to authenticated
with check (
  bucket_id = 'competitor_assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy competitor_assets_update_own_folder
on storage.objects for update to authenticated
using (
  bucket_id = 'competitor_assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'competitor_assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy competitor_assets_delete_own_folder
on storage.objects for delete to authenticated
using (
  bucket_id = 'competitor_assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Checklist extension table for the current Checklist tab.
create table if not exists public.entry_checklists (
  entry_id uuid primary key references public.entry_forms(id) on delete cascade,
  competitor_checked_in boolean not null default false,
  sticker_issued boolean not null default false,
  payment_verified boolean not null default false,
  documents_verified boolean not null default false,
  wristband_issued boolean not null default false,
  notes text,
  checked_by_id uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.entry_checklists enable row level security;

drop policy if exists entry_checklists_select_visible on public.entry_checklists;
drop policy if exists entry_checklists_modify_secretary on public.entry_checklists;
drop policy if exists entry_checklists_insert_secretary on public.entry_checklists;
drop policy if exists entry_checklists_update_secretary on public.entry_checklists;
drop policy if exists entry_checklists_delete_secretary on public.entry_checklists;

create policy entry_checklists_select_visible
on public.entry_checklists for select to authenticated
using (
  public.has_any_role(array['ADMIN','SECRETARY'])
  or exists (
    select 1 from public.entry_forms ef
    where ef.id = entry_checklists.entry_id
      and public.can_manage_competitor(ef.competitor_profile_id, ef.season_id)
  )
);

create policy entry_checklists_insert_secretary
on public.entry_checklists for insert to authenticated
with check (public.has_any_role(array['ADMIN','SECRETARY']));

create policy entry_checklists_update_secretary
on public.entry_checklists for update to authenticated
using (public.has_any_role(array['ADMIN','SECRETARY']))
with check (public.has_any_role(array['ADMIN','SECRETARY']));

create policy entry_checklists_delete_secretary
on public.entry_checklists for delete to authenticated
using (public.has_any_role(array['ADMIN','SECRETARY']));

create index if not exists entry_checklists_updated_at_idx on public.entry_checklists(updated_at desc);
create index if not exists entry_checklists_checked_by_id_idx on public.entry_checklists(checked_by_id);

-- 4. Auth and role RPCs for the current React AuthContext contract.
create or replace function public.get_current_user_roles()
returns table (role_code text)
language sql
stable
security definer
set search_path = public
as $$
  select r.code::text as role_code
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.profile_id
  where p.auth_user_id = auth.uid()
    and ur.is_active = true
  order by r.code;
$$;

create or replace function public.get_auth_bootstrap()
returns table (
  auth_user_id uuid,
  email text,
  app_user_exists boolean,
  app_user_status text,
  profile_exists boolean,
  profile_completed boolean,
  profile jsonb,
  roles jsonb,
  onboarding_status text,
  is_admin_or_secretary boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with current_auth as (
    select au.id as user_id, au.email
    from auth.users au
    where au.id = auth.uid()
  ), profile_row as (
    select p.*
    from public.profiles p
    where p.auth_user_id = auth.uid()
    limit 1
  ), role_rows as (
    select
      ur.profile_id,
      jsonb_agg(r.code::text order by r.code) as roles,
      bool_or(r.code in ('ADMIN', 'SECRETARY')) as is_admin_or_secretary,
      bool_or(r.code = 'TEAM_MANAGER') as is_team_manager
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join profile_row p on p.id = ur.profile_id
    where ur.is_active = true
    group by ur.profile_id
  ), team_rows as (
    select true as has_team
    from public.teams t
    join profile_row p on p.id = t.owner_profile_id
    limit 1
  )
  select
    ca.user_id as auth_user_id,
    ca.email,
    p.id is not null as app_user_exists,
    case when p.id is not null then 'active' else null end as app_user_status,
    p.id is not null as profile_exists,
    p.onboarding_status <> 'ProfileRequired'::public.onboarding_status as profile_completed,
    case
      when p.id is null then null::jsonb
      else jsonb_build_object(
        'id', p.id,
        'auth_user_id', p.auth_user_id,
        'first_name_th', p.first_name_th,
        'last_name_th', p.last_name_th,
        'first_name_en', p.first_name_en,
        'last_name_en', p.last_name_en,
        'phone', p.phone,
        'identity_no', p.identity_no,
        'passport_no', p.passport_no,
        'date_of_birth', p.date_of_birth,
        'blood_type', p.blood_type,
        'nationality', p.nationality,
        'address', p.address,
        'postcode', p.postcode,
        'line_id', p.line_id,
        'instagram', p.instagram,
        'facebook', p.facebook,
        'youtube', p.youtube,
        'tiktok', p.tiktok
      )
    end as profile,
    coalesce(rr.roles, '[]'::jsonb) as roles,
    case
      when p.id is null then 'ProfileRequired'
      when p.onboarding_status = 'ProfileRequired'::public.onboarding_status then 'ProfileRequired'
      when coalesce(rr.is_team_manager, false) and tr.has_team is distinct from true then 'TeamRequired'
      else 'Ready'
    end as onboarding_status,
    coalesce(rr.is_admin_or_secretary, false) as is_admin_or_secretary
  from current_auth ca
  left join profile_row p on true
  left join role_rows rr on rr.profile_id = p.id
  left join team_rows tr on true;
$$;

create or replace function public.get_current_onboarding_profile()
returns table (
  id uuid,
  auth_user_id uuid,
  first_name_th text,
  last_name_th text,
  first_name_en text,
  last_name_en text,
  phone text,
  identity_no text,
  passport_no text,
  date_of_birth date,
  blood_type text,
  nationality text,
  onboarding_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.auth_user_id,
    p.first_name_th,
    p.last_name_th,
    p.first_name_en,
    p.last_name_en,
    p.phone,
    p.identity_no,
    p.passport_no,
    p.date_of_birth,
    p.blood_type,
    p.nationality,
    p.onboarding_status::text
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

drop function if exists public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text);

create function public.complete_user_onboarding(
  p_first_name_th text default null,
  p_last_name_th text default null,
  p_first_name_en text default null,
  p_last_name_en text default null,
  p_phone text default null,
  p_identity_no text default null,
  p_passport_no text default null,
  p_date_of_birth date default null,
  p_blood_type text default null,
  p_nationality text default null,
  p_requested_role text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_role_code text;
  v_role_id uuid;
  v_requested_role text := nullif(btrim(coalesce(p_requested_role, '')), '');
  v_has_elevated_role boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_requested_role not in ('Competitor', 'Team Manager') then
    raise exception 'Security Violation: Invalid role.';
  end if;

  if nullif(btrim(coalesce(p_identity_no, '')), '') is null
     and nullif(btrim(coalesce(p_passport_no, '')), '') is null then
    raise exception 'Identity number or passport number is required.';
  end if;

  v_role_code := case
    when v_requested_role = 'Team Manager' then 'TEAM_MANAGER'
    else 'COMPETITOR'
  end;

  select id into v_role_id
  from public.roles
  where code = v_role_code;

  if v_role_id is null then
    raise exception 'Role % is not configured.', v_role_code;
  end if;

  insert into public.profiles (
    auth_user_id,
    first_name_th,
    last_name_th,
    first_name_en,
    last_name_en,
    phone,
    identity_no,
    passport_no,
    date_of_birth,
    blood_type,
    nationality,
    onboarding_status,
    updated_at
  ) values (
    v_user_id,
    nullif(btrim(coalesce(p_first_name_th, '')), ''),
    nullif(btrim(coalesce(p_last_name_th, '')), ''),
    nullif(btrim(coalesce(p_first_name_en, '')), ''),
    nullif(btrim(coalesce(p_last_name_en, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_identity_no, '')), ''),
    nullif(btrim(coalesce(p_passport_no, '')), ''),
    p_date_of_birth,
    nullif(btrim(coalesce(p_blood_type, '')), ''),
    nullif(btrim(coalesce(p_nationality, '')), ''),
    case
      when v_role_code = 'TEAM_MANAGER' then 'TeamRequired'::public.onboarding_status
      else 'Ready'::public.onboarding_status
    end,
    now()
  )
  on conflict (auth_user_id) do update set
    first_name_th = excluded.first_name_th,
    last_name_th = excluded.last_name_th,
    first_name_en = excluded.first_name_en,
    last_name_en = excluded.last_name_en,
    phone = excluded.phone,
    identity_no = excluded.identity_no,
    passport_no = excluded.passport_no,
    date_of_birth = excluded.date_of_birth,
    blood_type = excluded.blood_type,
    nationality = excluded.nationality,
    onboarding_status = excluded.onboarding_status,
    updated_at = now()
  returning id into v_profile_id;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = v_profile_id
      and ur.is_active = true
      and r.code in ('ADMIN', 'SECRETARY')
  ) into v_has_elevated_role;

  if not v_has_elevated_role then
    insert into public.user_roles (profile_id, role_id, is_active)
    values (v_profile_id, v_role_id, true)
    on conflict do nothing;
  end if;
end;
$$;

-- 5. Entry Form support RPCs against the live entry_forms schema.
create or replace function public.get_current_user_team_prefill()
returns table (
  team_id uuid,
  team_name text,
  manager_name text,
  manager_phone text,
  pit_share_request text,
  document_address text,
  postcode text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.team_name,
    t.manager_name,
    t.manager_phone,
    null::text as pit_share_request,
    t.address as document_address,
    t.postcode
  from public.teams t
  where t.owner_profile_id = public.current_profile_id()
  order by t.created_at desc
  limit 1;
$$;

create or replace function public.get_entry_form_step1_options()
returns table (
  season_id uuid,
  season_name text,
  season_year integer,
  event_id uuid,
  event_name text,
  event_order integer,
  event_status text,
  config_id uuid,
  series_class text,
  series_name text,
  grade_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as season_id,
    s.name as season_name,
    s.year as season_year,
    e.id as event_id,
    e.name as event_name,
    e.event_order,
    e.status::text as event_status,
    esr.id as config_id,
    sr.name || ' - ' || g.name as series_class,
    sr.name as series_name,
    g.name as grade_name
  from public.seasons s
  join public.events e on e.season_id = s.id
  join public.event_series_rules esr on esr.event_id = e.id
  join public.series_races sr on sr.id = esr.series_race_id
  join public.grades g on g.id = esr.grade_id
  where s.is_active = true
    and s.status = 'Active'::public.season_status
    and e.status in ('RegistrationOpen'::public.event_status, 'Active'::public.event_status)
    and esr.status in ('Active'::public.rule_status, 'Locked'::public.rule_status)
  order by s.year desc, e.event_order asc, sr.name asc, g.sort_order asc, g.name asc;
$$;

create or replace function public.get_my_entry_forms()
returns table (
  id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ef.id,
    ev.name as event_name,
    s.year as season_year,
    sr.name || ' - ' || g.name as series_class,
    ef.car_number,
    lower(ef.status::text) as status,
    ef.created_at
  from public.entry_forms ef
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  where ef.deleted_at is null
    and (
      public.has_any_role(array['ADMIN','SECRETARY'])
      or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id)
    )
  order by ef.created_at desc;
$$;

create or replace function public.create_file_asset(
  p_path text,
  p_filename text,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_asset_id uuid;
begin
  if v_profile_id is null then
    raise exception 'Profile required before uploading files.';
  end if;

  if p_path is null or p_path = '' then
    raise exception 'File path is required.';
  end if;

  if split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'Security Violation: upload path must be under your user folder.';
  end if;

  insert into public.file_assets (bucket, path, filename, mime_type, size_bytes, uploaded_by_id)
  values ('competitor_assets', p_path, coalesce(nullif(p_filename, ''), p_path), p_mime_type, p_size_bytes, v_profile_id)
  on conflict (bucket, path) do update set
    filename = excluded.filename,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    uploaded_by_id = excluded.uploaded_by_id,
    deleted_at = null,
    deleted_by_id = null
  returning id into v_asset_id;

  return v_asset_id;
end;
$$;

create or replace function public.submit_entry_form_batch(p_payload jsonb)
returns table (entry_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_batch_id uuid;
  v_team_id uuid;
  v_season_id uuid;
  v_series_name text := nullif(btrim(p_payload #>> '{step1,seriesName}'), '');
  v_grade_name text := nullif(btrim(p_payload #>> '{step1,gradeName}'), '');
  v_car_number text := nullif(btrim(p_payload #>> '{step1,carNumber}'), '');
  v_personal_snapshot jsonb := coalesce(p_payload -> 'personalSnapshot', '{}'::jsonb);
  v_driver_license_snapshot jsonb := coalesce(p_payload -> 'driverLicense', '{}'::jsonb);
  v_vehicle_snapshot jsonb := coalesce(p_payload -> 'vehicle', '{}'::jsonb);
  v_team_snapshot jsonb := coalesce(p_payload -> 'teamSnapshot', '{}'::jsonb);
  v_documents jsonb := coalesce(p_payload -> 'documents', '{}'::jsonb);
  v_signature_path text := p_payload #>> '{consent,signatureAsset,path}';
  v_entry_ids uuid[] := array[]::uuid[];
  v_event_id uuid;
  v_event_ids jsonb := coalesce(p_payload #> '{step1,eventIds}', '[]'::jsonb);
  v_series_race_id uuid;
  v_grade_id uuid;
  v_rule_id uuid;
  v_entry_id uuid;
  doc record;
begin
  if v_profile_id is null then
    raise exception 'Profile required before submitting Entry Form.';
  end if;

  if v_series_name is null or v_grade_name is null or v_car_number is null then
    raise exception 'Event, series, class, and car number are required.';
  end if;

  if jsonb_typeof(v_event_ids) <> 'array' or jsonb_array_length(v_event_ids) = 0 then
    raise exception 'At least one event is required.';
  end if;

  select id into v_team_id
  from public.teams
  where id::text = nullif(v_team_snapshot ->> 'teamId', '')
    and owner_profile_id = v_profile_id;

  insert into public.entry_form_batches (competitor_profile_id, submitted_by_id, team_id, status)
  values (v_profile_id, v_profile_id, v_team_id, 'Pending'::public.entry_form_status)
  returning id into v_batch_id;

  for v_event_id in
    select event_id_text::uuid from jsonb_array_elements_text(v_event_ids) as event_id_text
  loop
    select e.season_id into v_season_id
    from public.events e
    where e.id = v_event_id
      and e.status in ('RegistrationOpen'::public.event_status, 'Active'::public.event_status);

    if v_season_id is null then
      raise exception 'Selected event is not open for registration.';
    end if;

    select sr.id, g.id, esr.id
    into v_series_race_id, v_grade_id, v_rule_id
    from public.event_series_rules esr
    join public.series_races sr on sr.id = esr.series_race_id
    join public.grades g on g.id = esr.grade_id
    where esr.event_id = v_event_id
      and sr.name = v_series_name
      and g.name = v_grade_name
      and esr.status in ('Active'::public.rule_status, 'Locked'::public.rule_status)
    order by esr.version desc
    limit 1;

    if v_rule_id is null then
      raise exception 'Selected series/class is not configured for this event.';
    end if;

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
      v_batch_id,
      v_season_id,
      v_event_id,
      v_series_race_id,
      v_grade_id,
      v_profile_id,
      v_team_id,
      v_rule_id,
      v_car_number,
      'Pending'::public.entry_form_status,
      'Pending'::public.payment_status,
      false,
      v_personal_snapshot,
      v_driver_license_snapshot,
      v_vehicle_snapshot,
      v_team_snapshot,
      nullif(v_signature_path, ''),
      v_profile_id,
      v_profile_id
    ) returning id into v_entry_id;

    for doc in
      select key as document_type, value as asset
      from jsonb_each(v_documents)
      where nullif(value ->> 'fileAssetId', '') is not null
    loop
      insert into public.entry_form_documents (entry_form_id, file_asset_id, document_type, is_required)
      values (v_entry_id, (doc.asset ->> 'fileAssetId')::uuid, doc.document_type, true);
    end loop;

    v_entry_ids := array_append(v_entry_ids, v_entry_id);
  end loop;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
  values ('entry_form_batch', v_batch_id, 'submit', jsonb_build_object('entry_ids', v_entry_ids), 'Pending', v_profile_id);

  entry_ids := v_entry_ids;
  return next;
end;
$$;

create or replace function public.is_admin_or_secretary(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.profile_id = p.id
    join public.roles r on r.id = ur.role_id
    where p.auth_user_id = p_user_id
      and ur.is_active = true
      and r.code in ('ADMIN', 'SECRETARY')
  );
$$;

create or replace function public.get_secretary_pending_entries()
returns table (
  id uuid,
  batch_id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  status text,
  submitted_at timestamptz,
  created_at timestamptz,
  competitor_user_id uuid,
  competitor_name text,
  competitor_email text,
  personal_snapshot jsonb,
  driver_license_snapshot jsonb,
  vehicle_snapshot jsonb,
  team_snapshot jsonb,
  signature_path text,
  documents jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ef.id,
    ef.batch_id,
    ev.name as event_name,
    s.year as season_year,
    sr.name || ' - ' || g.name as series_class,
    ef.car_number,
    lower(ef.status::text) as status,
    ef.created_at as submitted_at,
    ef.created_at,
    cp.auth_user_id as competitor_user_id,
    coalesce(nullif(btrim(concat_ws(' ', cp.first_name_en, cp.last_name_en)), ''), nullif(btrim(concat_ws(' ', cp.first_name_th, cp.last_name_th)), ''), au.email, 'Unknown competitor') as competitor_name,
    coalesce(au.email, '') as competitor_email,
    ef.personal_snapshot,
    ef.driver_license_snapshot,
    ef.vehicle_snapshot,
    ef.team_snapshot,
    ef.signature_path,
    coalesce(docs.documents, '[]'::jsonb) as documents
  from public.entry_forms ef
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles cp on cp.id = ef.competitor_profile_id
  left join auth.users au on au.id = cp.auth_user_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'documentType', efd.document_type,
        'isRequired', efd.is_required,
        'uploadedAt', efd.uploaded_at,
        'fileAssetId', fa.id,
        'bucket', fa.bucket,
        'path', fa.path,
        'filename', fa.filename,
        'mimeType', fa.mime_type,
        'sizeBytes', fa.size_bytes
      ) order by efd.uploaded_at
    ) as documents
    from public.entry_form_documents efd
    join public.file_assets fa on fa.id = efd.file_asset_id
    where efd.entry_form_id = ef.id
  ) docs on true
  where public.has_any_role(array['ADMIN','SECRETARY'])
    and ef.deleted_at is null
    and ef.status = 'Pending'::public.entry_form_status
  order by ef.created_at asc;
$$;

create or replace function public.approve_entry_form(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_old_status text;
begin
  if not public.has_any_role(array['ADMIN','SECRETARY']) then
    raise exception 'Only Admin or Secretary can approve Entry Forms.';
  end if;

  select status::text into v_old_status
  from public.entry_forms
  where id = p_entry_id
  for update;

  if v_old_status is null then
    raise exception 'Entry Form not found.';
  end if;

  update public.entry_forms
  set status = 'Active'::public.entry_form_status,
      is_locked = true,
      approved_by_id = v_profile_id,
      approved_at = now(),
      updated_by_id = v_profile_id,
      updated_at = now()
  where id = p_entry_id;

  insert into public.entry_checklists (entry_id)
  values (p_entry_id)
  on conflict (entry_id) do nothing;

  update public.entry_form_batches b
  set status = 'Active'::public.entry_form_status
  where b.id = (select ef.batch_id from public.entry_forms ef where ef.id = p_entry_id)
    and not exists (
      select 1 from public.entry_forms ef
      where ef.batch_id = b.id
        and ef.status <> 'Active'::public.entry_form_status
    );

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, action_by_id)
  values ('entry_form', p_entry_id, 'approve', v_old_status, 'Active', v_profile_id);
end;
$$;

create or replace function public.reject_entry_form(p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_old_status text;
begin
  if not public.has_any_role(array['ADMIN','SECRETARY']) then
    raise exception 'Only Admin or Secretary can reject Entry Forms.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reject reason is required.';
  end if;

  select status::text into v_old_status
  from public.entry_forms
  where id = p_entry_id
  for update;

  if v_old_status is null then
    raise exception 'Entry Form not found.';
  end if;

  update public.entry_forms
  set status = 'Rejected'::public.entry_form_status,
      is_locked = false,
      approved_by_id = null,
      approved_at = null,
      updated_by_id = v_profile_id,
      updated_at = now()
  where id = p_entry_id;

  update public.entry_form_batches b
  set status = 'Rejected'::public.entry_form_status
  where b.id = (select ef.batch_id from public.entry_forms ef where ef.id = p_entry_id);

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'entry_form',
    p_entry_id,
    'reject',
    v_old_status,
    'Rejected',
    jsonb_build_object('reason', btrim(p_reason)),
    v_profile_id
  );
end;
$$;

-- 6. Dashboard and Checklist RPCs.
create or replace function public.get_dashboard_summary()
returns table (
  scope text,
  metrics jsonb,
  alerts jsonb,
  next_actions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.current_profile_id() as profile_id,
      public.has_any_role(array['ADMIN','SECRETARY']) as elevated
  ), visible_entries as (
    select ef.*
    from public.entry_forms ef, ctx
    where ef.deleted_at is null
      and (
        ctx.elevated
        or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id)
      )
  ), metric_row as (
    select
      count(*) filter (where status = 'Pending'::public.entry_form_status)::int as pending_entry_forms,
      count(*) filter (where status = 'Active'::public.entry_form_status)::int as active_entry_forms,
      count(*) filter (where status = 'Rejected'::public.entry_form_status)::int as rejected_entry_forms
    from visible_entries
  ), request_row as (
    select count(*)::int as pending_requests
    from public.competitor_requests cr, ctx
    where cr.deleted_at is null
      and cr.status in ('Pending'::public.competitor_request_status, 'In Review'::public.competitor_request_status)
      and (
        ctx.elevated
        or cr.requester_profile_id = ctx.profile_id
      )
  ), inspection_row as (
    select
      count(*) filter (where inf.status = 'Pending'::public.inspection_form_status)::int as inspection_pending,
      count(*) filter (where inf.status = 'Failed'::public.inspection_form_status)::int as inspection_failed
    from public.inspection_forms inf
    join visible_entries ve on ve.id = inf.entry_form_id
  ), weight_row as (
    select count(*) filter (where wl.status = 'Failed'::public.weigh_in_status)::int as weight_in_failed
    from public.weigh_in_logs wl
    join visible_entries ve on ve.id = wl.entry_form_id
  ), alert_rows as (
    select jsonb_agg(
      jsonb_build_object(
        'type', 'entry_form',
        'severity', case when ve.status = 'Rejected'::public.entry_form_status then 'danger' else 'info' end,
        'title', 'Entry Form ' || ve.status::text,
        'description', ev.name || ' / ' || sr.name || ' - ' || g.name || ' / Car ' || ve.car_number,
        'timestamp', ve.updated_at
      ) order by ve.updated_at desc
    ) as alerts
    from (
      select * from visible_entries order by updated_at desc limit 5
    ) ve
    join public.events ev on ev.id = ve.event_id
    join public.series_races sr on sr.id = ve.series_race_id
    join public.grades g on g.id = ve.grade_id
  )
  select
    case when ctx.elevated then 'official' else 'competitor' end as scope,
    jsonb_build_object(
      'pendingEntryForms', coalesce(m.pending_entry_forms, 0),
      'activeEntryForms', coalesce(m.active_entry_forms, 0),
      'rejectedEntryForms', coalesce(m.rejected_entry_forms, 0),
      'pendingRequests', coalesce(req.pending_requests, 0),
      'inspectionPending', coalesce(ins.inspection_pending, 0),
      'inspectionFailed', coalesce(ins.inspection_failed, 0),
      'weightInFailed', coalesce(w.weight_in_failed, 0)
    ) as metrics,
    coalesce(ar.alerts, '[]'::jsonb) as alerts,
    case
      when ctx.elevated then jsonb_build_array(
        jsonb_build_object('label', 'Review Entry Forms', 'path', '/entry-forms', 'count', coalesce(m.pending_entry_forms, 0)),
        jsonb_build_object('label', 'Open Checklist', 'path', '/checklist', 'count', coalesce(m.active_entry_forms, 0))
      )
      else jsonb_build_array(
        jsonb_build_object('label', 'Create Entry Form', 'path', '/entry-forms', 'count', coalesce(m.pending_entry_forms, 0)),
        jsonb_build_object('label', 'View Checklist', 'path', '/checklist', 'count', coalesce(m.active_entry_forms, 0))
      )
    end as next_actions
  from ctx
  cross join metric_row m
  cross join request_row req
  cross join inspection_row ins
  cross join weight_row w
  cross join alert_rows ar;
$$;

create or replace function public.get_checklist_entries()
returns table (
  entry_id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  competitor_user_id uuid,
  competitor_name text,
  competitor_email text,
  status text,
  competitor_checked_in boolean,
  sticker_issued boolean,
  payment_verified boolean,
  documents_verified boolean,
  wristband_issued boolean,
  notes text,
  checked_by_name text,
  checked_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ef.id as entry_id,
    ev.name as event_name,
    s.year as season_year,
    sr.name || ' - ' || g.name as series_class,
    ef.car_number,
    cp.auth_user_id as competitor_user_id,
    coalesce(nullif(btrim(concat_ws(' ', cp.first_name_en, cp.last_name_en)), ''), nullif(btrim(concat_ws(' ', cp.first_name_th, cp.last_name_th)), ''), au.email, 'Unknown competitor') as competitor_name,
    coalesce(au.email, '') as competitor_email,
    lower(ef.status::text) as status,
    coalesce(ec.competitor_checked_in, false),
    coalesce(ec.sticker_issued, false),
    coalesce(ec.payment_verified, false),
    coalesce(ec.documents_verified, false),
    coalesce(ec.wristband_issued, false),
    ec.notes,
    nullif(btrim(concat_ws(' ', checked.first_name_en, checked.last_name_en)), '') as checked_by_name,
    ec.checked_at,
    coalesce(ec.updated_at, ef.updated_at) as updated_at
  from public.entry_forms ef
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles cp on cp.id = ef.competitor_profile_id
  left join auth.users au on au.id = cp.auth_user_id
  left join public.entry_checklists ec on ec.entry_id = ef.id
  left join public.profiles checked on checked.id = ec.checked_by_id
  where ef.deleted_at is null
    and ef.status = 'Active'::public.entry_form_status
    and (
      public.has_any_role(array['ADMIN','SECRETARY'])
      or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id)
    )
  order by ev.event_order asc, sr.name asc, g.sort_order asc, ef.car_number asc;
$$;

create or replace function public.update_entry_checklist(
  p_entry_id uuid,
  p_competitor_checked_in boolean default null,
  p_sticker_issued boolean default null,
  p_payment_verified boolean default null,
  p_documents_verified boolean default null,
  p_wristband_issued boolean default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_previous jsonb;
  v_next jsonb;
begin
  if not public.has_any_role(array['ADMIN','SECRETARY']) then
    raise exception 'Only Admin or Secretary can update checklist.';
  end if;

  if not exists (
    select 1 from public.entry_forms ef
    where ef.id = p_entry_id
      and ef.status = 'Active'::public.entry_form_status
      and ef.deleted_at is null
  ) then
    raise exception 'Active Entry Form not found.';
  end if;

  select to_jsonb(ec) into v_previous
  from public.entry_checklists ec
  where ec.entry_id = p_entry_id;

  insert into public.entry_checklists (
    entry_id,
    competitor_checked_in,
    sticker_issued,
    payment_verified,
    documents_verified,
    wristband_issued,
    notes,
    checked_by_id,
    checked_at,
    updated_at
  ) values (
    p_entry_id,
    coalesce(p_competitor_checked_in, false),
    coalesce(p_sticker_issued, false),
    coalesce(p_payment_verified, false),
    coalesce(p_documents_verified, false),
    coalesce(p_wristband_issued, false),
    p_notes,
    v_profile_id,
    now(),
    now()
  )
  on conflict (entry_id) do update set
    competitor_checked_in = coalesce(p_competitor_checked_in, public.entry_checklists.competitor_checked_in),
    sticker_issued = coalesce(p_sticker_issued, public.entry_checklists.sticker_issued),
    payment_verified = coalesce(p_payment_verified, public.entry_checklists.payment_verified),
    documents_verified = coalesce(p_documents_verified, public.entry_checklists.documents_verified),
    wristband_issued = coalesce(p_wristband_issued, public.entry_checklists.wristband_issued),
    notes = coalesce(p_notes, public.entry_checklists.notes),
    checked_by_id = v_profile_id,
    checked_at = now(),
    updated_at = now();

  select to_jsonb(ec) into v_next
  from public.entry_checklists ec
  where ec.entry_id = p_entry_id;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('entry_checklist', p_entry_id, 'update', v_previous, v_next, v_profile_id);
end;
$$;

-- 7. Function privileges.
revoke all on function public.get_current_user_roles() from public, anon;
revoke all on function public.get_auth_bootstrap() from public, anon;
revoke all on function public.get_current_onboarding_profile() from public, anon;
revoke all on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) from public, anon;
revoke all on function public.get_current_user_team_prefill() from public, anon;
revoke all on function public.get_entry_form_step1_options() from public, anon;
revoke all on function public.get_my_entry_forms() from public, anon;
revoke all on function public.create_file_asset(text, text, text, bigint) from public, anon;
revoke all on function public.submit_entry_form_batch(jsonb) from public, anon;
revoke all on function public.is_admin_or_secretary(uuid) from public, anon;
revoke all on function public.get_secretary_pending_entries() from public, anon;
revoke all on function public.approve_entry_form(uuid) from public, anon;
revoke all on function public.reject_entry_form(uuid, text) from public, anon;
revoke all on function public.get_dashboard_summary() from public, anon;
revoke all on function public.get_checklist_entries() from public, anon;
revoke all on function public.update_entry_checklist(uuid, boolean, boolean, boolean, boolean, boolean, text) from public, anon;

grant execute on function public.get_current_user_roles() to authenticated;
grant execute on function public.get_auth_bootstrap() to authenticated;
grant execute on function public.get_current_onboarding_profile() to authenticated;
grant execute on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) to authenticated;
grant execute on function public.get_current_user_team_prefill() to authenticated;
grant execute on function public.get_entry_form_step1_options() to authenticated;
grant execute on function public.get_my_entry_forms() to authenticated;
grant execute on function public.create_file_asset(text, text, text, bigint) to authenticated;
grant execute on function public.submit_entry_form_batch(jsonb) to authenticated;
grant execute on function public.is_admin_or_secretary(uuid) to authenticated;
grant execute on function public.get_secretary_pending_entries() to authenticated;
grant execute on function public.approve_entry_form(uuid) to authenticated;
grant execute on function public.reject_entry_form(uuid, text) to authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
grant execute on function public.get_checklist_entries() to authenticated;
grant execute on function public.update_entry_checklist(uuid, boolean, boolean, boolean, boolean, boolean, text) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
