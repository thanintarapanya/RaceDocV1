-- RaceDocV1 temporary demo Admin user
-- Applied via Supabase MCP on 2026-05-12.
-- Login: admin@rd.local
-- Temporary password: Admin123!
-- Remove or rotate this account after local approval workflow testing.

do $$
declare
  v_user_id uuid;
  v_email text := 'admin@rd.local';
  v_password text := 'Admin123!';
begin
  select id into v_user_id
  from auth.users
  where email = v_email
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', 'RaceDoc Admin'),
      now(),
      now(),
      null,
      null,
      false,
      false
    );

    insert into auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at,
      id
    ) values (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now(),
      gen_random_uuid()
    );
  else
    update auth.users
    set
      encrypted_password = crypt(v_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', array['email']),
      updated_at = now(),
      deleted_at = null,
      banned_until = null
    where id = v_user_id;

    insert into auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at,
      id
    ) values (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now(),
      gen_random_uuid()
    ) on conflict (provider_id, provider) do update set
      identity_data = excluded.identity_data,
      updated_at = now();
  end if;

  insert into public.users (
    id,
    email,
    email_verified_at,
    auth_provider,
    full_name,
    status,
    two_factor_enabled
  ) values (
    v_user_id,
    v_email,
    now(),
    'email'::public.auth_provider,
    'RaceDoc Admin',
    'active'::public.user_status,
    false
  ) on conflict (id) do update set
    email = excluded.email,
    email_verified_at = coalesce(public.users.email_verified_at, now()),
    auth_provider = 'email'::public.auth_provider,
    full_name = excluded.full_name,
    status = 'active'::public.user_status,
    updated_at = now();

  insert into public.profiles (
    user_id,
    given_name_th,
    family_name_th,
    given_name_en,
    family_name_en,
    phone,
    completed_at
  ) values (
    v_user_id,
    'แอดมิน',
    'ระบบ',
    'RaceDoc',
    'Admin',
    '0000000000',
    now()
  ) on conflict (user_id) do update set
    given_name_th = excluded.given_name_th,
    family_name_th = excluded.family_name_th,
    given_name_en = excluded.given_name_en,
    family_name_en = excluded.family_name_en,
    phone = excluded.phone,
    completed_at = coalesce(public.profiles.completed_at, now()),
    updated_at = now();

  insert into public.role_assignments (user_id, role_code, assigned_by_id)
  values (v_user_id, 'ADMIN'::public.role_code, v_user_id)
  on conflict (user_id, role_code, scope_event_id) do update set
    assigned_by_id = excluded.assigned_by_id,
    updated_at = now();
end $$;
