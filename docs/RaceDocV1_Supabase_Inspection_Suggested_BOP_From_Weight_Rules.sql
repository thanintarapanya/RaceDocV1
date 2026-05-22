-- RaceDocV1 Inspection Suggested BOP from Organizer Weight Rules
-- Purpose: Surface Admin-configured BOP suggestions in Inspection without removing official override.
-- Apply after RaceDocV1_Supabase_Organizer_Settings_Weight_Rules.sql.

create or replace function public.parse_vehicle_engine_size_cc(p_vehicle_snapshot jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(regexp_replace(coalesce(
      p_vehicle_snapshot ->> 'engineSizeCc',
      p_vehicle_snapshot ->> 'engine_size_cc',
      p_vehicle_snapshot ->> 'engineSize',
      p_vehicle_snapshot ->> 'engine_size'
    ), '[^0-9.]', '', 'g'), '') is null then null::numeric
    else nullif(regexp_replace(coalesce(
      p_vehicle_snapshot ->> 'engineSizeCc',
      p_vehicle_snapshot ->> 'engine_size_cc',
      p_vehicle_snapshot ->> 'engineSize',
      p_vehicle_snapshot ->> 'engine_size'
    ), '[^0-9.]', '', 'g'), '')::numeric
  end;
$$;

create or replace function public.sum_weight_rule_additional_kg(p_rules jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select coalesce(sum((item ->> 'weightKg')::numeric), 0)
  from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) as item
  where jsonb_typeof(item) = 'object'
    and item ? 'weightKg'
    and jsonb_typeof(item -> 'weightKg') = 'number'
    and (item ->> 'weightKg')::numeric >= 0;
$$;

drop function if exists public.get_inspection_form_entries();

create or replace function public.get_inspection_form_entries()
returns table(
  entry_id uuid,
  inspection_form_id uuid,
  template_id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  competitor_name text,
  competitor_email text,
  status text,
  official_bop_weight_kg numeric,
  suggested_bop_base_weight_kg numeric,
  suggested_bop_option_weight_kg numeric,
  suggested_bop_total_weight_kg numeric,
  suggested_weight_rule_name text,
  engine_size_cc numeric,
  current_version_no integer,
  submitted_at timestamptz,
  is_eligible_to_race boolean,
  vehicle_summary text,
  can_create boolean,
  can_update_status boolean,
  can_offsite_inspect boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.current_profile_id() as profile_id,
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK'], null) as can_read_all,
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) as can_operate,
      public.has_role('OFFSITE_SCRUTINEER', null) as can_offsite
  ), active_templates as (
    select distinct on (event_series_rule_id)
      id,
      event_series_rule_id
    from public.inspection_form_templates
    where is_active = true
    order by event_series_rule_id, version desc
  ), entry_rows as (
    select
      ef.*,
      public.parse_vehicle_engine_size_cc(ef.vehicle_snapshot) as parsed_engine_size_cc
    from public.entry_forms ef
  )
  select
    ef.id as entry_id,
    inf.id as inspection_form_id,
    at.id as template_id,
    ev.name as event_name,
    s.year as season_year,
    sr.name || ' - ' || g.name as series_class,
    ef.car_number,
    coalesce(
      nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''),
      nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''),
      au.email,
      'Competitor'
    ) as competitor_name,
    coalesce(au.email, '') as competitor_email,
    coalesce(inf.status::text, 'NotCreated') as status,
    inf.official_bop_weight_kg,
    suggested_weight_rule.base_weight_kg as suggested_bop_base_weight_kg,
    public.sum_weight_rule_additional_kg(suggested_weight_rule.additional_weight_rules) as suggested_bop_option_weight_kg,
    suggested_weight_rule.base_weight_kg + public.sum_weight_rule_additional_kg(suggested_weight_rule.additional_weight_rules) as suggested_bop_total_weight_kg,
    suggested_weight_rule.name as suggested_weight_rule_name,
    ef.parsed_engine_size_cc as engine_size_cc,
    coalesce(inf.current_version_no, 0) as current_version_no,
    inf.submitted_at,
    ef.is_eligible_to_race,
    nullif(btrim(concat_ws(' ', ef.vehicle_snapshot ->> 'manufacturer', ef.vehicle_snapshot ->> 'model')), '') as vehicle_summary,
    (at.id is not null and inf.id is null and (ctx.can_operate or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))) as can_create,
    ctx.can_operate as can_update_status,
    ctx.can_offsite as can_offsite_inspect
  from entry_rows ef
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles p on p.id = ef.competitor_profile_id
  left join auth.users au on au.id = p.auth_user_id
  left join public.inspection_forms inf on inf.entry_form_id = ef.id
  left join active_templates at on at.event_series_rule_id = ef.event_series_rule_id
  left join lateral (
    select wr.*
    from public.weight_rules wr
    where wr.event_series_rule_id = ef.event_series_rule_id
      and wr.is_active = true
      and (wr.engine_min_cc is null or ef.parsed_engine_size_cc is null or wr.engine_min_cc <= ef.parsed_engine_size_cc)
      and (wr.engine_max_cc is null or ef.parsed_engine_size_cc is null or wr.engine_max_cc >= ef.parsed_engine_size_cc)
    order by
      case when ef.parsed_engine_size_cc is null then 1 else 0 end,
      wr.engine_min_cc nulls first,
      wr.engine_max_cc nulls last,
      wr.sort_order,
      wr.name
    limit 1
  ) suggested_weight_rule on true
  cross join ctx
  where ef.deleted_at is null
    and ef.status = 'Active'::public.entry_form_status
    and (ctx.can_read_all or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))
  order by s.year desc, ev.event_order, sr.name, g.sort_order, ef.car_number;
$$;

revoke execute on function public.parse_vehicle_engine_size_cc(jsonb) from public, anon;
revoke execute on function public.sum_weight_rule_additional_kg(jsonb) from public, anon;
revoke execute on function public.get_inspection_form_entries() from public, anon;

grant execute on function public.parse_vehicle_engine_size_cc(jsonb) to authenticated, service_role;
grant execute on function public.sum_weight_rule_additional_kg(jsonb) to authenticated, service_role;
grant execute on function public.get_inspection_form_entries() to authenticated, service_role;
