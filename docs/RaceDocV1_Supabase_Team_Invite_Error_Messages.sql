-- RaceDocV1 Team Invite Error Messages
-- Purpose: make Team Manager / Competitor relationship failures actionable
-- when the target auth account exists but has not completed RaceDoc onboarding.

begin;

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
  v_target_auth_user_id uuid;
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

  select au.id, p.id into v_target_auth_user_id, v_competitor_profile_id
  from auth.users au
  left join public.profiles p on p.auth_user_id = au.id
  where lower(au.email) = lower(btrim(p_competitor_email))
  limit 1;

  if v_target_auth_user_id is null then
    raise exception 'No RaceDoc account was found for that email. Ask the competitor to sign up first.';
  end if;

  if v_competitor_profile_id is null then
    raise exception 'That account exists but has not completed RaceDoc onboarding yet. Ask the competitor to log in, choose Competitor, and complete their profile first.';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = v_competitor_profile_id
      and ur.is_active = true
      and r.code = 'COMPETITOR'
  ) then
    raise exception 'That account is not registered as a Competitor. Only Competitor accounts can be invited to a team.';
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
  v_target_auth_user_id uuid;
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

  select au.id, p.id into v_target_auth_user_id, v_manager_profile_id
  from auth.users au
  left join public.profiles p on p.auth_user_id = au.id
  where lower(au.email) = lower(btrim(p_manager_email))
  limit 1;

  if v_target_auth_user_id is null then
    raise exception 'No RaceDoc account was found for that email. Ask the Team Manager to sign up first.';
  end if;

  if v_manager_profile_id is null then
    raise exception 'That account exists but has not completed RaceDoc onboarding yet. Ask the Team Manager to log in, choose Team Manager, complete their profile, and create Team Info first.';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = v_manager_profile_id
      and ur.is_active = true
      and r.code = 'TEAM_MANAGER'
  ) then
    raise exception 'That account is not registered as a Team Manager.';
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

revoke execute on function public.invite_competitor_to_team(text) from public, anon;
revoke execute on function public.request_team_manager(text) from public, anon;
grant execute on function public.invite_competitor_to_team(text) to authenticated, service_role;
grant execute on function public.request_team_manager(text) to authenticated, service_role;

commit;
