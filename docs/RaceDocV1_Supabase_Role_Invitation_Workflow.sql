-- RaceDocV1 Role Invitation Workflow
-- Purpose: allow Admin to pre-authorize official roles by email, then apply
-- the role automatically when that email completes onboarding.

create index if not exists role_invitations_email_status_idx
  on public.role_invitations (lower(email), status);

create index if not exists role_invitations_invited_by_id_idx
  on public.role_invitations (invited_by_id);

create index if not exists role_invitations_invited_profile_id_idx
  on public.role_invitations (invited_profile_id);

create index if not exists role_invitations_role_id_idx
  on public.role_invitations (role_id);

create index if not exists user_roles_invited_by_id_idx
  on public.user_roles (invited_by_id);

create or replace function public.get_pending_role_invitation()
returns table(
  invitation_id uuid,
  email text,
  role_code text,
  role_name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ri.id as invitation_id,
    ri.email,
    r.code as role_code,
    r.name as role_name,
    ri.expires_at
  from auth.users au
  join public.role_invitations ri on lower(ri.email) = lower(au.email)
  join public.roles r on r.id = ri.role_id
  where au.id = auth.uid()
    and ri.status = 'Pending'::public.invitation_status
    and (ri.expires_at is null or ri.expires_at > now())
  order by ri.created_at desc
  limit 1;
$$;

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

create or replace function public.invite_user_role_by_email(
  p_email text,
  p_role_code text,
  p_expires_days integer default 14
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role_code text := upper(btrim(coalesce(p_role_code, '')));
  v_role_id uuid;
  v_existing_profile_id uuid;
  v_invitation_id uuid;
  v_user_role_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can invite official roles.';
  end if;

  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid email is required.';
  end if;

  if v_role_code in ('COMPETITOR', 'TEAM_MANAGER') then
    raise exception 'Competitor and Team Manager roles must be self-selected during onboarding.';
  end if;

  select id into v_role_id
  from public.roles
  where code = v_role_code;

  if v_role_id is null then
    raise exception 'Role % is not configured.', v_role_code;
  end if;

  select p.id into v_existing_profile_id
  from auth.users au
  join public.profiles p on p.auth_user_id = au.id
  where lower(au.email) = v_email
  limit 1;

  select id into v_invitation_id
  from public.role_invitations
  where lower(email) = v_email
    and role_id = v_role_id
    and status = 'Pending'::public.invitation_status
  order by created_at desc
  limit 1;

  if v_invitation_id is null then
    insert into public.role_invitations (
      invited_profile_id,
      invited_by_id,
      role_id,
      email,
      status,
      expires_at,
      created_at
    ) values (
      v_existing_profile_id,
      v_actor_profile_id,
      v_role_id,
      v_email,
      case when v_existing_profile_id is null then 'Pending'::public.invitation_status else 'Accepted'::public.invitation_status end,
      now() + (greatest(coalesce(p_expires_days, 14), 1)::text || ' days')::interval,
      now()
    ) returning id into v_invitation_id;
  else
    update public.role_invitations
    set invited_profile_id = coalesce(invited_profile_id, v_existing_profile_id),
        invited_by_id = v_actor_profile_id,
        expires_at = now() + (greatest(coalesce(p_expires_days, 14), 1)::text || ' days')::interval
    where id = v_invitation_id;
  end if;

  if v_existing_profile_id is not null then
    update public.user_roles
    set is_active = true,
        invited_by_id = v_actor_profile_id
    where profile_id = v_existing_profile_id
      and role_id = v_role_id
      and season_id is null
    returning id into v_user_role_id;

    if v_user_role_id is null then
      insert into public.user_roles (profile_id, role_id, season_id, is_active, invited_by_id)
      values (v_existing_profile_id, v_role_id, null, true, v_actor_profile_id)
      returning id into v_user_role_id;
    end if;

    update public.role_invitations
    set status = 'Accepted'::public.invitation_status,
        invited_profile_id = v_existing_profile_id
    where id = v_invitation_id;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values (
    'role_invitation',
    v_invitation_id,
    case when v_existing_profile_id is null then 'invite_by_email' else 'invite_existing_user_by_email' end,
    jsonb_build_object('email', v_email, 'role_code', v_role_code, 'profile_id', v_existing_profile_id),
    v_actor_profile_id
  );

  return v_invitation_id;
end;
$$;

create or replace function public.cancel_role_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_invitation public.role_invitations%rowtype;
  v_role_code text;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can cancel role invitations.';
  end if;

  select * into v_invitation
  from public.role_invitations
  where id = p_invitation_id
  for update;

  if v_invitation.id is null then
    raise exception 'Role invitation was not found.';
  end if;

  if v_invitation.status <> 'Pending'::public.invitation_status then
    raise exception 'Only pending invitations can be cancelled.';
  end if;

  select code into v_role_code from public.roles where id = v_invitation.role_id;

  update public.role_invitations
  set status = 'Cancelled'::public.invitation_status
  where id = p_invitation_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'role_invitation',
    p_invitation_id,
    'cancel',
    'Pending',
    'Cancelled',
    jsonb_build_object('email', v_invitation.email, 'role_code', v_role_code),
    v_actor_profile_id
  );
end;
$$;

create or replace function public.complete_user_onboarding(
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
  v_user_email text;
  v_profile_id uuid;
  v_role_code text;
  v_role_id uuid;
  v_requested_role text := nullif(btrim(coalesce(p_requested_role, '')), '');
  v_has_elevated_role boolean;
  v_has_pending_role_invitation boolean;
  v_invitation record;
  v_user_role_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into v_user_email
  from auth.users
  where id = v_user_id;

  select exists (
    select 1
    from public.role_invitations ri
    where lower(ri.email) = v_user_email
      and ri.status = 'Pending'::public.invitation_status
      and (ri.expires_at is null or ri.expires_at > now())
  ) into v_has_pending_role_invitation;

  if v_requested_role is null and not v_has_pending_role_invitation then
    raise exception 'Security Violation: Invalid role.';
  end if;

  if v_requested_role is not null and v_requested_role not in ('Competitor', 'Team Manager') then
    raise exception 'Security Violation: Invalid role.';
  end if;

  if nullif(btrim(coalesce(p_identity_no, '')), '') is null
     and nullif(btrim(coalesce(p_passport_no, '')), '') is null then
    raise exception 'Identity number or passport number is required.';
  end if;

  v_role_code := case
    when v_requested_role = 'Team Manager' then 'TEAM_MANAGER'
    when v_requested_role = 'Competitor' then 'COMPETITOR'
    else null
  end;

  if v_role_code is not null then
    select id into v_role_id from public.roles where code = v_role_code;

    if v_role_id is null then
      raise exception 'Role % is not configured.', v_role_code;
    end if;
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
    case when v_role_code = 'TEAM_MANAGER' then 'TeamRequired'::public.onboarding_status else 'Ready'::public.onboarding_status end,
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

  for v_invitation in
    select ri.id, ri.role_id, r.code as role_code, ri.invited_by_id
    from public.role_invitations ri
    join public.roles r on r.id = ri.role_id
    where lower(ri.email) = v_user_email
      and ri.status = 'Pending'::public.invitation_status
      and (ri.expires_at is null or ri.expires_at > now())
  loop
    update public.user_roles
    set is_active = true,
        invited_by_id = coalesce(v_invitation.invited_by_id, invited_by_id)
    where profile_id = v_profile_id
      and role_id = v_invitation.role_id
      and season_id is null
    returning id into v_user_role_id;

    if v_user_role_id is null then
      insert into public.user_roles (profile_id, role_id, season_id, is_active, invited_by_id)
      values (v_profile_id, v_invitation.role_id, null, true, v_invitation.invited_by_id)
      returning id into v_user_role_id;
    end if;

    update public.role_invitations
    set status = 'Accepted'::public.invitation_status,
        invited_profile_id = v_profile_id
    where id = v_invitation.id;

    insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
    values (
      'role_invitation',
      v_invitation.id,
      'accept_on_onboarding',
      'Pending',
      'Accepted',
      jsonb_build_object('profile_id', v_profile_id, 'role_code', v_invitation.role_code, 'user_role_id', v_user_role_id),
      v_profile_id
    );
  end loop;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = v_profile_id
      and ur.is_active = true
      and r.code not in ('COMPETITOR', 'TEAM_MANAGER')
  ) into v_has_elevated_role;

  if not v_has_elevated_role and v_role_id is not null then
    insert into public.user_roles (profile_id, role_id, is_active)
    values (v_profile_id, v_role_id, true)
    on conflict do nothing;
  end if;
end;
$$;

revoke execute on function public.get_pending_role_invitation() from public, anon;
revoke execute on function public.get_user_role_management() from public, anon;
revoke execute on function public.invite_user_role_by_email(text, text, integer) from public, anon;
revoke execute on function public.cancel_role_invitation(uuid) from public, anon;
revoke execute on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) from public, anon;

grant execute on function public.get_pending_role_invitation() to authenticated, service_role;
grant execute on function public.get_user_role_management() to authenticated, service_role;
grant execute on function public.invite_user_role_by_email(text, text, integer) to authenticated, service_role;
grant execute on function public.cancel_role_invitation(uuid) to authenticated, service_role;
grant execute on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) to authenticated, service_role;
