-- RaceDocV1 Auth Bootstrap RPC
-- Applied via Supabase MCP on 2026-05-12.
-- Purpose: load Auth user, app profile, roles, and onboarding status in one stable call.

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
    select
      auth.uid() as user_id,
      coalesce(nullif(auth.jwt() ->> 'email', ''), au.email) as email
    from auth.users au
    where au.id = auth.uid()
  ), role_rows as (
    select
      ra.user_id,
      jsonb_agg(ra.role_code::text order by ra.role_code::text) as roles,
      bool_or(ra.role_code in ('ADMIN'::public.role_code, 'SECRETARY'::public.role_code)) as is_admin_or_secretary,
      bool_or(ra.role_code = 'TEAM_MANAGER'::public.role_code) as is_team_manager
    from public.role_assignments ra
    where ra.user_id = auth.uid()
    group by ra.user_id
  ), team_rows as (
    select t.manager_user_id as user_id, true as has_team
    from public.teams t
    where t.manager_user_id = auth.uid()
      and t.deleted_at is null
    limit 1
  )
  select
    ca.user_id as auth_user_id,
    ca.email,
    u.id is not null as app_user_exists,
    u.status::text as app_user_status,
    p.user_id is not null as profile_exists,
    p.completed_at is not null as profile_completed,
    case
      when u.id is null then null::jsonb
      else jsonb_build_object(
        'id', u.id,
        'auth_user_id', u.id,
        'first_name_th', p.given_name_th,
        'last_name_th', p.family_name_th,
        'first_name_en', p.given_name_en,
        'last_name_en', p.family_name_en,
        'phone', coalesce(p.phone, u.phone_number),
        'identity_no', p.id_or_passport,
        'passport_no', null,
        'date_of_birth', p.dob::date,
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
      when u.id is null or p.user_id is null or p.completed_at is null then 'ProfileRequired'
      when coalesce(rr.is_team_manager, false) and tr.has_team is distinct from true then 'TeamRequired'
      else 'Ready'
    end as onboarding_status,
    coalesce(rr.is_admin_or_secretary, false) as is_admin_or_secretary
  from current_auth ca
  left join public.users u on u.id = ca.user_id
  left join public.profiles p on p.user_id = ca.user_id
  left join role_rows rr on rr.user_id = ca.user_id
  left join team_rows tr on tr.user_id = ca.user_id
  where ca.user_id is not null;
$$;

revoke all on function public.get_auth_bootstrap() from public, anon;
grant execute on function public.get_auth_bootstrap() to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
