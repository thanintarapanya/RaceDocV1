-- RaceDocV1 User & Role Management
-- Purpose: minimal Admin-only role assignment for already registered users.

create index if not exists user_roles_profile_active_idx
  on public.user_roles (profile_id, is_active);

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
    'seasons', case when public.has_role('ADMIN', null) then season_rows.seasons else '[]'::jsonb end
  )
  from role_rows, season_rows, user_rows;
$$;

create or replace function public.assign_user_role(
  p_profile_id uuid,
  p_role_code text,
  p_season_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_role_id uuid;
  v_role_code text := upper(btrim(coalesce(p_role_code, '')));
  v_user_role_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can assign user roles.';
  end if;

  select id into v_role_id
  from public.roles
  where code = v_role_code;

  if v_role_id is null then
    raise exception 'Role % is not configured.', v_role_code;
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Profile was not found.';
  end if;

  if p_season_id is not null and not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception 'Season was not found.';
  end if;

  update public.user_roles
  set is_active = true,
      invited_by_id = v_actor_profile_id
  where profile_id = p_profile_id
    and role_id = v_role_id
    and ((season_id is null and p_season_id is null) or season_id = p_season_id)
  returning id into v_user_role_id;

  if v_user_role_id is null then
    insert into public.user_roles (profile_id, role_id, season_id, is_active, invited_by_id)
    values (p_profile_id, v_role_id, p_season_id, true, v_actor_profile_id)
    returning id into v_user_role_id;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values (
    'user_role',
    v_user_role_id,
    'assign',
    jsonb_build_object('profile_id', p_profile_id, 'role_code', v_role_code, 'season_id', p_season_id),
    v_actor_profile_id
  );
end;
$$;

create or replace function public.deactivate_user_role(p_user_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_role public.user_roles%rowtype;
  v_role_code text;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can deactivate user roles.';
  end if;

  select * into v_role
  from public.user_roles
  where id = p_user_role_id
  for update;

  if v_role.id is null then
    raise exception 'User role was not found.';
  end if;

  select code into v_role_code from public.roles where id = v_role.role_id;

  if v_role.profile_id = v_actor_profile_id and v_role_code = 'ADMIN' then
    raise exception 'You cannot deactivate your own Admin role.';
  end if;

  update public.user_roles
  set is_active = false
  where id = p_user_role_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'user_role',
    p_user_role_id,
    'deactivate',
    case when v_role.is_active then 'Active' else 'Inactive' end,
    'Inactive',
    jsonb_build_object('profile_id', v_role.profile_id, 'role_code', v_role_code, 'season_id', v_role.season_id),
    v_actor_profile_id
  );
end;
$$;

revoke execute on function public.get_user_role_management() from public, anon;
revoke execute on function public.assign_user_role(uuid, text, uuid) from public, anon;
revoke execute on function public.deactivate_user_role(uuid) from public, anon;

grant execute on function public.get_user_role_management() to authenticated, service_role;
grant execute on function public.assign_user_role(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.deactivate_user_role(uuid) to authenticated, service_role;
