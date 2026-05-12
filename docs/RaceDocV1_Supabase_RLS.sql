-- =========================================================
-- RaceDocV1 Row Level Security
-- Phase: RLS
-- Scope: Helper functions, ENABLE RLS, policies
-- Requires: RaceDocV1_Supabase_Base_Schema.sql
-- =========================================================

begin;

-- =========================================================
-- 1. SECURITY DEFINER helper functions
-- =========================================================

create or replace function public.rls_role_key(role_code text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(role_code, '')), '[^a-z0-9]+', '', 'g');
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_role(role_code text, season_scope uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = public.current_profile_id()
      and ur.is_active = true
      and public.rls_role_key(r.code) = public.rls_role_key(role_code)
      and (
        season_scope is null
        or ur.season_id is null
        or ur.season_id = season_scope
      )
  );
$$;

create or replace function public.has_any_role(role_codes text[], season_scope uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from unnest(role_codes) as requested_role(role_code)
    where public.has_role(requested_role.role_code, season_scope)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('Admin');
$$;

create or replace function public.is_secretary()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('Secretary');
$$;

create or replace function public.is_scrutineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array[
    'Head Scrutineer',
    'Scrutineer Staff',
    'Off-Site Scrutineer Staff'
  ]);
$$;

create or replace function public.is_head_scrutineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('Head Scrutineer');
$$;

create or replace function public.is_official()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array[
    'Admin',
    'Secretary',
    'Head Scrutineer',
    'Scrutineer Staff',
    'Off-Site Scrutineer Staff',
    'President',
    'Steward',
    'Clerk of the course'
  ]);
$$;

create or replace function public.is_committee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array[
    'President',
    'Steward',
    'Clerk of the course',
    'Head Scrutineer'
  ]);
$$;

create or replace function public.is_authority_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array[
    'Secretary',
    'President',
    'Steward',
    'Clerk of the course'
  ]);
$$;

create or replace function public.is_race_result_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('Steward');
$$;

create or replace function public.is_team_owner(team_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = team_uuid
      and t.owner_profile_id = public.current_profile_id()
  );
$$;

create or replace function public.can_manage_competitor(competitor_uuid uuid, season_scope uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    competitor_uuid = public.current_profile_id()
    or exists (
      select 1
      from public.team_memberships tm
      join public.teams t on t.id = tm.team_id
      where tm.competitor_profile_id = competitor_uuid
        and tm.status = 'Accepted'::public.invitation_status
        and tm.revoked_at is null
        and t.owner_profile_id = public.current_profile_id()
        and (
          season_scope is null
          or tm.season_id = season_scope
        )
    );
$$;

create or replace function public.can_access_team(team_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_team_owner(team_uuid)
    or exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = team_uuid
        and tm.competitor_profile_id = public.current_profile_id()
        and tm.status = 'Accepted'::public.invitation_status
        and tm.revoked_at is null
    );
$$;

create or replace function public.can_access_entry_form(entry_form_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entry_forms ef
    where ef.id = entry_form_uuid
      and public.can_manage_competitor(ef.competitor_profile_id, ef.season_id)
  );
$$;

create or replace function public.can_access_inspection_form(inspection_form_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inspection_forms inf
    where inf.id = inspection_form_uuid
      and public.can_access_entry_form(inf.entry_form_id)
  );
$$;

create or replace function public.can_access_inspection_version(inspection_version_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inspection_form_versions ifv
    where ifv.id = inspection_version_uuid
      and public.can_access_inspection_form(ifv.inspection_form_id)
  );
$$;

create or replace function public.can_access_competitor_request(request_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.competitor_requests cr
    where cr.id = request_uuid
      and (
        cr.requester_profile_id = public.current_profile_id()
        or cr.submitted_by_id = public.current_profile_id()
        or public.can_access_entry_form(cr.entry_form_id)
        or exists (
          select 1
          from public.request_approvals ra
          where ra.competitor_request_id = cr.id
            and ra.approver_profile_id = public.current_profile_id()
        )
      )
  );
$$;

create or replace function public.can_access_file_asset(file_asset_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.file_assets fa
    where fa.id = file_asset_uuid
      and fa.uploaded_by_id = public.current_profile_id()
  )
  or exists (
    select 1
    from public.entry_form_documents efd
    where efd.file_asset_id = file_asset_uuid
      and public.can_access_entry_form(efd.entry_form_id)
  )
  or exists (
    select 1
    from public.competitor_request_documents crd
    where crd.file_asset_id = file_asset_uuid
      and public.can_access_competitor_request(crd.competitor_request_id)
  )
  or exists (
    select 1
    from public.competitor_requests cr
    where cr.payment_receipt_id = file_asset_uuid
      and public.can_access_competitor_request(cr.id)
  );
$$;

create or replace function public.can_access_weigh_in_log(weigh_in_log_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.weigh_in_logs wil
    where wil.id = weigh_in_log_uuid
      and public.can_access_entry_form(wil.entry_form_id)
  );
$$;

revoke all on function public.rls_role_key(text) from public;
revoke all on function public.current_profile_id() from public;
revoke all on function public.has_role(text, uuid) from public;
revoke all on function public.has_any_role(text[], uuid) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_secretary() from public;
revoke all on function public.is_scrutineer() from public;
revoke all on function public.is_head_scrutineer() from public;
revoke all on function public.is_official() from public;
revoke all on function public.is_committee() from public;
revoke all on function public.is_authority_read_all() from public;
revoke all on function public.is_race_result_editor() from public;
revoke all on function public.is_team_owner(uuid) from public;
revoke all on function public.can_manage_competitor(uuid, uuid) from public;
revoke all on function public.can_access_team(uuid) from public;
revoke all on function public.can_access_entry_form(uuid) from public;
revoke all on function public.can_access_inspection_form(uuid) from public;
revoke all on function public.can_access_inspection_version(uuid) from public;
revoke all on function public.can_access_competitor_request(uuid) from public;
revoke all on function public.can_access_file_asset(uuid) from public;
revoke all on function public.can_access_weigh_in_log(uuid) from public;

grant execute on function public.rls_role_key(text) to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_role(text, uuid) to authenticated;
grant execute on function public.has_any_role(text[], uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_secretary() to authenticated;
grant execute on function public.is_scrutineer() to authenticated;
grant execute on function public.is_head_scrutineer() to authenticated;
grant execute on function public.is_official() to authenticated;
grant execute on function public.is_committee() to authenticated;
grant execute on function public.is_authority_read_all() to authenticated;
grant execute on function public.is_race_result_editor() to authenticated;
grant execute on function public.is_team_owner(uuid) to authenticated;
grant execute on function public.can_manage_competitor(uuid, uuid) to authenticated;
grant execute on function public.can_access_team(uuid) to authenticated;
grant execute on function public.can_access_entry_form(uuid) to authenticated;
grant execute on function public.can_access_inspection_form(uuid) to authenticated;
grant execute on function public.can_access_inspection_version(uuid) to authenticated;
grant execute on function public.can_access_competitor_request(uuid) to authenticated;
grant execute on function public.can_access_file_asset(uuid) to authenticated;
grant execute on function public.can_access_weigh_in_log(uuid) to authenticated;

-- =========================================================
-- 2. Enable RLS on every public application table
-- =========================================================

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.organizations enable row level security;
alter table public.file_assets enable row level security;
alter table public.circuits enable row level security;
alter table public.grades enable row level security;
alter table public.seasons enable row level security;
alter table public.series_races enable row level security;
alter table public.events enable row level security;
alter table public.races enable row level security;
alter table public.season_series enable row level security;
alter table public.season_series_grades enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_invitations enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_invitations enable row level security;
alter table public.competitor_vehicles enable row level security;
alter table public.competitor_licenses enable row level security;
alter table public.event_series_rules enable row level security;
alter table public.checklist_topics enable row level security;
alter table public.inspection_form_templates enable row level security;
alter table public.inspection_template_sections enable row level security;
alter table public.inspection_template_items enable row level security;
alter table public.ballast_rules enable row level security;
alter table public.point_rules enable row level security;
alter table public.tire_rules enable row level security;
alter table public.sponsor_sticker_assets enable row level security;
alter table public.print_background_assets enable row level security;
alter table public.entry_form_batches enable row level security;
alter table public.entry_forms enable row level security;
alter table public.entry_form_documents enable row level security;
alter table public.checklist_items enable row level security;
alter table public.inspection_forms enable row level security;
alter table public.inspection_form_versions enable row level security;
alter table public.inspection_item_results enable row level security;
alter table public.component_seals enable row level security;
alter table public.weigh_in_sessions enable row level security;
alter table public.weigh_in_logs enable row level security;
alter table public.competitor_requests enable row level security;
alter table public.competitor_request_documents enable row level security;
alter table public.request_approvals enable row level security;
alter table public.scrutineer_reports enable row level security;
alter table public.race_results enable row level security;
alter table public.race_result_entries enable row level security;
alter table public.ballast_ledger enable row level security;
alter table public.championship_standings enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- =========================================================
-- 3. Admin full-access bypass on every table
-- =========================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles','roles','organizations','file_assets','circuits','grades','seasons','series_races','events','races',
    'season_series','season_series_grades','user_roles','role_invitations','teams','team_memberships','team_invitations',
    'competitor_vehicles','competitor_licenses','event_series_rules','checklist_topics','inspection_form_templates',
    'inspection_template_sections','inspection_template_items','ballast_rules','point_rules','tire_rules','sponsor_sticker_assets',
    'print_background_assets','entry_form_batches','entry_forms','entry_form_documents','checklist_items','inspection_forms',
    'inspection_form_versions','inspection_item_results','component_seals','weigh_in_sessions','weigh_in_logs',
    'competitor_requests','competitor_request_documents','request_approvals','scrutineer_reports','race_results',
    'race_result_entries','ballast_ledger','championship_standings','notifications','audit_logs'
  ] loop
    execute format('drop policy if exists admin_all on public.%I', tbl);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      tbl
    );
  end loop;
end $$;

-- =========================================================
-- 4. Public authenticated reads for low-risk reference/config tables
-- =========================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'roles','organizations','circuits','grades','seasons','series_races','events','races',
    'season_series','season_series_grades','event_series_rules','checklist_topics','inspection_form_templates',
    'inspection_template_sections','inspection_template_items','ballast_rules','point_rules','tire_rules',
    'sponsor_sticker_assets','print_background_assets','weigh_in_sessions','race_results','race_result_entries',
    'ballast_ledger','championship_standings'
  ] loop
    execute format('drop policy if exists authenticated_read on public.%I', tbl);
    execute format('create policy authenticated_read on public.%I for select to authenticated using (true)', tbl);
  end loop;
end $$;

-- =========================================================
-- 5. Identity, RBAC, teams
-- =========================================================

drop policy if exists profiles_select_self_or_official on public.profiles;
create policy profiles_select_self_or_official on public.profiles
for select to authenticated
using (id = public.current_profile_id() or public.is_official());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (auth_user_id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = public.current_profile_id())
with check (id = public.current_profile_id() and auth_user_id = auth.uid());

drop policy if exists user_roles_select_self_or_inviter on public.user_roles;
create policy user_roles_select_self_or_inviter on public.user_roles
for select to authenticated
using (profile_id = public.current_profile_id() or invited_by_id = public.current_profile_id());

drop policy if exists role_invitations_select_relevant on public.role_invitations;
create policy role_invitations_select_relevant on public.role_invitations
for select to authenticated
using (
  invited_profile_id = public.current_profile_id()
  or invited_by_id = public.current_profile_id()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists teams_select_relevant_or_official on public.teams;
create policy teams_select_relevant_or_official on public.teams
for select to authenticated
using (public.is_official() or public.can_access_team(id));

drop policy if exists teams_insert_owner on public.teams;
create policy teams_insert_owner on public.teams
for insert to authenticated
with check (owner_profile_id = public.current_profile_id());

drop policy if exists teams_update_owner on public.teams;
create policy teams_update_owner on public.teams
for update to authenticated
using (owner_profile_id = public.current_profile_id())
with check (owner_profile_id = public.current_profile_id());

drop policy if exists team_memberships_select_relevant_or_official on public.team_memberships;
create policy team_memberships_select_relevant_or_official on public.team_memberships
for select to authenticated
using (
  public.is_official()
  or competitor_profile_id = public.current_profile_id()
  or public.is_team_owner(team_id)
);

drop policy if exists team_memberships_insert_relevant on public.team_memberships;
create policy team_memberships_insert_relevant on public.team_memberships
for insert to authenticated
with check (competitor_profile_id = public.current_profile_id() or public.is_team_owner(team_id));

drop policy if exists team_memberships_update_relevant on public.team_memberships;
create policy team_memberships_update_relevant on public.team_memberships
for update to authenticated
using (competitor_profile_id = public.current_profile_id() or public.is_team_owner(team_id))
with check (competitor_profile_id = public.current_profile_id() or public.is_team_owner(team_id));

drop policy if exists team_invitations_select_relevant_or_official on public.team_invitations;
create policy team_invitations_select_relevant_or_official on public.team_invitations
for select to authenticated
using (
  public.is_official()
  or competitor_profile_id = public.current_profile_id()
  or public.is_team_owner(team_id)
);

drop policy if exists team_invitations_insert_relevant on public.team_invitations;
create policy team_invitations_insert_relevant on public.team_invitations
for insert to authenticated
with check (competitor_profile_id = public.current_profile_id() or public.is_team_owner(team_id));

drop policy if exists team_invitations_update_relevant on public.team_invitations;
create policy team_invitations_update_relevant on public.team_invitations
for update to authenticated
using (competitor_profile_id = public.current_profile_id() or public.is_team_owner(team_id))
with check (competitor_profile_id = public.current_profile_id() or public.is_team_owner(team_id));

-- =========================================================
-- 6. Competitor garage, licenses, files
-- =========================================================

drop policy if exists competitor_vehicles_select_relevant_or_official on public.competitor_vehicles;
create policy competitor_vehicles_select_relevant_or_official on public.competitor_vehicles
for select to authenticated
using (public.is_official() or public.can_manage_competitor(profile_id));

drop policy if exists competitor_vehicles_insert_relevant on public.competitor_vehicles;
create policy competitor_vehicles_insert_relevant on public.competitor_vehicles
for insert to authenticated
with check (public.can_manage_competitor(profile_id));

drop policy if exists competitor_vehicles_update_relevant on public.competitor_vehicles;
create policy competitor_vehicles_update_relevant on public.competitor_vehicles
for update to authenticated
using (public.can_manage_competitor(profile_id))
with check (public.can_manage_competitor(profile_id));

drop policy if exists competitor_licenses_select_relevant_or_official on public.competitor_licenses;
create policy competitor_licenses_select_relevant_or_official on public.competitor_licenses
for select to authenticated
using (public.is_official() or public.can_manage_competitor(profile_id));

drop policy if exists competitor_licenses_insert_relevant on public.competitor_licenses;
create policy competitor_licenses_insert_relevant on public.competitor_licenses
for insert to authenticated
with check (public.can_manage_competitor(profile_id));

drop policy if exists competitor_licenses_update_relevant on public.competitor_licenses;
create policy competitor_licenses_update_relevant on public.competitor_licenses
for update to authenticated
using (public.can_manage_competitor(profile_id))
with check (public.can_manage_competitor(profile_id));

drop policy if exists file_assets_select_visible_relevant on public.file_assets;
create policy file_assets_select_visible_relevant on public.file_assets
for select to authenticated
using (
  deleted_at is null
  and (
    public.is_official()
    or uploaded_by_id = public.current_profile_id()
    or public.can_access_file_asset(id)
  )
);

drop policy if exists file_assets_insert_uploader on public.file_assets;
create policy file_assets_insert_uploader on public.file_assets
for insert to authenticated
with check (uploaded_by_id = public.current_profile_id() or public.is_official());

drop policy if exists file_assets_update_visible_relevant on public.file_assets;
create policy file_assets_update_visible_relevant on public.file_assets
for update to authenticated
using (deleted_at is null and (uploaded_by_id = public.current_profile_id() or public.is_secretary()))
with check (uploaded_by_id = public.current_profile_id() or public.is_secretary());

-- =========================================================
-- 7. Entry forms and checklist
-- =========================================================

drop policy if exists entry_form_batches_select_relevant_or_official on public.entry_form_batches;
create policy entry_form_batches_select_relevant_or_official on public.entry_form_batches
for select to authenticated
using (public.is_official() or public.can_manage_competitor(competitor_profile_id));

drop policy if exists entry_form_batches_insert_relevant on public.entry_form_batches;
create policy entry_form_batches_insert_relevant on public.entry_form_batches
for insert to authenticated
with check (public.can_manage_competitor(competitor_profile_id));

drop policy if exists entry_form_batches_update_relevant_or_secretary on public.entry_form_batches;
create policy entry_form_batches_update_relevant_or_secretary on public.entry_form_batches
for update to authenticated
using (public.is_secretary() or public.can_manage_competitor(competitor_profile_id))
with check (public.is_secretary() or public.can_manage_competitor(competitor_profile_id));

drop policy if exists entry_forms_select_visible_relevant_or_official on public.entry_forms;
create policy entry_forms_select_visible_relevant_or_official on public.entry_forms
for select to authenticated
using (
  deleted_at is null
  and (
    public.is_authority_read_all()
    or (public.is_scrutineer() and status = 'Active')
    or public.can_manage_competitor(competitor_profile_id, season_id)
  )
);

drop policy if exists entry_forms_insert_relevant_or_secretary on public.entry_forms;
create policy entry_forms_insert_relevant_or_secretary on public.entry_forms
for insert to authenticated
with check (
  public.is_secretary()
  or (
    public.can_manage_competitor(competitor_profile_id, season_id)
    and status in ('Draft', 'Pending')
  )
);

drop policy if exists entry_forms_update_relevant_or_secretary on public.entry_forms;
create policy entry_forms_update_relevant_or_secretary on public.entry_forms
for update to authenticated
using (
  deleted_at is null
  and (
    public.is_secretary()
    or (
      public.can_manage_competitor(competitor_profile_id, season_id)
      and status in ('Draft', 'Rejected')
    )
  )
)
with check (
  public.is_secretary()
  or (
    public.can_manage_competitor(competitor_profile_id, season_id)
    and status in ('Draft', 'Pending', 'Rejected')
    and deleted_at is null
  )
);

drop policy if exists entry_form_documents_select_relevant_or_official on public.entry_form_documents;
create policy entry_form_documents_select_relevant_or_official on public.entry_form_documents
for select to authenticated
using (public.is_official() or public.can_access_entry_form(entry_form_id));

drop policy if exists entry_form_documents_insert_relevant_or_secretary on public.entry_form_documents;
create policy entry_form_documents_insert_relevant_or_secretary on public.entry_form_documents
for insert to authenticated
with check (public.is_secretary() or public.can_access_entry_form(entry_form_id));

drop policy if exists entry_form_documents_update_relevant_or_secretary on public.entry_form_documents;
create policy entry_form_documents_update_relevant_or_secretary on public.entry_form_documents
for update to authenticated
using (public.is_secretary() or public.can_access_entry_form(entry_form_id))
with check (public.is_secretary() or public.can_access_entry_form(entry_form_id));

drop policy if exists checklist_items_select_relevant_or_official on public.checklist_items;
create policy checklist_items_select_relevant_or_official on public.checklist_items
for select to authenticated
using (public.is_official() or public.can_access_entry_form(entry_form_id));

drop policy if exists checklist_items_modify_secretary on public.checklist_items;
create policy checklist_items_modify_secretary on public.checklist_items
for all to authenticated
using (public.is_secretary())
with check (public.is_secretary());

-- =========================================================
-- 8. Inspection, seals, weigh-in
-- =========================================================

drop policy if exists inspection_forms_select_relevant_or_operational on public.inspection_forms;
create policy inspection_forms_select_relevant_or_operational on public.inspection_forms
for select to authenticated
using (public.is_official() or public.can_access_entry_form(entry_form_id));

drop policy if exists inspection_forms_insert_relevant_or_operational on public.inspection_forms;
create policy inspection_forms_insert_relevant_or_operational on public.inspection_forms
for insert to authenticated
with check (public.is_secretary() or public.is_scrutineer() or public.can_access_entry_form(entry_form_id));

drop policy if exists inspection_forms_update_relevant_or_operational on public.inspection_forms;
create policy inspection_forms_update_relevant_or_operational on public.inspection_forms
for update to authenticated
using (
  public.is_secretary()
  or public.is_scrutineer()
  or (public.can_access_entry_form(entry_form_id) and status = 'Draft')
)
with check (
  public.is_secretary()
  or public.is_scrutineer()
  or (public.can_access_entry_form(entry_form_id) and status in ('Draft', 'Pending'))
);

drop policy if exists inspection_versions_select_relevant_or_operational on public.inspection_form_versions;
create policy inspection_versions_select_relevant_or_operational on public.inspection_form_versions
for select to authenticated
using (public.is_official() or public.can_access_inspection_form(inspection_form_id));

drop policy if exists inspection_versions_modify_relevant_or_operational on public.inspection_form_versions;
create policy inspection_versions_modify_relevant_or_operational on public.inspection_form_versions
for all to authenticated
using (public.is_secretary() or public.is_scrutineer() or public.can_access_inspection_form(inspection_form_id))
with check (public.is_secretary() or public.is_scrutineer() or public.can_access_inspection_form(inspection_form_id));

drop policy if exists inspection_item_results_select_relevant_or_operational on public.inspection_item_results;
create policy inspection_item_results_select_relevant_or_operational on public.inspection_item_results
for select to authenticated
using (public.is_official() or public.can_access_inspection_version(inspection_version_id));

drop policy if exists inspection_item_results_modify_relevant_or_operational on public.inspection_item_results;
create policy inspection_item_results_modify_relevant_or_operational on public.inspection_item_results
for all to authenticated
using (public.is_secretary() or public.is_scrutineer() or public.can_access_inspection_version(inspection_version_id))
with check (public.is_secretary() or public.is_scrutineer() or public.can_access_inspection_version(inspection_version_id));

drop policy if exists component_seals_select_relevant_or_operational on public.component_seals;
create policy component_seals_select_relevant_or_operational on public.component_seals
for select to authenticated
using (
  public.is_official()
  or (inspection_form_id is not null and public.can_access_inspection_form(inspection_form_id))
  or exists (
    select 1
    from public.competitor_vehicles cv
    where cv.id = component_seals.vehicle_id
      and public.can_manage_competitor(cv.profile_id)
  )
);

drop policy if exists component_seals_modify_scrutineer_or_secretary on public.component_seals;
create policy component_seals_modify_scrutineer_or_secretary on public.component_seals
for all to authenticated
using (public.is_secretary() or public.is_scrutineer())
with check (public.is_secretary() or public.is_scrutineer());

drop policy if exists weigh_in_sessions_modify_scrutineer_or_secretary on public.weigh_in_sessions;
create policy weigh_in_sessions_modify_scrutineer_or_secretary on public.weigh_in_sessions
for all to authenticated
using (public.is_secretary() or public.is_scrutineer())
with check (public.is_secretary() or public.is_scrutineer());

drop policy if exists weigh_in_logs_select_relevant_or_operational on public.weigh_in_logs;
create policy weigh_in_logs_select_relevant_or_operational on public.weigh_in_logs
for select to authenticated
using (public.is_official() or public.can_access_entry_form(entry_form_id));

drop policy if exists weigh_in_logs_modify_scrutineer_or_secretary on public.weigh_in_logs;
create policy weigh_in_logs_modify_scrutineer_or_secretary on public.weigh_in_logs
for all to authenticated
using (public.is_secretary() or public.is_scrutineer())
with check (public.is_secretary() or public.is_scrutineer());

-- =========================================================
-- 9. Competitor requests and committee approvals
-- =========================================================

drop policy if exists competitor_requests_select_visible_relevant_or_official on public.competitor_requests;
create policy competitor_requests_select_visible_relevant_or_official on public.competitor_requests
for select to authenticated
using (
  deleted_at is null
  and (
    public.is_secretary()
    or public.can_access_competitor_request(id)
    or public.has_any_role(array['Head Scrutineer','Scrutineer Staff','President','Steward','Clerk of the course'])
  )
);

drop policy if exists competitor_requests_insert_relevant on public.competitor_requests;
create policy competitor_requests_insert_relevant on public.competitor_requests
for insert to authenticated
with check (
  public.is_secretary()
  or (
    public.can_access_entry_form(entry_form_id)
    and requester_profile_id = public.current_profile_id()
    and status in ('Draft', 'Pending', 'Need Racer Approval')
  )
);

drop policy if exists competitor_requests_update_relevant_or_secretary on public.competitor_requests;
create policy competitor_requests_update_relevant_or_secretary on public.competitor_requests
for update to authenticated
using (
  deleted_at is null
  and (
    public.is_secretary()
    or (
      public.can_access_competitor_request(id)
      and status in ('Draft', 'Need Racer Approval')
    )
  )
)
with check (
  public.is_secretary()
  or (
    public.can_access_entry_form(entry_form_id)
    and status in ('Draft', 'Pending', 'Need Racer Approval')
    and deleted_at is null
  )
);

drop policy if exists competitor_request_documents_select_relevant_or_secretary on public.competitor_request_documents;
create policy competitor_request_documents_select_relevant_or_secretary on public.competitor_request_documents
for select to authenticated
using (public.is_secretary() or public.can_access_competitor_request(competitor_request_id));

drop policy if exists competitor_request_documents_modify_relevant_or_secretary on public.competitor_request_documents;
create policy competitor_request_documents_modify_relevant_or_secretary on public.competitor_request_documents
for all to authenticated
using (public.is_secretary() or public.can_access_competitor_request(competitor_request_id))
with check (public.is_secretary() or public.can_access_competitor_request(competitor_request_id));

drop policy if exists request_approvals_select_relevant on public.request_approvals;
create policy request_approvals_select_relevant on public.request_approvals
for select to authenticated
using (
  public.is_secretary()
  or approver_profile_id = public.current_profile_id()
  or public.can_access_competitor_request(competitor_request_id)
);

drop policy if exists request_approvals_insert_secretary on public.request_approvals;
create policy request_approvals_insert_secretary on public.request_approvals
for insert to authenticated
with check (public.is_secretary());

drop policy if exists request_approvals_update_secretary_or_assigned on public.request_approvals;
create policy request_approvals_update_secretary_or_assigned on public.request_approvals
for update to authenticated
using (public.is_secretary() or approver_profile_id = public.current_profile_id())
with check (public.is_secretary() or approver_profile_id = public.current_profile_id());

-- =========================================================
-- 10. Scrutineer reports, race results, standings
-- =========================================================

drop policy if exists scrutineer_reports_select_visible on public.scrutineer_reports;
create policy scrutineer_reports_select_visible on public.scrutineer_reports
for select to authenticated
using (deleted_at is null and (public.is_official() or status = 'Official'));

drop policy if exists scrutineer_reports_modify_head_scrutineer on public.scrutineer_reports;
create policy scrutineer_reports_modify_head_scrutineer on public.scrutineer_reports
for all to authenticated
using (deleted_at is null and public.is_head_scrutineer())
with check (public.is_head_scrutineer());

-- Secretary receives read-only access through authenticated_read on race_results.
-- Direct race result mutation is intentionally limited to Admin bypass and Steward.
drop policy if exists race_results_modify_steward on public.race_results;
create policy race_results_modify_steward on public.race_results
for all to authenticated
using (public.is_race_result_editor())
with check (public.is_race_result_editor());

drop policy if exists race_result_entries_modify_steward on public.race_result_entries;
create policy race_result_entries_modify_steward on public.race_result_entries
for all to authenticated
using (public.is_race_result_editor())
with check (public.is_race_result_editor());

drop policy if exists ballast_ledger_modify_secretary_or_steward on public.ballast_ledger;
create policy ballast_ledger_modify_secretary_or_steward on public.ballast_ledger
for all to authenticated
using (public.is_secretary() or public.is_race_result_editor())
with check (public.is_secretary() or public.is_race_result_editor());

-- championship_standings is database-owned cache/standing data.
-- Non-admin users read it through authenticated_read; mutations happen via SECURITY DEFINER triggers/RPCs.
drop policy if exists championship_standings_modify_steward on public.championship_standings;

-- =========================================================
-- 11. Notifications and audit logs
-- =========================================================

drop policy if exists notifications_select_recipient on public.notifications;
create policy notifications_select_recipient on public.notifications
for select to authenticated
using (recipient_profile_id = public.current_profile_id());

drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications
for update to authenticated
using (recipient_profile_id = public.current_profile_id())
with check (recipient_profile_id = public.current_profile_id());

drop policy if exists notifications_insert_official on public.notifications;
create policy notifications_insert_official on public.notifications
for insert to authenticated
with check (public.is_official());

drop policy if exists audit_logs_select_relevant on public.audit_logs;
create policy audit_logs_select_relevant on public.audit_logs
for select to authenticated
using (public.is_official() or action_by_id = public.current_profile_id());

commit;
