-- RaceDocV1 Role Invitation Email Audit
-- Purpose: persist the most recent email delivery outcome for Admin visibility.

alter table public.role_invitations
  add column if not exists email_delivery_status text not null default 'NotSent',
  add column if not exists email_last_attempt_at timestamptz,
  add column if not exists email_last_error text;

alter table public.role_invitations
  drop constraint if exists role_invitations_email_delivery_status_check;

alter table public.role_invitations
  add constraint role_invitations_email_delivery_status_check
  check (email_delivery_status in ('NotSent', 'Sent', 'Failed', 'Skipped'));

create or replace function public.get_user_role_management()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with role_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'roleId', r.id,
        'code', r.code,
        'name', r.name,
        'description', r.description
      ) order by r.code
    ), '[]'::jsonb) as roles
    from public.roles r
  ), season_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'seasonId', s.id,
        'name', s.name,
        'year', s.year,
        'isActive', s.is_active
      ) order by s.year desc
    ), '[]'::jsonb) as seasons
    from public.seasons s
  ), invitation_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'invitationId', ri.id,
        'email', ri.email,
        'roleCode', r.code,
        'roleName', r.name,
        'status', ri.status::text,
        'expiresAt', ri.expires_at,
        'createdAt', ri.created_at,
        'emailDeliveryStatus', ri.email_delivery_status,
        'emailLastAttemptAt', ri.email_last_attempt_at,
        'emailLastError', ri.email_last_error,
        'invitedProfileId', ri.invited_profile_id,
        'invitedByName', coalesce(
          nullif(btrim(concat_ws(' ', inviter.first_name_th, inviter.last_name_th)), ''),
          nullif(btrim(concat_ws(' ', inviter.first_name_en, inviter.last_name_en)), ''),
          inviter_auth.email,
          'Admin'
        )
      ) order by ri.created_at desc
    ), '[]'::jsonb) as invitations
    from public.role_invitations ri
    join public.roles r on r.id = ri.role_id
    left join public.profiles inviter on inviter.id = ri.invited_by_id
    left join auth.users inviter_auth on inviter_auth.id = inviter.auth_user_id
  ), user_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'profileId', p.id,
        'authUserId', p.auth_user_id,
        'displayName', coalesce(
          nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''),
          nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''),
          au.email,
          'User'
        ),
        'email', coalesce(au.email, ''),
        'onboardingStatus', p.onboarding_status::text,
        'roles', coalesce(profile_roles.roles, '[]'::jsonb)
      ) order by coalesce(au.email, ''), p.created_at desc
    ), '[]'::jsonb) as users
    from public.profiles p
    left join auth.users au on au.id = p.auth_user_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'userRoleId', ur.id,
          'roleId', r.id,
          'code', r.code,
          'name', r.name,
          'seasonId', ur.season_id,
          'seasonLabel', case when s.id is null then 'Global' else s.name || ' / ' || s.year::text end,
          'isActive', ur.is_active,
          'createdAt', ur.created_at
        ) order by ur.is_active desc, r.code
      ) as roles
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      left join public.seasons s on s.id = ur.season_id
      where ur.profile_id = p.id
    ) profile_roles on true
  )
  select jsonb_build_object(
    'canManage', public.has_role('ADMIN', null),
    'users', case when public.has_role('ADMIN', null) then user_rows.users else '[]'::jsonb end,
    'roles', case when public.has_role('ADMIN', null) then role_rows.roles else '[]'::jsonb end,
    'seasons', case when public.has_role('ADMIN', null) then season_rows.seasons else '[]'::jsonb end,
    'invitations', case when public.has_role('ADMIN', null) then invitation_rows.invitations else '[]'::jsonb end
  )
  from role_rows, season_rows, invitation_rows, user_rows;
$$;

revoke execute on function public.get_user_role_management() from public, anon;
grant execute on function public.get_user_role_management() to authenticated, service_role;
