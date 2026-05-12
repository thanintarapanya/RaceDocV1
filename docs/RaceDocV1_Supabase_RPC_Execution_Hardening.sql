-- RaceDocV1 Supabase RPC Execution Hardening
-- Purpose: close anonymous/public execution of public RPCs while preserving
-- authenticated application flows that perform their own RBAC/ownership checks.

begin;

-- Supabase/Postgres can grant EXECUTE broadly by default. Public RPCs are
-- exposed through PostgREST, so anonymous execution must be explicitly closed.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Prevent future functions from becoming anonymous/public RPC endpoints by default.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- Preserve signed-in application RPCs. These functions validate auth, role,
-- ownership, and/or document state internally before reading or mutating data.
grant execute on function public.approve_entry_form(uuid) to authenticated, service_role;
grant execute on function public.complete_team_manager_onboarding(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.complete_user_onboarding(text, text, text, text, text, text, text, date, text, text, text) to authenticated, service_role;
grant execute on function public.create_file_asset(text, text, text, bigint) to authenticated, service_role;
grant execute on function public.get_auth_bootstrap() to authenticated, service_role;
grant execute on function public.get_checklist_entries() to authenticated, service_role;
grant execute on function public.get_current_onboarding_profile() to authenticated, service_role;
grant execute on function public.get_current_user_roles() to authenticated, service_role;
grant execute on function public.get_current_user_team_prefill() to authenticated, service_role;
grant execute on function public.get_dashboard_summary() to authenticated, service_role;
grant execute on function public.get_entry_form_step1_options() to authenticated, service_role;
grant execute on function public.get_my_entry_forms() to authenticated, service_role;
grant execute on function public.get_secretary_pending_entries() to authenticated, service_role;
grant execute on function public.is_admin_or_secretary(uuid) to authenticated, service_role;
grant execute on function public.reject_entry_form(uuid, text) to authenticated, service_role;
grant execute on function public.submit_entry_form_batch(jsonb) to authenticated, service_role;
grant execute on function public.update_entry_checklist(uuid, boolean, boolean, boolean, boolean, boolean, text) to authenticated, service_role;

-- Preserve authenticated access to RLS helper functions used by policies.
grant execute on function public.can_access_competitor_request(uuid) to authenticated, service_role;
grant execute on function public.can_access_entry_form(uuid) to authenticated, service_role;
grant execute on function public.can_access_file_asset(uuid) to authenticated, service_role;
grant execute on function public.can_access_inspection_form(uuid) to authenticated, service_role;
grant execute on function public.can_access_inspection_version(uuid) to authenticated, service_role;
grant execute on function public.can_access_team(uuid) to authenticated, service_role;
grant execute on function public.can_access_weigh_in_log(uuid) to authenticated, service_role;
grant execute on function public.can_manage_competitor(uuid, uuid) to authenticated, service_role;
grant execute on function public.current_profile_id() to authenticated, service_role;
grant execute on function public.has_any_role(text[], uuid) to authenticated, service_role;
grant execute on function public.has_role(text, uuid) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_authority_read_all() to authenticated, service_role;
grant execute on function public.is_committee() to authenticated, service_role;
grant execute on function public.is_head_scrutineer() to authenticated, service_role;
grant execute on function public.is_official() to authenticated, service_role;
grant execute on function public.is_race_result_editor() to authenticated, service_role;
grant execute on function public.is_scrutineer() to authenticated, service_role;
grant execute on function public.is_secretary() to authenticated, service_role;
grant execute on function public.is_team_owner(uuid) to authenticated, service_role;
grant execute on function public.rls_role_key(text) to authenticated, service_role;

-- Maintenance/trigger helpers must not be callable as user-facing RPCs.
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.recalculate_championship_standing_podium_counts(uuid, uuid, uuid, uuid) from authenticated;
revoke execute on function public.sync_championship_podium_counts_from_race_result() from authenticated;
revoke execute on function public.sync_championship_podium_counts_from_result_entry() from authenticated;
revoke execute on function public.sync_entry_race_eligibility_from_inspection() from authenticated;

-- Pin search_path on the role-key helper flagged by the advisor.
alter function public.rls_role_key(text) set search_path = public, pg_temp;

commit;
