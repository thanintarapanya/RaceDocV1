-- RaceDocV1 Team Relationship Workflow
-- Purpose: support Team Manager -> Competitor invitations and
-- Competitor -> Team Manager requests using the existing relationship tables.

begin;

-- One competitor should only have one active team manager relationship per season.
create unique index if not exists team_memberships_active_competitor_one_team_uk
  on public.team_memberships (season_id, competitor_profile_id)
  where status = 'Accepted'::public.invitation_status
    and revoked_at is null;

create or replace function public.get_current_team_relationships()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.current_profile_id() as profile_id,
      public.has_role('TEAM_MANAGER', null) as is_team_manager,
      public.has_role('COMPETITOR', null) as is_competitor
  ), my_team as (
    select t.*
    from public.teams t, ctx
    where t.owner_profile_id = ctx.profile_id
    order by t.created_at desc
    limit 1
  ), visible_memberships as (
    select
      tm.id,
      tm.team_id,
      tm.season_id,
      tm.competitor_profile_id,
      tm.accepted_at,
      tm.revoked_at,
      tm.status,
      t.team_name,
      t.manager_name,
      s.name as season_name,
      p.first_name_th,
      p.last_name_th,
      p.first_name_en,
      p.last_name_en,
      au.email as competitor_email
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    join public.seasons s on s.id = tm.season_id
    join public.profiles p on p.id = tm.competitor_profile_id
    left join auth.users au on au.id = p.auth_user_id
    cross join ctx
    where tm.status = 'Accepted'::public.invitation_status
      and tm.revoked_at is null
      and (
        t.owner_profile_id = ctx.profile_id
        or tm.competitor_profile_id = ctx.profile_id
      )
  ), visible_invitations as (
    select
      ti.id,
      ti.team_id,
      ti.season_id,
      ti.competitor_profile_id,
      ti.invite_direction,
      ti.status,
      ti.expires_at,
      ti.created_at,
      t.team_name,
      t.manager_name,
      s.name as season_name,
      p.first_name_th,
      p.last_name_th,
      p.first_name_en,
      p.last_name_en,
      au.email as competitor_email
    from public.team_invitations ti
    join public.teams t on t.id = ti.team_id
    join public.seasons s on s.id = ti.season_id
    join public.profiles p on p.id = ti.competitor_profile_id
    left join auth.users au on au.id = p.auth_user_id
    cross join ctx
    where ti.status = 'Pending'::public.invitation_status
      and (ti.expires_at is null or ti.expires_at > now())
      and (
        t.owner_profile_id = ctx.profile_id
        or ti.competitor_profile_id = ctx.profile_id
      )
  )
  select jsonb_build_object(
    'isTeamManager', ctx.is_team_manager,
    'isCompetitor', ctx.is_competitor,
    'myTeam', (
      select jsonb_build_object(
        'id', mt.id,
        'teamName', mt.team_name,
        'managerName', mt.manager_name,
        'managerPhone', mt.manager_phone,
        'address', mt.address,
        'postcode', mt.postcode
      )
      from my_team mt
    ),
    'activeMemberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', vm.id,
        'teamId', vm.team_id,
        'teamName', vm.team_name,
        'managerName', vm.manager_name,
        'seasonId', vm.season_id,
        'seasonName', vm.season_name,
        'competitorProfileId', vm.competitor_profile_id,
        'competitorName', nullif(btrim(concat_ws(' ', vm.first_name_th, vm.last_name_th)), ''),
        'competitorNameEn', nullif(btrim(concat_ws(' ', vm.first_name_en, vm.last_name_en)), ''),
        'competitorEmail', vm.competitor_email,
        'acceptedAt', vm.accepted_at
      ) order by vm.accepted_at desc)
      from visible_memberships vm
    ), '[]'::jsonb),
    'pendingReceived', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', vi.id,
        'teamId', vi.team_id,
        'teamName', vi.team_name,
        'managerName', vi.manager_name,
        'seasonId', vi.season_id,
        'seasonName', vi.season_name,
        'competitorProfileId', vi.competitor_profile_id,
        'competitorName', nullif(btrim(concat_ws(' ', vi.first_name_th, vi.last_name_th)), ''),
        'competitorNameEn', nullif(btrim(concat_ws(' ', vi.first_name_en, vi.last_name_en)), ''),
        'competitorEmail', vi.competitor_email,
        'direction', vi.invite_direction,
        'status', vi.status,
        'expiresAt', vi.expires_at,
        'createdAt', vi.created_at
      ) order by vi.created_at desc)
      from visible_invitations vi, ctx c
      where (c.is_competitor and vi.competitor_profile_id = c.profile_id and vi.invite_direction = 'ManagerToCompetitor'::public.invite_direction)
         or (c.is_team_manager and vi.invite_direction = 'CompetitorToManager'::public.invite_direction)
    ), '[]'::jsonb),
    'pendingSent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', vi.id,
        'teamId', vi.team_id,
        'teamName', vi.team_name,
        'managerName', vi.manager_name,
        'seasonId', vi.season_id,
        'seasonName', vi.season_name,
        'competitorProfileId', vi.competitor_profile_id,
        'competitorName', nullif(btrim(concat_ws(' ', vi.first_name_th, vi.last_name_th)), ''),
        'competitorNameEn', nullif(btrim(concat_ws(' ', vi.first_name_en, vi.last_name_en)), ''),
        'competitorEmail', vi.competitor_email,
        'direction', vi.invite_direction,
        'status', vi.status,
        'expiresAt', vi.expires_at,
        'createdAt', vi.created_at
      ) order by vi.created_at desc)
      from visible_invitations vi, ctx c
      where (c.is_competitor and vi.competitor_profile_id = c.profile_id and vi.invite_direction = 'CompetitorToManager'::public.invite_direction)
         or (c.is_team_manager and vi.invite_direction = 'ManagerToCompetitor'::public.invite_direction)
    ), '[]'::jsonb)
  )
  from ctx;
$$;

create or replace function public.invite_competitor_to_team(p_competitor_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_team_id uuid;
  v_season_id uuid;
  v_competitor_profile_id uuid;
  v_invitation_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('TEAM_MANAGER', null) then
    raise exception 'Only Team Manager accounts can invite competitors.';
  end if;

  if nullif(btrim(coalesce(p_competitor_email, '')), '') is null then
    raise exception 'Competitor email is required.';
  end if;

  select id into v_team_id
  from public.teams
  where owner_profile_id = v_actor_profile_id
  order by created_at desc
  limit 1;

  if v_team_id is null then
    raise exception 'Create Team Info before inviting competitors.';
  end if;

  select id into v_season_id
  from public.seasons
  where is_active = true
  order by year desc
  limit 1;

  if v_season_id is null then
    raise exception 'Active season is not configured.';
  end if;

  select p.id into v_competitor_profile_id
  from auth.users au
  join public.profiles p on p.auth_user_id = au.id
  where lower(au.email) = lower(btrim(p_competitor_email))
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.profile_id = p.id
        and ur.is_active = true
        and r.code = 'COMPETITOR'
    )
  limit 1;

  if v_competitor_profile_id is null then
    raise exception 'No competitor account was found for that email.';
  end if;

  if exists (
    select 1
    from public.team_memberships tm
    where tm.season_id = v_season_id
      and tm.competitor_profile_id = v_competitor_profile_id
      and tm.status = 'Accepted'::public.invitation_status
      and tm.revoked_at is null
  ) then
    raise exception 'This competitor already has an active team manager for the current season.';
  end if;

  select id into v_invitation_id
  from public.team_invitations
  where team_id = v_team_id
    and season_id = v_season_id
    and competitor_profile_id = v_competitor_profile_id
    and invite_direction = 'ManagerToCompetitor'::public.invite_direction
    and status = 'Pending'::public.invitation_status
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_invitation_id is null then
    insert into public.team_invitations (
      team_id,
      season_id,
      competitor_profile_id,
      invite_direction,
      status,
      expires_at
    ) values (
      v_team_id,
      v_season_id,
      v_competitor_profile_id,
      'ManagerToCompetitor'::public.invite_direction,
      'Pending'::public.invitation_status,
      now() + interval '14 days'
    ) returning id into v_invitation_id;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values (
    'team_invitation',
    v_invitation_id,
    'invite_competitor_to_team',
    jsonb_build_object('team_id', v_team_id, 'competitor_profile_id', v_competitor_profile_id),
    v_actor_profile_id
  );

  return v_invitation_id;
end;
$$;

create or replace function public.request_team_manager(p_manager_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_team_id uuid;
  v_manager_profile_id uuid;
  v_season_id uuid;
  v_invitation_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('COMPETITOR', null) then
    raise exception 'Only Competitor accounts can request a Team Manager.';
  end if;

  if nullif(btrim(coalesce(p_manager_email, '')), '') is null then
    raise exception 'Team Manager email is required.';
  end if;

  select id into v_season_id
  from public.seasons
  where is_active = true
  order by year desc
  limit 1;

  if v_season_id is null then
    raise exception 'Active season is not configured.';
  end if;

  if exists (
    select 1
    from public.team_memberships tm
    where tm.season_id = v_season_id
      and tm.competitor_profile_id = v_actor_profile_id
      and tm.status = 'Accepted'::public.invitation_status
      and tm.revoked_at is null
  ) then
    raise exception 'You already have an active Team Manager for the current season.';
  end if;

  select p.id into v_manager_profile_id
  from auth.users au
  join public.profiles p on p.auth_user_id = au.id
  where lower(au.email) = lower(btrim(p_manager_email))
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.profile_id = p.id
        and ur.is_active = true
        and r.code = 'TEAM_MANAGER'
    )
  limit 1;

  if v_manager_profile_id is null then
    raise exception 'No Team Manager account was found for that email.';
  end if;

  select id into v_team_id
  from public.teams
  where owner_profile_id = v_manager_profile_id
  order by created_at desc
  limit 1;

  if v_team_id is null then
    raise exception 'That Team Manager has not created Team Info yet.';
  end if;

  select id into v_invitation_id
  from public.team_invitations
  where team_id = v_team_id
    and season_id = v_season_id
    and competitor_profile_id = v_actor_profile_id
    and invite_direction = 'CompetitorToManager'::public.invite_direction
    and status = 'Pending'::public.invitation_status
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_invitation_id is null then
    insert into public.team_invitations (
      team_id,
      season_id,
      competitor_profile_id,
      invite_direction,
      status,
      expires_at
    ) values (
      v_team_id,
      v_season_id,
      v_actor_profile_id,
      'CompetitorToManager'::public.invite_direction,
      'Pending'::public.invitation_status,
      now() + interval '14 days'
    ) returning id into v_invitation_id;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values (
    'team_invitation',
    v_invitation_id,
    'request_team_manager',
    jsonb_build_object('team_id', v_team_id, 'competitor_profile_id', v_actor_profile_id),
    v_actor_profile_id
  );

  return v_invitation_id;
end;
$$;

create or replace function public.respond_team_invitation(p_invitation_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_invitation public.team_invitations%rowtype;
  v_team_owner_profile_id uuid;
  v_membership_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_invitation
  from public.team_invitations
  where id = p_invitation_id
  for update;

  if v_invitation.id is null then
    raise exception 'Invitation was not found.';
  end if;

  if v_invitation.status <> 'Pending'::public.invitation_status then
    raise exception 'Invitation is no longer pending.';
  end if;

  if v_invitation.expires_at is not null and v_invitation.expires_at <= now() then
    update public.team_invitations
    set status = 'Expired'::public.invitation_status
    where id = p_invitation_id;
    raise exception 'Invitation has expired.';
  end if;

  select owner_profile_id into v_team_owner_profile_id
  from public.teams
  where id = v_invitation.team_id;

  if v_invitation.invite_direction = 'ManagerToCompetitor'::public.invite_direction
     and v_invitation.competitor_profile_id <> v_actor_profile_id then
    raise exception 'Only the invited competitor can respond to this invitation.';
  end if;

  if v_invitation.invite_direction = 'CompetitorToManager'::public.invite_direction
     and v_team_owner_profile_id <> v_actor_profile_id then
    raise exception 'Only the requested Team Manager can respond to this request.';
  end if;

  if not p_accept then
    update public.team_invitations
    set status = 'Rejected'::public.invitation_status
    where id = p_invitation_id;

    insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, action_by_id)
    values ('team_invitation', p_invitation_id, 'reject', 'Pending', 'Rejected', v_actor_profile_id);

    return null;
  end if;

  if exists (
    select 1
    from public.team_memberships tm
    where tm.season_id = v_invitation.season_id
      and tm.competitor_profile_id = v_invitation.competitor_profile_id
      and tm.status = 'Accepted'::public.invitation_status
      and tm.revoked_at is null
  ) then
    raise exception 'Competitor already has an active Team Manager for this season.';
  end if;

  insert into public.team_memberships (
    team_id,
    season_id,
    competitor_profile_id,
    status,
    accepted_at,
    created_by_id
  ) values (
    v_invitation.team_id,
    v_invitation.season_id,
    v_invitation.competitor_profile_id,
    'Accepted'::public.invitation_status,
    now(),
    v_actor_profile_id
  ) returning id into v_membership_id;

  update public.team_invitations
  set status = 'Accepted'::public.invitation_status
  where id = p_invitation_id;

  update public.team_invitations
  set status = 'Cancelled'::public.invitation_status
  where id <> p_invitation_id
    and season_id = v_invitation.season_id
    and competitor_profile_id = v_invitation.competitor_profile_id
    and status = 'Pending'::public.invitation_status;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, action_by_id)
  values ('team_invitation', p_invitation_id, 'accept', 'Pending', 'Accepted', v_actor_profile_id);

  insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
  values (
    'team_membership',
    v_membership_id,
    'create_from_invitation',
    jsonb_build_object('team_id', v_invitation.team_id, 'competitor_profile_id', v_invitation.competitor_profile_id),
    'Accepted',
    v_actor_profile_id
  );

  return v_membership_id;
end;
$$;

create or replace function public.cancel_team_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_invitation public.team_invitations%rowtype;
  v_team_owner_profile_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_invitation
  from public.team_invitations
  where id = p_invitation_id
  for update;

  if v_invitation.id is null then
    raise exception 'Invitation was not found.';
  end if;

  if v_invitation.status <> 'Pending'::public.invitation_status then
    raise exception 'Only pending invitations can be cancelled.';
  end if;

  select owner_profile_id into v_team_owner_profile_id
  from public.teams
  where id = v_invitation.team_id;

  if not (
    (v_invitation.invite_direction = 'ManagerToCompetitor'::public.invite_direction and v_team_owner_profile_id = v_actor_profile_id)
    or (v_invitation.invite_direction = 'CompetitorToManager'::public.invite_direction and v_invitation.competitor_profile_id = v_actor_profile_id)
  ) then
    raise exception 'Only the requester can cancel this pending request.';
  end if;

  update public.team_invitations
  set status = 'Cancelled'::public.invitation_status
  where id = p_invitation_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, action_by_id)
  values ('team_invitation', p_invitation_id, 'cancel', 'Pending', 'Cancelled', v_actor_profile_id);
end;
$$;

create or replace function public.revoke_team_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_membership public.team_memberships%rowtype;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_membership
  from public.team_memberships
  where id = p_membership_id
  for update;

  if v_membership.id is null then
    raise exception 'Team relationship was not found.';
  end if;

  if v_membership.competitor_profile_id <> v_actor_profile_id then
    raise exception 'Only the competitor can revoke a Team Manager relationship.';
  end if;

  if v_membership.revoked_at is not null then
    return;
  end if;

  update public.team_memberships
  set status = 'Revoked'::public.invitation_status,
      revoked_at = now()
  where id = p_membership_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, action_by_id)
  values ('team_membership', p_membership_id, 'revoke', 'Accepted', 'Revoked', v_actor_profile_id);
end;
$$;

revoke execute on function public.get_current_team_relationships() from public, anon;
revoke execute on function public.invite_competitor_to_team(text) from public, anon;
revoke execute on function public.request_team_manager(text) from public, anon;
revoke execute on function public.respond_team_invitation(uuid, boolean) from public, anon;
revoke execute on function public.cancel_team_invitation(uuid) from public, anon;
revoke execute on function public.revoke_team_membership(uuid) from public, anon;

grant execute on function public.get_current_team_relationships() to authenticated, service_role;
grant execute on function public.invite_competitor_to_team(text) to authenticated, service_role;
grant execute on function public.request_team_manager(text) to authenticated, service_role;
grant execute on function public.respond_team_invitation(uuid, boolean) to authenticated, service_role;
grant execute on function public.cancel_team_invitation(uuid) to authenticated, service_role;
grant execute on function public.revoke_team_membership(uuid) to authenticated, service_role;

commit;
