-- RaceDocV1 Entry Form Phase 4 Part 2 read RPCs.
-- Applied to Supabase as migration: entry_form_profile_and_team_prefill_rpcs_v2
--
-- Purpose:
-- 1. Extend current profile reads with address, postcode, and social fields for Step 2 prefill.
-- 2. Add an authenticated-only team prefill RPC for Step 3.
-- 3. Keep the frontend away from direct profile/team table reads.

drop function if exists public.get_current_onboarding_profile();

create or replace function public.get_current_onboarding_profile()
returns table (
  id uuid,
  auth_user_id uuid,
  first_name_th text,
  last_name_th text,
  first_name_en text,
  last_name_en text,
  phone text,
  identity_no text,
  passport_no text,
  date_of_birth date,
  blood_type text,
  nationality text,
  address text,
  postcode text,
  line_id text,
  instagram text,
  facebook text,
  youtube text,
  tiktok text,
  onboarding_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.id as auth_user_id,
    p.given_name_th as first_name_th,
    p.family_name_th as last_name_th,
    p.given_name_en as first_name_en,
    p.family_name_en as last_name_en,
    coalesce(p.phone, u.phone_number) as phone,
    p.id_or_passport as identity_no,
    null::text as passport_no,
    p.dob::date as date_of_birth,
    p.blood_type,
    p.nationality,
    p.address,
    p.postcode,
    p.line_id,
    p.instagram,
    p.facebook,
    p.youtube,
    p.tiktok,
    case
      when p.user_id is null then 'ProfileRequired'
      when exists (
        select 1
        from public.role_assignments ra
        where ra.user_id = u.id
          and ra.role_code = 'TEAM_MANAGER'::public.role_code
      ) and not exists (
        select 1
        from public.teams t
        where t.manager_user_id = u.id
          and t.deleted_at is null
      ) then 'TeamRequired'
      else 'Ready'
    end as onboarding_status
  from public.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = auth.uid()
  limit 1;
$$;

create or replace function public.get_current_user_team_prefill()
returns table (
  team_id uuid,
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
  select
    t.id as team_id,
    t.name as team_name,
    coalesce(nullif(btrim(u.full_name), ''), btrim(concat_ws(' ', p.given_name_en, p.family_name_en))) as manager_name,
    coalesce(t.phone_number, p.phone, u.phone_number) as manager_phone,
    t.pit_share_request,
    t.address as document_address,
    t.postcode
  from public.teams t
  join public.users u on u.id = t.manager_user_id
  left join public.profiles p on p.user_id = t.manager_user_id
  where t.deleted_at is null
    and (
      t.manager_user_id = auth.uid()
      or exists (
        select 1
        from public.team_relationships tr
        where tr.team_id = t.id
          and tr.competitor_user_id = auth.uid()
          and tr.status = 'active'::public.team_relationship_status
      )
    )
  order by t.created_at desc
  limit 1;
$$;

revoke all on function public.get_current_onboarding_profile() from public, anon;
revoke all on function public.get_current_user_team_prefill() from public, anon;
grant execute on function public.get_current_onboarding_profile() to authenticated;
grant execute on function public.get_current_user_team_prefill() to authenticated;
