-- RaceDocV1 Team Prefill Accepted Membership
-- Purpose: when a competitor has accepted a Team Manager relationship,
-- Entry Form Step 3 should prefill that manager's team details.

begin;

drop function if exists public.get_current_user_team_prefill();

create or replace function public.get_current_user_team_prefill()
returns table(
  id uuid,
  team_name text,
  manager_name text,
  manager_phone text,
  pit_share_request text,
  document_address text,
  postcode text
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select public.current_profile_id() as profile_id
  ), active_season as (
    select id
    from public.seasons
    where is_active = true
    order by year desc
    limit 1
  ), owned_team as (
    select t.*, 1 as priority
    from public.teams t, ctx
    where t.owner_profile_id = ctx.profile_id
    order by t.created_at desc
    limit 1
  ), accepted_team as (
    select t.*, 2 as priority
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    join active_season s on s.id = tm.season_id
    join ctx on ctx.profile_id = tm.competitor_profile_id
    where tm.status = 'Accepted'::public.invitation_status
      and tm.revoked_at is null
    order by tm.accepted_at desc
    limit 1
  ), selected_team as (
    select * from owned_team
    union all
    select * from accepted_team
    order by priority
    limit 1
  )
  select
    st.id,
    st.team_name,
    st.manager_name,
    st.manager_phone,
    null::text as pit_share_request,
    st.address as document_address,
    st.postcode
  from selected_team st;
$$;

revoke execute on function public.get_current_user_team_prefill() from public, anon;
grant execute on function public.get_current_user_team_prefill() to authenticated, service_role;

commit;
