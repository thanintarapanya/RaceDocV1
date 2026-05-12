-- RaceDocV1 Team Manager onboarding RPC.
-- Purpose: Team Manager accounts must create Team Info before entering the main app.
-- Target project/schema: xmgtuutrqhmrgdgycuhh, live schema using profiles/roles/user_roles/teams.

create or replace function public.complete_team_manager_onboarding(
  p_team_name text,
  p_manager_name text default null,
  p_manager_phone text default null,
  p_address text default null,
  p_postcode text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_organization_id uuid;
  v_team_id uuid;
begin
  if v_profile_id is null then
    raise exception 'Profile required before creating Team Info.';
  end if;

  if not public.has_role('TEAM_MANAGER') then
    raise exception 'Only Team Manager accounts can create Team Info here.';
  end if;

  if nullif(btrim(coalesce(p_team_name, '')), '') is null then
    raise exception 'Team name is required.';
  end if;

  select id into v_organization_id
  from public.organizations
  where slug = 'pt-maxnitron'
  limit 1;

  if v_organization_id is null then
    raise exception 'Organizer is not configured.';
  end if;

  select id into v_team_id
  from public.teams
  where owner_profile_id = v_profile_id
  order by created_at desc
  limit 1;

  if v_team_id is null then
    insert into public.teams (
      organization_id,
      owner_profile_id,
      team_name,
      manager_name,
      manager_phone,
      address,
      postcode
    ) values (
      v_organization_id,
      v_profile_id,
      btrim(p_team_name),
      nullif(btrim(coalesce(p_manager_name, '')), ''),
      nullif(btrim(coalesce(p_manager_phone, '')), ''),
      nullif(btrim(coalesce(p_address, '')), ''),
      nullif(btrim(coalesce(p_postcode, '')), '')
    )
    returning id into v_team_id;
  else
    update public.teams
    set team_name = btrim(p_team_name),
        manager_name = nullif(btrim(coalesce(p_manager_name, '')), ''),
        manager_phone = nullif(btrim(coalesce(p_manager_phone, '')), ''),
        address = nullif(btrim(coalesce(p_address, '')), ''),
        postcode = nullif(btrim(coalesce(p_postcode, '')), '')
    where id = v_team_id;
  end if;

  update public.profiles
  set onboarding_status = 'Ready'::public.onboarding_status,
      updated_at = now()
  where id = v_profile_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values (
    'team',
    v_team_id,
    'complete_team_manager_onboarding',
    jsonb_build_object('team_name', btrim(p_team_name)),
    v_profile_id
  );

  return v_team_id;
end;
$$;

revoke all on function public.complete_team_manager_onboarding(text, text, text, text, text) from public, anon;
grant execute on function public.complete_team_manager_onboarding(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
