-- RaceDocV1 Assign Admin Role
-- Purpose: grant global Admin role to tartib.thanintarapanya@gmail.com
-- without removing the existing Competitor role.

begin;

with target_profile as (
  select p.id as profile_id
  from auth.users au
  join public.profiles p on p.auth_user_id = au.id
  where lower(au.email) = lower('tartib.thanintarapanya@gmail.com')
  limit 1
), admin_role as (
  select id as role_id
  from public.roles
  where code = 'ADMIN'
  limit 1
), inserted_role as (
  insert into public.user_roles (profile_id, role_id, season_id, is_active)
  select tp.profile_id, ar.role_id, null, true
  from target_profile tp
  cross join admin_role ar
  where not exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = tp.profile_id
      and ur.role_id = ar.role_id
      and ur.season_id is null
  )
  returning id, profile_id
), reactivated_role as (
  update public.user_roles ur
  set is_active = true
  from target_profile tp, admin_role ar
  where ur.profile_id = tp.profile_id
    and ur.role_id = ar.role_id
    and ur.season_id is null
    and ur.is_active = false
  returning ur.id, ur.profile_id
), changed as (
  select * from inserted_role
  union all
  select * from reactivated_role
)
insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
select
  'user_role',
  c.id,
  'grant_admin_role',
  jsonb_build_object('email', 'tartib.thanintarapanya@gmail.com', 'role', 'ADMIN'),
  c.profile_id
from changed c;

commit;
