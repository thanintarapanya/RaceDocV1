-- RaceDocV1 Profile Settings
-- Purpose: self-service profile read/save RPCs for Settings > Profile.
-- Apply after RaceDocV1_Supabase_New_Project_Bootstrap.sql.

create or replace function public.get_profile_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'authUserId', p.auth_user_id,
      'firstNameTh', p.first_name_th,
      'lastNameTh', p.last_name_th,
      'firstNameEn', p.first_name_en,
      'lastNameEn', p.last_name_en,
      'phone', p.phone,
      'identityNo', p.identity_no,
      'passportNo', p.passport_no,
      'dateOfBirth', p.date_of_birth,
      'bloodType', p.blood_type,
      'nationality', p.nationality,
      'address', p.address,
      'postcode', p.postcode,
      'lineId', p.line_id,
      'facebook', p.facebook,
      'instagram', p.instagram,
      'youtube', p.youtube,
      'tiktok', p.tiktok,
      'onboardingStatus', p.onboarding_status::text,
      'createdAt', p.created_at,
      'updatedAt', p.updated_at
    ),
    'roles', coalesce(role_rows.roles, '[]'::jsonb)
  )
  from public.profiles p
  left join lateral (
    select jsonb_agg(r.code::text order by r.code) as roles
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = p.id
      and ur.is_active = true
  ) role_rows on true
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.save_profile_settings(
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
  p_address text default null,
  p_postcode text default null,
  p_line_id text default null,
  p_facebook text default null,
  p_instagram text default null,
  p_youtube text default null,
  p_tiktok text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_existing public.profiles%rowtype;
  v_result jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_existing
  from public.profiles
  where id = v_actor_profile_id
  for update;

  if v_existing.id is null then
    raise exception 'Profile was not found.';
  end if;

  if nullif(btrim(coalesce(p_identity_no, '')), '') is null
     and nullif(btrim(coalesce(p_passport_no, '')), '') is null then
    raise exception 'Identity number or passport number is required.';
  end if;

  update public.profiles
  set first_name_th = nullif(btrim(coalesce(p_first_name_th, '')), ''),
      last_name_th = nullif(btrim(coalesce(p_last_name_th, '')), ''),
      first_name_en = nullif(btrim(coalesce(p_first_name_en, '')), ''),
      last_name_en = nullif(btrim(coalesce(p_last_name_en, '')), ''),
      phone = nullif(btrim(coalesce(p_phone, '')), ''),
      identity_no = nullif(btrim(coalesce(p_identity_no, '')), ''),
      passport_no = nullif(btrim(coalesce(p_passport_no, '')), ''),
      date_of_birth = p_date_of_birth,
      blood_type = nullif(btrim(coalesce(p_blood_type, '')), ''),
      nationality = nullif(btrim(coalesce(p_nationality, '')), ''),
      address = nullif(btrim(coalesce(p_address, '')), ''),
      postcode = nullif(btrim(coalesce(p_postcode, '')), ''),
      line_id = nullif(btrim(coalesce(p_line_id, '')), ''),
      facebook = nullif(btrim(coalesce(p_facebook, '')), ''),
      instagram = nullif(btrim(coalesce(p_instagram, '')), ''),
      youtube = nullif(btrim(coalesce(p_youtube, '')), ''),
      tiktok = nullif(btrim(coalesce(p_tiktok, '')), ''),
      updated_at = now()
  where id = v_actor_profile_id;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values (
    'profile',
    v_actor_profile_id,
    'profile_settings_update',
    to_jsonb(v_existing) - 'identity_no' - 'passport_no',
    jsonb_build_object('updatedAt', now()),
    v_actor_profile_id
  );

  select public.get_profile_settings() into v_result;
  return v_result;
end;
$$;

revoke execute on function public.get_profile_settings() from public, anon;
revoke execute on function public.save_profile_settings(text, text, text, text, text, text, text, date, text, text, text, text, text, text, text, text, text) from public, anon;

grant execute on function public.get_profile_settings() to authenticated, service_role;
grant execute on function public.save_profile_settings(text, text, text, text, text, text, text, date, text, text, text, text, text, text, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
