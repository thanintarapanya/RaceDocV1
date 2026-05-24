-- =========================================================
-- RaceDocV1 Base Schema
-- Phase: SQL Generation
-- Scope: Tables, Enums, Constraints, Foreign Keys, Indexes, Integrity Triggers
-- RLS: NOT included in this script
-- =========================================================

begin;

-- =========================================================
-- 0. Extensions
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

-- =========================================================
-- 1. Enums
-- =========================================================

create type public.onboarding_status as enum (
  'ProfileRequired',
  'TeamRequired',
  'Ready'
);

create type public.invitation_status as enum (
  'Pending',
  'Accepted',
  'Rejected',
  'Expired',
  'Revoked',
  'Cancelled'
);

create type public.invite_direction as enum (
  'ManagerToCompetitor',
  'CompetitorToManager'
);

create type public.season_status as enum (
  'Draft',
  'Active',
  'Completed',
  'Archived'
);

create type public.event_status as enum (
  'Draft',
  'RegistrationOpen',
  'Active',
  'Completed',
  'Cancelled'
);

create type public.rule_status as enum (
  'Draft',
  'Active',
  'Locked',
  'Archived'
);

create type public.entry_form_status as enum (
  'Draft',
  'Pending',
  'Active',
  'Inactive',
  'Rejected'
);

create type public.payment_status as enum (
  'Unpaid',
  'Pending',
  'Paid',
  'Rejected',
  'Waived'
);

create type public.inspection_form_status as enum (
  'Draft',
  'Pending',
  'Passed',
  'Hold',
  'Failed'
);

create type public.inspection_item_result_status as enum (
  'Unchecked',
  'Passed',
  'Failed',
  'Hold',
  'NotApplicable'
);

create type public.inspection_input_type as enum (
  'Checkbox',
  'Dropdown',
  'Text Input',
  'Number',
  'Date',
  'File'
);

create type public.weight_effect_type as enum (
  'None',
  'Fix',
  'Vary'
);

create type public.ballast_type as enum (
  'None',
  'SuccessBallast',
  'ChampionshipWeight'
);

create type public.component_type as enum (
  'Engine',
  'Gear',
  'Other'
);

create type public.weigh_in_session_status as enum (
  'Draft',
  'Open',
  'Closed',
  'Cancelled'
);

create type public.weigh_in_status as enum (
  'Pending',
  'Passed',
  'Failed',
  'Void'
);

create type public.competitor_request_status as enum (
  'Draft',
  'Need Racer Approval',
  'Pending',
  'In Review',
  'Approved',
  'Rejected',
  'Cancelled'
);

create type public.racer_consent_status as enum (
  'NotRequired',
  'Pending',
  'Approved',
  'Rejected',
  'Overridden'
);

create type public.request_approval_status as enum (
  'Pending',
  'Approved',
  'Rejected',
  'Skipped'
);

create type public.race_result_status as enum (
  'Draft',
  'Provisional',
  'Official',
  'Locked',
  'Cancelled'
);

create type public.race_result_code as enum (
  'Classified',
  'DNF',
  'DNS',
  'DQ',
  'DSQ'
);

create type public.scrutineer_report_status as enum (
  'Draft',
  'Official',
  'Deleted'
);

create type public.notification_channel as enum (
  'InApp',
  'Email'
);

-- =========================================================
-- 2. Identity, Roles, Organizations
-- =========================================================

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
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
  facebook text,
  instagram text,
  youtube text,
  tiktok text,
  onboarding_status public.onboarding_status not null default 'ProfileRequired',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_identity_or_passport_chk check (
    identity_no is not null or passport_no is not null or onboarding_status = 'ProfileRequired'
  )
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  brand_settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true
);

create table public.file_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_id uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  deleted_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint file_assets_size_nonnegative_chk check (size_bytes is null or size_bytes >= 0),
  constraint file_assets_bucket_path_uk unique (bucket, path)
);

-- =========================================================
-- 3. Competition Structure
-- =========================================================

create table public.circuits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  country text not null default 'Thailand'
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null default 0
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  year integer not null,
  status public.season_status not null default 'Draft',
  is_active boolean not null default false,
  activated_at timestamptz,
  created_by_id uuid references public.profiles(id) on delete set null,
  constraint seasons_year_chk check (year >= 2000),
  constraint seasons_org_year_uk unique (organization_id, year)
);

create table public.series_races (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  ballast_type public.ballast_type not null default 'None',
  is_active boolean not null default true,
  constraint series_races_org_code_uk unique (organization_id, code)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  circuit_id uuid references public.circuits(id) on delete set null,
  name text not null,
  event_order integer not null,
  starts_on date,
  ends_on date,
  status public.event_status not null default 'Draft',
  constraint events_order_positive_chk check (event_order > 0),
  constraint events_date_range_chk check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint events_season_order_uk unique (season_id, event_order)
);

create table public.races (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null,
  race_order integer not null,
  session_type text not null default 'Race',
  scheduled_at timestamptz,
  results_import_unlocked boolean not null default false,
  constraint races_order_positive_chk check (race_order > 0),
  constraint races_event_order_uk unique (event_id, race_order)
);

create table public.season_series (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  series_race_id uuid not null references public.series_races(id) on delete restrict,
  is_active boolean not null default true,
  constraint season_series_uk unique (season_id, series_race_id)
);

create table public.season_series_grades (
  id uuid primary key default gen_random_uuid(),
  season_series_id uuid not null references public.season_series(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete restrict,
  is_active boolean not null default true,
  constraint season_series_grades_uk unique (season_series_id, grade_id)
);

-- =========================================================
-- 4. User Roles and Invitations
-- =========================================================

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete cascade,
  is_active boolean not null default true,
  invited_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.role_invitations (
  id uuid primary key default gen_random_uuid(),
  invited_profile_id uuid references public.profiles(id) on delete cascade,
  invited_by_id uuid references public.profiles(id) on delete set null,
  role_id uuid not null references public.roles(id) on delete restrict,
  email text not null,
  status public.invitation_status not null default 'Pending',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 5. Teams, Competitor Garage, Licenses
-- =========================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  team_name text not null,
  manager_name text,
  manager_phone text,
  address text,
  postcode text,
  created_at timestamptz not null default now()
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  competitor_profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.invitation_status not null default 'Pending',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by_id uuid references public.profiles(id) on delete set null
);

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  competitor_profile_id uuid not null references public.profiles(id) on delete cascade,
  invite_direction public.invite_direction not null,
  status public.invitation_status not null default 'Pending',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.competitor_vehicles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  manufacturer text,
  model text,
  color text,
  year integer,
  engine_size_cc numeric(10,2),
  engine_code text,
  transmission text,
  drivetrain text,
  gearshift_pattern text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint competitor_vehicles_year_chk check (year is null or year >= 1900),
  constraint competitor_vehicles_engine_size_chk check (engine_size_cc is null or engine_size_cc > 0)
);

create table public.competitor_licenses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  license_no text not null,
  categorization_grade text,
  issued_by text,
  date_of_issued date,
  expiry_date date,
  created_at timestamptz not null default now(),
  constraint competitor_licenses_dates_chk check (
    date_of_issued is null or expiry_date is null or expiry_date >= date_of_issued
  )
);

-- =========================================================
-- 6. Admin Event Rules and Dynamic Settings
-- =========================================================

create table public.event_series_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  series_race_id uuid not null references public.series_races(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  status public.rule_status not null default 'Draft',
  version integer not null default 1,
  is_locked boolean not null default false,
  cloned_from_id uuid references public.event_series_rules(id) on delete set null,
  locked_at timestamptz,
  constraint event_series_rules_version_positive_chk check (version > 0),
  constraint event_series_rules_scope_version_uk unique (event_id, series_race_id, grade_id, version)
);

create table public.checklist_topics (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title_th text not null,
  title_en text,
  sort_order integer not null default 0,
  is_required boolean not null default false,
  is_active boolean not null default true,
  constraint checklist_topics_event_sort_uk unique (event_id, sort_order)
);

create table public.inspection_form_templates (
  id uuid primary key default gen_random_uuid(),
  event_series_rule_id uuid not null references public.event_series_rules(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  constraint inspection_templates_version_positive_chk check (version > 0),
  constraint inspection_templates_rule_version_uk unique (event_series_rule_id, version)
);

create table public.inspection_template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.inspection_form_templates(id) on delete cascade,
  code text not null,
  title text not null,
  sort_order integer not null default 0,
  is_fixed boolean not null default false,
  constraint inspection_template_sections_template_code_uk unique (template_id, code),
  constraint inspection_template_sections_template_sort_uk unique (template_id, sort_order)
);

create table public.inspection_template_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.inspection_template_sections(id) on delete cascade,
  label_th text not null,
  label_en text,
  input_type public.inspection_input_type not null,
  options jsonb not null default '[]'::jsonb,
  weight_effect_type public.weight_effect_type not null default 'None',
  fixed_weight_kg numeric(10,2),
  is_required boolean not null default false,
  sort_order integer not null default 0,
  constraint inspection_template_items_fixed_weight_chk check (
    (weight_effect_type = 'Fix' and fixed_weight_kg is not null)
    or (weight_effect_type <> 'Fix')
  ),
  constraint inspection_template_items_sort_uk unique (section_id, sort_order)
);

create table public.ballast_rules (
  id uuid primary key default gen_random_uuid(),
  event_series_rule_id uuid not null references public.event_series_rules(id) on delete cascade,
  ballast_type public.ballast_type not null,
  max_ballast_kg numeric(10,2),
  join_weight_enabled boolean not null default false,
  position_matrix jsonb not null default '{}'::jsonb,
  removal_rule jsonb not null default '{}'::jsonb,
  constraint ballast_rules_max_nonnegative_chk check (max_ballast_kg is null or max_ballast_kg >= 0),
  constraint ballast_rules_rule_uk unique (event_series_rule_id)
);

create table public.point_rules (
  id uuid primary key default gen_random_uuid(),
  event_series_rule_id uuid not null references public.event_series_rules(id) on delete cascade,
  position_points jsonb not null default '{}'::jsonb,
  bonus_points jsonb not null default '{}'::jsonb,
  constraint point_rules_rule_uk unique (event_series_rule_id)
);

create table public.tire_rules (
  id uuid primary key default gen_random_uuid(),
  event_series_rule_id uuid not null references public.event_series_rules(id) on delete cascade,
  tire_brand text not null,
  tire_model text,
  is_allowed boolean not null default true,
  constraint tire_rules_rule_brand_model_uk unique (event_series_rule_id, tire_brand, tire_model)
);

create table public.sponsor_sticker_assets (
  id uuid primary key default gen_random_uuid(),
  event_series_rule_id uuid not null references public.event_series_rules(id) on delete cascade,
  file_asset_id uuid not null references public.file_assets(id) on delete restrict,
  title text not null
);

create table public.print_background_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  file_asset_id uuid not null references public.file_assets(id) on delete restrict,
  title text not null,
  orientation text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  is_default boolean not null default false
);

-- =========================================================
-- 7. Entry Forms
-- =========================================================

create table public.entry_form_batches (
  id uuid primary key default gen_random_uuid(),
  competitor_profile_id uuid not null references public.profiles(id) on delete restrict,
  submitted_by_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  status public.entry_form_status not null default 'Draft',
  created_at timestamptz not null default now()
);

create table public.entry_forms (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.entry_form_batches(id) on delete set null,
  season_id uuid not null references public.seasons(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  series_race_id uuid not null references public.series_races(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  competitor_profile_id uuid not null references public.profiles(id) on delete restrict,
  team_id uuid references public.teams(id) on delete set null,
  vehicle_id uuid references public.competitor_vehicles(id) on delete set null,
  event_series_rule_id uuid references public.event_series_rules(id) on delete set null,
  car_number text not null,
  status public.entry_form_status not null default 'Draft',
  payment_status public.payment_status not null default 'Unpaid',
  is_locked boolean not null default false,
  is_eligible_to_race boolean not null default false,
  personal_snapshot jsonb not null default '{}'::jsonb,
  driver_license_snapshot jsonb not null default '{}'::jsonb,
  vehicle_snapshot jsonb not null default '{}'::jsonb,
  team_snapshot jsonb not null default '{}'::jsonb,
  signature_path text,
  approved_by_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by_id uuid references public.profiles(id) on delete set null,
  updated_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_id uuid references public.profiles(id) on delete set null,
  constraint entry_forms_approval_consistency_chk check (
    (status = 'Active' and approved_by_id is not null and approved_at is not null and is_locked = true)
    or status <> 'Active'
  )
);

create table public.entry_form_documents (
  id uuid primary key default gen_random_uuid(),
  entry_form_id uuid not null references public.entry_forms(id) on delete cascade,
  file_asset_id uuid not null references public.file_assets(id) on delete restrict,
  document_type text not null,
  is_required boolean not null default false,
  uploaded_at timestamptz not null default now()
);

-- =========================================================
-- 8. Checklist
-- =========================================================

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  entry_form_id uuid not null references public.entry_forms(id) on delete cascade,
  checklist_topic_id uuid not null references public.checklist_topics(id) on delete cascade,
  is_checked boolean not null default false,
  updated_by_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint checklist_items_entry_topic_uk unique (entry_form_id, checklist_topic_id)
);

-- =========================================================
-- 9. Inspection Forms and Components
-- =========================================================

create table public.inspection_forms (
  id uuid primary key default gen_random_uuid(),
  entry_form_id uuid not null references public.entry_forms(id) on delete restrict,
  template_id uuid not null references public.inspection_form_templates(id) on delete restrict,
  status public.inspection_form_status not null default 'Draft',
  official_bop_weight_kg numeric(10,2),
  current_version_no integer not null default 0,
  is_locked boolean not null default false,
  created_by_id uuid references public.profiles(id) on delete set null,
  updated_by_id uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  constraint inspection_forms_one_per_entry_uk unique (entry_form_id),
  constraint inspection_forms_bop_nonnegative_chk check (
    official_bop_weight_kg is null or official_bop_weight_kg >= 0
  ),
  constraint inspection_forms_version_nonnegative_chk check (current_version_no >= 0)
);

create table public.inspection_form_versions (
  id uuid primary key default gen_random_uuid(),
  inspection_form_id uuid not null references public.inspection_forms(id) on delete cascade,
  version_no integer not null,
  answers_snapshot jsonb not null default '{}'::jsonb,
  bop_base_weight_kg numeric(10,2),
  bop_option_weight_kg numeric(10,2),
  bop_total_weight_kg numeric(10,2),
  status public.inspection_form_status not null default 'Draft',
  inspected_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inspection_versions_version_positive_chk check (version_no > 0),
  constraint inspection_versions_weights_nonnegative_chk check (
    (bop_base_weight_kg is null or bop_base_weight_kg >= 0)
    and (bop_option_weight_kg is null or bop_option_weight_kg >= 0)
    and (bop_total_weight_kg is null or bop_total_weight_kg >= 0)
  ),
  constraint inspection_versions_form_version_uk unique (inspection_form_id, version_no)
);

create table public.inspection_item_results (
  id uuid primary key default gen_random_uuid(),
  inspection_version_id uuid not null references public.inspection_form_versions(id) on delete cascade,
  template_item_id uuid references public.inspection_template_items(id) on delete set null,
  result_status public.inspection_item_result_status not null default 'Unchecked',
  answer_value jsonb not null default 'null'::jsonb,
  applied_weight_kg numeric(10,2),
  comment text,
  constraint inspection_item_results_weight_nonnegative_chk check (
    applied_weight_kg is null or applied_weight_kg >= 0
  )
);

create table public.component_seals (
  id uuid primary key default gen_random_uuid(),
  inspection_form_id uuid references public.inspection_forms(id) on delete set null,
  vehicle_id uuid not null references public.competitor_vehicles(id) on delete cascade,
  component_type public.component_type not null,
  seal_number text not null,
  offsite_inspected boolean not null default false,
  is_active boolean not null default true,
  voided_at timestamptz,
  recorded_by_id uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint component_seals_form_component_number_uk unique (inspection_form_id, component_type, seal_number)
);

-- =========================================================
-- 10. Weight-In
-- =========================================================

create table public.weigh_in_sessions (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete restrict,
  session_type text not null,
  status public.weigh_in_session_status not null default 'Draft',
  opened_at timestamptz,
  closed_at timestamptz,
  constraint weigh_in_sessions_dates_chk check (
    opened_at is null or closed_at is null or closed_at >= opened_at
  ),
  constraint weigh_in_sessions_race_session_uk unique (race_id, session_type)
);

create table public.weigh_in_logs (
  id uuid primary key default gen_random_uuid(),
  weigh_in_session_id uuid not null references public.weigh_in_sessions(id) on delete cascade,
  entry_form_id uuid not null references public.entry_forms(id) on delete restrict,
  inspection_form_id uuid references public.inspection_forms(id) on delete set null,
  bop_base_weight_kg numeric(10,2) not null default 0,
  bop_option_weight_kg numeric(10,2) not null default 0,
  success_ballast_kg numeric(10,2) not null default 0,
  penalty_weight_kg numeric(10,2) not null default 0,
  join_weight_kg numeric(10,2) not null default 0,
  target_weight_kg numeric(10,2) not null,
  actual_weight_kg numeric(10,2),
  status public.weigh_in_status not null default 'Pending',
  weighed_by_id uuid references public.profiles(id) on delete set null,
  weighed_at timestamptz not null default now(),
  constraint weigh_in_logs_weights_nonnegative_chk check (
    bop_base_weight_kg >= 0
    and bop_option_weight_kg >= 0
    and success_ballast_kg >= 0
    and penalty_weight_kg >= 0
    and join_weight_kg >= 0
    and target_weight_kg >= 0
    and (actual_weight_kg is null or actual_weight_kg >= 0)
  )
);

-- =========================================================
-- 11. Competitor Requests
-- =========================================================

create table public.competitor_requests (
  id uuid primary key default gen_random_uuid(),
  entry_form_id uuid not null references public.entry_forms(id) on delete restrict,
  race_id uuid references public.races(id) on delete set null,
  requester_profile_id uuid not null references public.profiles(id) on delete restrict,
  submitted_by_id uuid references public.profiles(id) on delete set null,
  queue_no text not null,
  topic text not null,
  status public.competitor_request_status not null default 'Draft',
  request_payload jsonb not null default '{}'::jsonb,
  fine_amount numeric(12,2),
  payment_status public.payment_status not null default 'Unpaid',
  payment_receipt_id uuid references public.file_assets(id) on delete set null,
  penalty_weight_kg numeric(10,2),
  grid_penalty text,
  final_decision_by_id uuid references public.profiles(id) on delete set null,
  final_decision_at timestamptz,
  final_comment text,
  racer_consented_at timestamptz,
  racer_consent_status public.racer_consent_status not null default 'NotRequired',
  deleted_at timestamptz,
  deleted_by_id uuid references public.profiles(id) on delete set null,
  constraint competitor_requests_amounts_nonnegative_chk check (
    (fine_amount is null or fine_amount >= 0)
    and (penalty_weight_kg is null or penalty_weight_kg >= 0)
  ),
  constraint competitor_requests_final_decision_chk check (
    (
      status in ('Approved', 'Rejected')
      and final_decision_by_id is not null
      and final_decision_at is not null
    )
    or status not in ('Approved', 'Rejected')
  )
);

create table public.competitor_request_documents (
  id uuid primary key default gen_random_uuid(),
  competitor_request_id uuid not null references public.competitor_requests(id) on delete cascade,
  file_asset_id uuid not null references public.file_assets(id) on delete restrict,
  document_type text not null
);

create table public.request_approvals (
  id uuid primary key default gen_random_uuid(),
  competitor_request_id uuid not null references public.competitor_requests(id) on delete cascade,
  approver_profile_id uuid not null references public.profiles(id) on delete restrict,
  approver_role_code text not null,
  status public.request_approval_status not null default 'Pending',
  comment text,
  decided_at timestamptz,
  constraint request_approvals_decision_chk check (
    (status in ('Approved', 'Rejected', 'Skipped') and decided_at is not null)
    or status = 'Pending'
  ),
  constraint request_approvals_request_approver_uk unique (competitor_request_id, approver_profile_id, approver_role_code)
);

-- =========================================================
-- 12. Scrutineer Reports and Race Results
-- =========================================================

create table public.scrutineer_reports (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete restrict,
  series_race_id uuid not null references public.series_races(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  status public.scrutineer_report_status not null default 'Draft',
  report_snapshot jsonb not null default '{}'::jsonb,
  remarks text,
  signed_by_id uuid references public.profiles(id) on delete set null,
  signed_at timestamptz,
  signature_path text,
  print_background_id uuid references public.print_background_assets(id) on delete set null,
  deleted_at timestamptz,
  deleted_by_id uuid references public.profiles(id) on delete set null,
  constraint scrutineer_reports_official_signature_chk check (
    (status = 'Official' and signed_by_id is not null and signed_at is not null)
    or status <> 'Official'
  ),
  constraint scrutineer_reports_scope_uk unique (race_id, series_race_id, grade_id)
);

create table public.race_results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete restrict,
  series_race_id uuid not null references public.series_races(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  status public.race_result_status not null default 'Draft',
  is_official boolean not null default false,
  imported_by_id uuid references public.profiles(id) on delete set null,
  signed_off_by_id uuid references public.profiles(id) on delete set null,
  signed_off_at timestamptz,
  signature_path text,
  scrutineer_report_id uuid references public.scrutineer_reports(id) on delete set null,
  constraint race_results_official_signature_chk check (
    (is_official = true and signed_off_by_id is not null and signed_off_at is not null)
    or is_official = false
  ),
  constraint race_results_scope_uk unique (race_id, series_race_id, grade_id)
);

create table public.race_result_entries (
  id uuid primary key default gen_random_uuid(),
  race_result_id uuid not null references public.race_results(id) on delete cascade,
  entry_form_id uuid not null references public.entry_forms(id) on delete restrict,
  starting_position integer,
  position integer,
  result_code public.race_result_code not null default 'Classified',
  points numeric(10,2) not null default 0,
  success_ballast_delta_kg numeric(10,2) not null default 0,
  pole_position boolean not null default false,
  fastest_lap boolean not null default false,
  constraint race_result_entries_position_chk check (
    (starting_position is null or starting_position > 0)
    and (position is null or position > 0)
  ),
  constraint race_result_entries_points_nonnegative_chk check (points >= 0),
  constraint race_result_entries_ballast_nonnegative_chk check (
    success_ballast_delta_kg >= 0
  ),
  constraint race_result_entries_result_entry_uk unique (race_result_id, entry_form_id)
);

create table public.ballast_ledger (
  id uuid primary key default gen_random_uuid(),
  entry_form_id uuid not null references public.entry_forms(id) on delete restrict,
  race_id uuid references public.races(id) on delete set null,
  ballast_kg numeric(10,2) not null,
  source_type text not null,
  source_id uuid,
  applies_to_next_race boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ballast_ledger_ballast_nonnegative_chk check (ballast_kg >= 0)
);

create table public.championship_standings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  series_race_id uuid not null references public.series_races(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  competitor_profile_id uuid not null references public.profiles(id) on delete restrict,
  team_id uuid references public.teams(id) on delete set null,
  total_points integer not null default 0,
  p1_count integer not null default 0,
  p2_count integer not null default 0,
  p3_count integer not null default 0,
  rank integer,
  current_ballast_kg numeric(10,2) not null default 0,
  calculated_at timestamptz not null default now(),
  constraint championship_standings_podium_counts_nonnegative_chk check (
    p1_count >= 0 and p2_count >= 0 and p3_count >= 0
  ),
  constraint championship_standings_rank_chk check (rank is null or rank > 0),
  constraint championship_standings_ballast_nonnegative_chk check (current_ballast_kg >= 0),
  constraint championship_standings_scope_uk unique (
    season_id,
    series_race_id,
    grade_id,
    competitor_profile_id
  )
);

-- =========================================================
-- 13. Notifications and Audit
-- =========================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  channel public.notification_channel not null default 'InApp',
  title text not null,
  body text,
  link_entity_type text,
  link_entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  previous_status text,
  new_status text,
  action_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 14. Mandatory Unique / Partial Unique Indexes
-- =========================================================

create unique index user_roles_global_active_uk
  on public.user_roles (profile_id, role_id)
  where season_id is null and is_active = true;

create unique index user_roles_season_active_uk
  on public.user_roles (profile_id, role_id, season_id)
  where season_id is not null and is_active = true;

create unique index entry_forms_one_active_per_competitor_event_uk
  on public.entry_forms (competitor_profile_id, event_id)
  where status = 'Active';

create unique index team_memberships_active_competitor_season_uk
  on public.team_memberships (team_id, season_id, competitor_profile_id)
  where status = 'Accepted' and revoked_at is null;

create unique index team_invitations_pending_competitor_season_uk
  on public.team_invitations (team_id, season_id, competitor_profile_id, invite_direction)
  where status = 'Pending';

create unique index print_background_assets_one_default_per_event_orientation_uk
  on public.print_background_assets (event_id, orientation)
  where is_default = true;

create unique index inspection_templates_one_active_per_rule_uk
  on public.inspection_form_templates (event_series_rule_id)
  where is_active = true;

-- =========================================================
-- 15. Foreign Key and Query Performance Indexes
-- =========================================================

create index profiles_auth_user_id_idx on public.profiles (auth_user_id);
create index file_assets_uploaded_by_id_idx on public.file_assets (uploaded_by_id);
create index file_assets_deleted_at_idx on public.file_assets (deleted_at);
create index seasons_organization_id_idx on public.seasons (organization_id);
create index seasons_status_idx on public.seasons (status);
create index seasons_is_active_idx on public.seasons (is_active);
create index series_races_organization_id_idx on public.series_races (organization_id);
create index series_races_ballast_type_idx on public.series_races (ballast_type);
create index events_season_id_idx on public.events (season_id);
create index events_circuit_id_idx on public.events (circuit_id);
create index events_status_idx on public.events (status);
create index races_event_id_idx on public.races (event_id);
create index races_event_order_idx on public.races (event_id, race_order);
create index user_roles_profile_id_idx on public.user_roles (profile_id);
create index user_roles_role_id_idx on public.user_roles (role_id);
create index user_roles_season_id_idx on public.user_roles (season_id);
create index role_invitations_email_idx on public.role_invitations (email);
create index role_invitations_status_idx on public.role_invitations (status);
create index teams_organization_id_idx on public.teams (organization_id);
create index teams_owner_profile_id_idx on public.teams (owner_profile_id);
create index team_memberships_team_id_idx on public.team_memberships (team_id);
create index team_memberships_competitor_profile_id_idx on public.team_memberships (competitor_profile_id);
create index team_memberships_season_id_idx on public.team_memberships (season_id);
create index team_memberships_status_idx on public.team_memberships (status);
create index team_invitations_team_id_idx on public.team_invitations (team_id);
create index team_invitations_competitor_profile_id_idx on public.team_invitations (competitor_profile_id);
create index team_invitations_season_id_idx on public.team_invitations (season_id);
create index team_invitations_status_idx on public.team_invitations (status);
create index competitor_vehicles_profile_id_idx on public.competitor_vehicles (profile_id);
create index competitor_vehicles_is_active_idx on public.competitor_vehicles (is_active);
create index competitor_licenses_profile_id_idx on public.competitor_licenses (profile_id);
create index season_series_season_id_idx on public.season_series (season_id);
create index season_series_series_race_id_idx on public.season_series (series_race_id);
create index season_series_grades_season_series_id_idx on public.season_series_grades (season_series_id);
create index season_series_grades_grade_id_idx on public.season_series_grades (grade_id);
create index event_series_rules_event_id_idx on public.event_series_rules (event_id);
create index event_series_rules_series_race_id_idx on public.event_series_rules (series_race_id);
create index event_series_rules_grade_id_idx on public.event_series_rules (grade_id);
create index event_series_rules_status_idx on public.event_series_rules (status);
create index checklist_topics_event_id_idx on public.checklist_topics (event_id);
create index checklist_items_entry_form_id_idx on public.checklist_items (entry_form_id);
create index checklist_items_topic_id_idx on public.checklist_items (checklist_topic_id);
create index inspection_form_templates_rule_id_idx on public.inspection_form_templates (event_series_rule_id);
create index inspection_template_sections_template_id_idx on public.inspection_template_sections (template_id);
create index inspection_template_items_section_id_idx on public.inspection_template_items (section_id);
create index ballast_rules_rule_id_idx on public.ballast_rules (event_series_rule_id);
create index point_rules_rule_id_idx on public.point_rules (event_series_rule_id);
create index tire_rules_rule_id_idx on public.tire_rules (event_series_rule_id);
create index sponsor_sticker_assets_rule_id_idx on public.sponsor_sticker_assets (event_series_rule_id);
create index print_background_assets_event_id_idx on public.print_background_assets (event_id);
create index entry_form_batches_competitor_profile_id_idx on public.entry_form_batches (competitor_profile_id);
create index entry_form_batches_submitted_by_id_idx on public.entry_form_batches (submitted_by_id);
create index entry_form_batches_team_id_idx on public.entry_form_batches (team_id);
create index entry_forms_batch_id_idx on public.entry_forms (batch_id);
create index entry_forms_season_id_idx on public.entry_forms (season_id);
create index entry_forms_event_id_idx on public.entry_forms (event_id);
create index entry_forms_series_race_id_idx on public.entry_forms (series_race_id);
create index entry_forms_grade_id_idx on public.entry_forms (grade_id);
create index entry_forms_competitor_profile_id_idx on public.entry_forms (competitor_profile_id);
create index entry_forms_team_id_idx on public.entry_forms (team_id);
create index entry_forms_vehicle_id_idx on public.entry_forms (vehicle_id);
create index entry_forms_status_idx on public.entry_forms (status);
create index entry_forms_deleted_at_idx on public.entry_forms (deleted_at);
create index entry_forms_filters_idx on public.entry_forms (season_id, event_id, series_race_id, grade_id, status);
create index entry_form_documents_entry_form_id_idx on public.entry_form_documents (entry_form_id);
create index entry_form_documents_file_asset_id_idx on public.entry_form_documents (file_asset_id);
create index inspection_forms_entry_form_id_idx on public.inspection_forms (entry_form_id);
create index inspection_forms_template_id_idx on public.inspection_forms (template_id);
create index inspection_forms_status_idx on public.inspection_forms (status);
create index inspection_form_versions_form_id_idx on public.inspection_form_versions (inspection_form_id);
create index inspection_form_versions_status_idx on public.inspection_form_versions (status);
create index inspection_item_results_version_id_idx on public.inspection_item_results (inspection_version_id);
create index inspection_item_results_template_item_id_idx on public.inspection_item_results (template_item_id);
create index component_seals_inspection_form_id_idx on public.component_seals (inspection_form_id);
create index component_seals_vehicle_id_idx on public.component_seals (vehicle_id);
create index component_seals_component_type_idx on public.component_seals (component_type);
create index component_seals_is_active_idx on public.component_seals (is_active);
create index weigh_in_sessions_race_id_idx on public.weigh_in_sessions (race_id);
create index weigh_in_sessions_status_idx on public.weigh_in_sessions (status);
create index weigh_in_logs_session_id_idx on public.weigh_in_logs (weigh_in_session_id);
create index weigh_in_logs_entry_form_id_idx on public.weigh_in_logs (entry_form_id);
create index weigh_in_logs_inspection_form_id_idx on public.weigh_in_logs (inspection_form_id);
create index weigh_in_logs_status_idx on public.weigh_in_logs (status);
create index weigh_in_logs_weighed_at_idx on public.weigh_in_logs (weighed_at desc);
create index competitor_requests_entry_form_id_idx on public.competitor_requests (entry_form_id);
create index competitor_requests_race_id_idx on public.competitor_requests (race_id);
create index competitor_requests_requester_profile_id_idx on public.competitor_requests (requester_profile_id);
create index competitor_requests_submitted_by_id_idx on public.competitor_requests (submitted_by_id);
create index competitor_requests_status_idx on public.competitor_requests (status);
create index competitor_requests_deleted_at_idx on public.competitor_requests (deleted_at);
create index competitor_request_documents_request_id_idx on public.competitor_request_documents (competitor_request_id);
create index request_approvals_request_id_idx on public.request_approvals (competitor_request_id);
create index request_approvals_approver_profile_id_idx on public.request_approvals (approver_profile_id);
create index request_approvals_status_idx on public.request_approvals (status);
create index scrutineer_reports_race_id_idx on public.scrutineer_reports (race_id);
create index scrutineer_reports_series_race_id_idx on public.scrutineer_reports (series_race_id);
create index scrutineer_reports_grade_id_idx on public.scrutineer_reports (grade_id);
create index scrutineer_reports_status_idx on public.scrutineer_reports (status);
create index scrutineer_reports_deleted_at_idx on public.scrutineer_reports (deleted_at);
create index race_results_race_id_idx on public.race_results (race_id);
create index race_results_series_race_id_idx on public.race_results (series_race_id);
create index race_results_grade_id_idx on public.race_results (grade_id);
create index race_results_status_idx on public.race_results (status);
create index race_results_scrutineer_report_id_idx on public.race_results (scrutineer_report_id);
create index race_result_entries_result_id_idx on public.race_result_entries (race_result_id);
create index race_result_entries_entry_form_id_idx on public.race_result_entries (entry_form_id);
create index race_result_entries_position_idx on public.race_result_entries (position);
create index ballast_ledger_entry_form_id_idx on public.ballast_ledger (entry_form_id);
create index ballast_ledger_race_id_idx on public.ballast_ledger (race_id);
create index ballast_ledger_source_idx on public.ballast_ledger (source_type, source_id);
create index ballast_ledger_applies_to_next_race_idx on public.ballast_ledger (applies_to_next_race);
create index championship_standings_season_id_idx on public.championship_standings (season_id);
create index championship_standings_series_race_id_idx on public.championship_standings (series_race_id);
create index championship_standings_grade_id_idx on public.championship_standings (grade_id);
create index championship_standings_competitor_profile_id_idx on public.championship_standings (competitor_profile_id);
create index championship_standings_rank_idx on public.championship_standings (rank);
create index championship_standings_podium_counts_idx on public.championship_standings (p1_count desc, p2_count desc, p3_count desc);
create index notifications_recipient_profile_id_idx on public.notifications (recipient_profile_id);
create index notifications_unread_idx on public.notifications (recipient_profile_id, is_read, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_action_by_id_idx on public.audit_logs (action_by_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- =========================================================
-- 16. Database-Owned Integrity Triggers
-- =========================================================

-- Race eligibility must be derived from inspection status inside Postgres.
-- Frontend code must not update entry_forms.is_eligible_to_race directly.
create or replace function public.sync_entry_race_eligibility_from_inspection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.entry_forms
    set
      is_eligible_to_race = false,
      updated_by_id = coalesce(old.updated_by_id, old.created_by_id, updated_by_id),
      updated_at = now()
    where id = old.entry_form_id;

    return old;
  end if;

  if tg_op = 'UPDATE' and old.entry_form_id is distinct from new.entry_form_id then
    update public.entry_forms
    set
      is_eligible_to_race = false,
      updated_by_id = coalesce(old.updated_by_id, old.created_by_id, updated_by_id),
      updated_at = now()
    where id = old.entry_form_id;
  end if;

  update public.entry_forms
  set
    is_eligible_to_race = (new.status = 'Passed'),
    updated_by_id = coalesce(new.updated_by_id, new.created_by_id, updated_by_id),
    updated_at = now()
  where id = new.entry_form_id;

  return new;
end;
$$;

create trigger trg_sync_entry_race_eligibility_from_inspection
after insert or update or delete on public.inspection_forms
for each row
execute function public.sync_entry_race_eligibility_from_inspection();

-- Recalculate cached podium counts whenever official race result entries change.
-- These cache fields are intentionally database-owned to avoid championship errors
-- when historical race results are corrected after publishing.
create or replace function public.recalculate_championship_standing_podium_counts(
  p_season_id uuid,
  p_series_race_id uuid,
  p_grade_id uuid,
  p_competitor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p1_count integer;
  v_p2_count integer;
  v_p3_count integer;
  v_team_id uuid;
begin
  select
    count(*) filter (where rre.position = 1 and rre.result_code = 'Classified')::integer,
    count(*) filter (where rre.position = 2 and rre.result_code = 'Classified')::integer,
    count(*) filter (where rre.position = 3 and rre.result_code = 'Classified')::integer
  into v_p1_count, v_p2_count, v_p3_count
  from public.race_result_entries rre
  join public.race_results rr on rr.id = rre.race_result_id
  join public.races r on r.id = rr.race_id
  join public.events e on e.id = r.event_id
  join public.entry_forms ef on ef.id = rre.entry_form_id
  where e.season_id = p_season_id
    and rr.series_race_id = p_series_race_id
    and rr.grade_id = p_grade_id
    and ef.competitor_profile_id = p_competitor_profile_id
    and rr.is_official = true
    and rr.status in ('Official', 'Locked');

  select ef.team_id
  into v_team_id
  from public.entry_forms ef
  join public.events e on e.id = ef.event_id
  where e.season_id = p_season_id
    and ef.series_race_id = p_series_race_id
    and ef.grade_id = p_grade_id
    and ef.competitor_profile_id = p_competitor_profile_id
  order by e.event_order desc, ef.approved_at desc nulls last, ef.created_at desc nulls last
  limit 1;

  insert into public.championship_standings (
    season_id,
    series_race_id,
    grade_id,
    competitor_profile_id,
    team_id,
    p1_count,
    p2_count,
    p3_count,
    calculated_at
  ) values (
    p_season_id,
    p_series_race_id,
    p_grade_id,
    p_competitor_profile_id,
    v_team_id,
    coalesce(v_p1_count, 0),
    coalesce(v_p2_count, 0),
    coalesce(v_p3_count, 0),
    now()
  )
  on conflict (season_id, series_race_id, grade_id, competitor_profile_id)
  do update set
    team_id = coalesce(excluded.team_id, public.championship_standings.team_id),
    p1_count = excluded.p1_count,
    p2_count = excluded.p2_count,
    p3_count = excluded.p3_count,
    calculated_at = now();
end;
$$;

create or replace function public.sync_championship_podium_counts_from_result_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    for affected in
      select distinct
        e.season_id,
        rr.series_race_id,
        rr.grade_id,
        ef.competitor_profile_id
      from public.race_results rr
      join public.races r on r.id = rr.race_id
      join public.events e on e.id = r.event_id
      join public.entry_forms ef on ef.id = old.entry_form_id
      where rr.id = old.race_result_id
    loop
      perform public.recalculate_championship_standing_podium_counts(
        affected.season_id,
        affected.series_race_id,
        affected.grade_id,
        affected.competitor_profile_id
      );
    end loop;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    for affected in
      select distinct
        e.season_id,
        rr.series_race_id,
        rr.grade_id,
        ef.competitor_profile_id
      from public.race_results rr
      join public.races r on r.id = rr.race_id
      join public.events e on e.id = r.event_id
      join public.entry_forms ef on ef.id = new.entry_form_id
      where rr.id = new.race_result_id
    loop
      perform public.recalculate_championship_standing_podium_counts(
        affected.season_id,
        affected.series_race_id,
        affected.grade_id,
        affected.competitor_profile_id
      );
    end loop;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_sync_championship_podium_counts_from_result_entry
after insert or update or delete on public.race_result_entries
for each row
execute function public.sync_championship_podium_counts_from_result_entry();

-- Race result status/sign-off changes can make previously inserted entries count
-- or stop counting, so recalculate all competitors in that result.
create or replace function public.sync_championship_podium_counts_from_race_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected record;
begin
  for affected in
    select distinct
      e.season_id,
      old.series_race_id,
      old.grade_id,
      ef.competitor_profile_id
    from public.race_result_entries rre
    join public.entry_forms ef on ef.id = rre.entry_form_id
    join public.races r on r.id = old.race_id
    join public.events e on e.id = r.event_id
    where rre.race_result_id = old.id
  loop
    perform public.recalculate_championship_standing_podium_counts(
      affected.season_id,
      affected.series_race_id,
      affected.grade_id,
      affected.competitor_profile_id
    );
  end loop;

  for affected in
    select distinct
      e.season_id,
      new.series_race_id,
      new.grade_id,
      ef.competitor_profile_id
    from public.race_result_entries rre
    join public.entry_forms ef on ef.id = rre.entry_form_id
    join public.races r on r.id = new.race_id
    join public.events e on e.id = r.event_id
    where rre.race_result_id = new.id
  loop
    perform public.recalculate_championship_standing_podium_counts(
      affected.season_id,
      affected.series_race_id,
      affected.grade_id,
      affected.competitor_profile_id
    );
  end loop;

  return new;
end;
$$;

create trigger trg_sync_championship_podium_counts_from_race_result
after update of status, is_official, race_id, series_race_id, grade_id on public.race_results
for each row
execute function public.sync_championship_podium_counts_from_race_result();

-- =========================================================
-- 17. Documentation Comments
-- =========================================================

comment on table public.profiles is 'Application profile wrapper for Supabase auth.users.';
comment on table public.user_roles is 'Many-to-many RBAC assignments. season_id NULL means global role.';
comment on table public.entry_form_batches is 'Submission batch that can spawn one entry_form per selected event.';
comment on table public.entry_forms is 'Event-specific locked racing entry form snapshot.';
comment on column public.entry_forms.is_eligible_to_race is 'Database-owned race eligibility cache. Synced from inspection_forms.status by trigger.';
comment on index public.entry_forms_one_active_per_competitor_event_uk is 'Prevents multiple Active entry forms per competitor per event.';
comment on table public.event_series_rules is 'Dynamic event/series/grade rule anchor for inspection, ballast, points, tires, stickers.';
comment on table public.inspection_forms is 'One inspection form per event-specific entry form.';
comment on table public.inspection_form_versions is 'Immutable inspection versions for audit and schema-history safety.';
comment on table public.weigh_in_logs is 'Weight-in log with full target weight calculation breakdown.';
comment on table public.competitor_requests is 'Competitor request workflow including consent, committee approvals, fines, penalties.';
comment on table public.scrutineer_reports is 'Official technical report interlock before race results become official.';
comment on column public.championship_standings.p1_count is 'Database-owned cached P1 count. Synced from official race_result_entries by trigger.';
comment on column public.championship_standings.p2_count is 'Database-owned cached P2 count. Synced from official race_result_entries by trigger.';
comment on column public.championship_standings.p3_count is 'Database-owned cached P3 count. Synced from official race_result_entries by trigger.';
comment on column public.file_assets.deleted_at is 'Soft delete marker only. Physical Storage garbage collection is intentionally deferred for V1.';
comment on table public.audit_logs is 'System-wide audit trail target for triggers/RPCs in later phases.';

commit;
