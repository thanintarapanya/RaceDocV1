-- RaceDocV1 onboarding RPC fix
-- Applied via Supabase MCP on 2026-05-12.
-- Purpose: live public.users requires two_factor_enabled; the prior RPC omitted it.
-- Also preserves existing Admin/Secretary roles when completing a profile.

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
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role_code public.role_code;
  v_existing_admin_role boolean;
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

  v_existing_admin_role := exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = v_user_id
      and ra.role_code in ('ADMIN'::public.role_code, 'SECRETARY'::public.role_code)
  );

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

  v_email := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    (select au.email from auth.users au where au.id = v_user_id),
    ''
  );
  v_full_name := btrim(concat_ws(' ', p_first_name_en, p_last_name_en));

  insert into public.users (
    id,
    email,
    full_name,
    phone_number,
    status,
    auth_provider,
    two_factor_enabled,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_email,
    v_full_name,
    nullif(btrim(coalesce(p_phone, '')), ''),
    'active'::public.user_status,
    'email'::public.auth_provider,
    false,
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

  if not v_existing_admin_role then
    insert into public.role_assignments (user_id, role_code)
    values (v_user_id, v_role_code)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) from public, anon;
grant execute on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) to authenticated;
