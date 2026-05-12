-- =========================================================
-- RaceDocV1 Secure Onboarding RPC
-- Deployed via Supabase MCP migration: secure_onboarding_rpc_live_schema
-- Purpose: prevent frontend writes directly to role assignment tables.
-- =========================================================

insert into public.roles (code, name, description) values
('ADMIN'::public.role_code, 'Admin', 'ผู้ดูแลระบบสูงสุด'),
('SECRETARY'::public.role_code, 'Secretary', 'เลขาธิการสนาม'),
('HEAD_SCRUTINEER'::public.role_code, 'Head Scrutineer', 'หัวหน้าทีมตรวจสภาพรถ'),
('SCRUTINEER_STAFF'::public.role_code, 'Scrutineer Staff', 'เจ้าหน้าที่ตรวจสภาพหน้างาน'),
('OFFSITE_SCRUTINEER'::public.role_code, 'Off-Site Scrutineer Staff', 'เจ้าหน้าที่ตรวจสภาพนอกสถานที่'),
('CHAIRMAN'::public.role_code, 'President', 'ประธาน'),
('STEWARD'::public.role_code, 'Steward', 'กรรมการผู้ตัดสิน'),
('CLERK'::public.role_code, 'Clerk of the course', 'นายสนาม'),
('TEAM_MANAGER'::public.role_code, 'Team Manager', 'ผู้จัดการทีม'),
('COMPETITOR'::public.role_code, 'Competitor', 'นักแข่ง')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

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
    u.id,
    u.id as auth_user_id,
    p.given_name_th as first_name_th,
    p.family_name_th as last_name_th,
    p.given_name_en as first_name_en,
    p.family_name_en as last_name_en,
    coalesce(p.phone, u.phone_number) as phone,
    p.id_or_passport as identity_no,
    null::text as passport_no,
    p.dob::date as date_of_birth,
    p.blood_type,
    p.nationality,
    case
      when p.user_id is null then 'ProfileRequired'
      when exists (
        select 1
        from public.role_assignments ra
        where ra.user_id = u.id
          and ra.role_code = 'TEAM_MANAGER'::public.role_code
      ) and not exists (
        select 1
        from public.teams t
        where t.manager_user_id = u.id
          and t.deleted_at is null
      ) then 'TeamRequired'
      else 'Ready'
    end as onboarding_status
  from public.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = auth.uid()
  limit 1;
$$;

create or replace function public.complete_user_onboarding(
  p_first_name_th text,
  p_last_name_th text,
  p_first_name_en text,
  p_last_name_en text,
  p_phone text,
  p_identity_no text,
  p_passport_no text,
  p_date_of_birth date,
  p_blood_type text,
  p_nationality text,
  p_requested_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role_code public.role_code;
  v_email text;
  v_full_name text;
  v_identity text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_requested_role not in ('Competitor', 'Team Manager') then
    raise exception 'Security Violation: Invalid role.';
  end if;

  v_identity := coalesce(
    nullif(btrim(coalesce(p_identity_no, '')), ''),
    nullif(btrim(coalesce(p_passport_no, '')), '')
  );

  if v_identity is null then
    raise exception 'Identity number or passport number is required.';
  end if;

  v_role_code := case
    when p_requested_role = 'Team Manager' then 'TEAM_MANAGER'::public.role_code
    else 'COMPETITOR'::public.role_code
  end;

  v_email := coalesce(auth.jwt() ->> 'email', '');
  v_full_name := btrim(concat_ws(' ', p_first_name_en, p_last_name_en));

  insert into public.users (
    id,
    email,
    full_name,
    phone_number,
    status,
    auth_provider,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_email,
    v_full_name,
    nullif(btrim(coalesce(p_phone, '')), ''),
    'active'::public.user_status,
    'email'::public.auth_provider,
    now(),
    now()
  )
  on conflict (id) do update set
    email = coalesce(nullif(excluded.email, ''), public.users.email),
    full_name = excluded.full_name,
    phone_number = excluded.phone_number,
    status = 'active'::public.user_status,
    updated_at = now();

  insert into public.profiles (
    user_id,
    given_name_th,
    family_name_th,
    given_name_en,
    family_name_en,
    dob,
    blood_type,
    nationality,
    id_or_passport,
    phone,
    completed_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    btrim(p_first_name_th),
    btrim(p_last_name_th),
    btrim(p_first_name_en),
    btrim(p_last_name_en),
    p_date_of_birth::timestamptz,
    nullif(btrim(coalesce(p_blood_type, '')), ''),
    btrim(p_nationality),
    v_identity,
    nullif(btrim(coalesce(p_phone, '')), ''),
    now(),
    now(),
    now()
  )
  on conflict (user_id) do update set
    given_name_th = excluded.given_name_th,
    family_name_th = excluded.family_name_th,
    given_name_en = excluded.given_name_en,
    family_name_en = excluded.family_name_en,
    dob = excluded.dob,
    blood_type = excluded.blood_type,
    nationality = excluded.nationality,
    id_or_passport = excluded.id_or_passport,
    phone = excluded.phone,
    completed_at = now(),
    updated_at = now();

  insert into public.role_assignments (user_id, role_code)
  values (v_user_id, v_role_code)
  on conflict do nothing;
end;
$$;

revoke all on function public.get_current_onboarding_profile() from public, anon;
revoke all on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) from public, anon;

grant execute on function public.get_current_onboarding_profile() to authenticated;
grant execute on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) to authenticated;
