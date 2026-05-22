-- RaceDocV1 Supabase Data API Explicit Grants
-- Purpose: Future-proof public schema tables for Supabase's May/October 2026 explicit GRANT rollout.
-- Notes:
-- 1. This does not replace RLS. RLS remains the real access control layer.
-- 2. The frontend mostly uses SECURITY DEFINER RPCs, but direct table/storage paths and future tables still need explicit grants.
-- 3. Apply after table creation and before relying on PostgREST/supabase-js table access.

grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.profiles,
  public.roles,
  public.organizations,
  public.file_assets,
  public.circuits,
  public.grades,
  public.seasons,
  public.series_races,
  public.events,
  public.races,
  public.season_series,
  public.season_series_grades,
  public.user_roles,
  public.role_invitations,
  public.teams,
  public.team_memberships,
  public.team_invitations,
  public.competitor_vehicles,
  public.competitor_licenses,
  public.event_series_rules,
  public.checklist_topics,
  public.inspection_form_templates,
  public.inspection_template_sections,
  public.inspection_template_items,
  public.ballast_rules,
  public.point_rules,
  public.tire_rules,
  public.sponsor_sticker_assets,
  public.print_background_assets,
  public.entry_form_batches,
  public.entry_forms,
  public.entry_form_documents,
  public.checklist_items,
  public.inspection_forms,
  public.inspection_form_versions,
  public.inspection_item_results,
  public.component_seals,
  public.weigh_in_sessions,
  public.weigh_in_logs,
  public.competitor_requests,
  public.competitor_request_documents,
  public.request_approvals,
  public.scrutineer_reports,
  public.race_results,
  public.race_result_entries,
  public.ballast_ledger,
  public.championship_standings,
  public.notifications,
  public.audit_logs
to authenticated, service_role;

grant select on table
  public.organizations,
  public.circuits,
  public.grades,
  public.seasons,
  public.series_races,
  public.events,
  public.races
to anon;

grant insert, update, delete on table
  public.profiles,
  public.file_assets,
  public.entry_form_batches,
  public.entry_forms,
  public.entry_form_documents,
  public.competitor_vehicles,
  public.competitor_licenses,
  public.teams,
  public.team_memberships,
  public.team_invitations,
  public.competitor_requests,
  public.competitor_request_documents,
  public.inspection_forms,
  public.inspection_form_versions,
  public.inspection_item_results,
  public.component_seals,
  public.weigh_in_logs,
  public.checklist_items,
  public.request_approvals,
  public.race_results,
  public.race_result_entries,
  public.notifications
to authenticated;

grant insert, update, delete on table
  public.profiles,
  public.roles,
  public.organizations,
  public.file_assets,
  public.circuits,
  public.grades,
  public.seasons,
  public.series_races,
  public.events,
  public.races,
  public.season_series,
  public.season_series_grades,
  public.user_roles,
  public.role_invitations,
  public.teams,
  public.team_memberships,
  public.team_invitations,
  public.competitor_vehicles,
  public.competitor_licenses,
  public.event_series_rules,
  public.checklist_topics,
  public.inspection_form_templates,
  public.inspection_template_sections,
  public.inspection_template_items,
  public.ballast_rules,
  public.point_rules,
  public.tire_rules,
  public.sponsor_sticker_assets,
  public.print_background_assets,
  public.entry_form_batches,
  public.entry_forms,
  public.entry_form_documents,
  public.checklist_items,
  public.inspection_forms,
  public.inspection_form_versions,
  public.inspection_item_results,
  public.component_seals,
  public.weigh_in_sessions,
  public.weigh_in_logs,
  public.competitor_requests,
  public.competitor_request_documents,
  public.request_approvals,
  public.scrutineer_reports,
  public.race_results,
  public.race_result_entries,
  public.ballast_ledger,
  public.championship_standings,
  public.notifications,
  public.audit_logs
to service_role;

alter default privileges in schema public
  grant select on tables to authenticated, service_role;

alter default privileges in schema public
  grant insert, update, delete on tables to service_role;

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
