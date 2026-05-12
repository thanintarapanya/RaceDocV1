-- RaceDocV1 Entry Form Phase 4 seed data and read RPCs.
-- Applied to Supabase as migration: seed_entry_form_master_data_and_rpcs
--
-- Purpose:
-- 1. Seed the first active PT Maxnitron season/event/class options for Entry Form Step 1.
-- 2. Expose secure read RPCs so the frontend does not depend on direct table access.
-- 3. Respect live database shape, where series and grade are represented by
--    event_series_configs.series_class values such as "SIAM ECO - Pro".

with circuit_seed as (
  insert into public.circuits (name, country, default_layout)
  values ('PT Maxnitron Official Circuit', 'TH', 'Official Layout')
  on conflict do nothing
  returning id
), selected_circuit as (
  select id from circuit_seed
  union all
  select id from public.circuits where name = 'PT Maxnitron Official Circuit'
  limit 1
), season_seed as (
  insert into public.seasons (
    name,
    year,
    status,
    is_active,
    series_rules,
    event_race_format
  )
  values (
    'PT Maxnitron 2026',
    2026,
    'active'::public.season_status,
    true,
    '{"items":[{"series":"SIAM ECO","grades":["Pro","Am"]},{"series":"SIAM TRUCK","grades":["Pro","Am"]}]}'::jsonb,
    '{"items":[{"event":"Event 1","races":3},{"event":"Event 2","races":2},{"event":"Event 3","races":2}]}'::jsonb
  )
  on conflict do nothing
  returning id
), selected_season as (
  select id from season_seed
  union all
  select id from public.seasons where name = 'PT Maxnitron 2026' and year = 2026
  limit 1
), event_seed as (
  insert into public.events (
    season_id,
    circuit_id,
    name,
    event_order,
    start_date,
    end_date,
    status
  )
  select
    selected_season.id,
    selected_circuit.id,
    'Event 1',
    1,
    '2026-06-05 09:00:00+07'::timestamptz,
    '2026-06-07 18:00:00+07'::timestamptz,
    'registration_open'::public.event_status
  from selected_season
  cross join selected_circuit
  on conflict do nothing
  returning id
), selected_event as (
  select id from event_seed
  union all
  select e.id
  from public.events e
  join selected_season s on s.id = e.season_id
  where e.name = 'Event 1'
  limit 1
)
insert into public.event_series_configs (
  event_id,
  series_class,
  checklist_schema,
  inspection_schema,
  weight_ballast_schema,
  points_schema,
  request_routing_schema
)
select
  selected_event.id,
  series_class,
  '{"items": []}'::jsonb,
  '{"sections": []}'::jsonb,
  '{"items": []}'::jsonb,
  '{"items": []}'::jsonb,
  '{"items": []}'::jsonb
from selected_event
cross join (
  values
    ('SIAM ECO - Pro'),
    ('SIAM ECO - Am'),
    ('SIAM TRUCK - Pro'),
    ('SIAM TRUCK - Am')
) as classes(series_class)
where not exists (
  select 1
  from public.event_series_configs esc
  where esc.event_id = selected_event.id
    and esc.series_class = classes.series_class
);

create or replace function public.get_entry_form_step1_options()
returns table (
  season_id uuid,
  season_name text,
  season_year integer,
  event_id uuid,
  event_name text,
  event_order integer,
  event_status text,
  config_id uuid,
  series_class text,
  series_name text,
  grade_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as season_id,
    s.name as season_name,
    s.year as season_year,
    e.id as event_id,
    e.name as event_name,
    e.event_order,
    e.status::text as event_status,
    esc.id as config_id,
    esc.series_class,
    split_part(esc.series_class, ' - ', 1) as series_name,
    split_part(esc.series_class, ' - ', 2) as grade_name
  from public.seasons s
  join public.events e on e.season_id = s.id
  join public.event_series_configs esc on esc.event_id = e.id
  where s.is_active = true
    and s.status = 'active'::public.season_status
    and e.status in ('registration_open'::public.event_status, 'ongoing'::public.event_status)
  order by s.year desc, e.event_order asc, esc.series_class asc;
$$;

create or replace function public.get_my_entry_forms()
returns table (
  id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    en.id,
    ev.name as event_name,
    s.year as season_year,
    esc.series_class,
    en.car_number,
    en.status::text as status,
    en.created_at
  from public.entries en
  join public.events ev on ev.id = en.event_id
  join public.seasons s on s.id = en.season_id
  join public.event_series_configs esc on esc.id = en.event_series_config_id
  where en.deleted_at is null
    and (
      en.competitor_user_id = auth.uid()
      or en.team_manager_id = auth.uid()
      or exists (
        select 1
        from public.role_assignments ra
        where ra.user_id = auth.uid()
          and ra.role_code in ('ADMIN'::public.role_code, 'SECRETARY'::public.role_code)
      )
    )
  order by en.created_at desc;
$$;

revoke all on function public.get_entry_form_step1_options() from public, anon;
revoke all on function public.get_my_entry_forms() from public, anon;
grant execute on function public.get_entry_form_step1_options() to authenticated;
grant execute on function public.get_my_entry_forms() to authenticated;
