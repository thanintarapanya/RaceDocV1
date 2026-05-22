-- RaceDocV1 Organizer Settings Weight Rule Foundation
-- Purpose: Admin-managed BOP/base-weight rules scoped to Event Rules.
-- Apply after RaceDocV1_Supabase_Organizer_Settings_Print_Backgrounds.sql.

create table if not exists public.weight_rules (
  id uuid primary key default gen_random_uuid(),
  event_series_rule_id uuid not null references public.event_series_rules(id) on delete cascade,
  name text not null,
  engine_min_cc integer,
  engine_max_cc integer,
  base_weight_kg numeric not null,
  additional_weight_rules jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_rules_engine_min_non_negative_chk check (engine_min_cc is null or engine_min_cc >= 0),
  constraint weight_rules_engine_max_non_negative_chk check (engine_max_cc is null or engine_max_cc >= 0),
  constraint weight_rules_engine_range_chk check (engine_min_cc is null or engine_max_cc is null or engine_min_cc <= engine_max_cc),
  constraint weight_rules_base_weight_non_negative_chk check (base_weight_kg >= 0),
  constraint weight_rules_sort_order_non_negative_chk check (sort_order >= 0),
  constraint weight_rules_additional_weight_rules_array_chk check (jsonb_typeof(additional_weight_rules) = 'array'),
  constraint weight_rules_rule_name_uk unique (event_series_rule_id, name)
);

create index if not exists weight_rules_event_series_rule_id_idx
  on public.weight_rules (event_series_rule_id);

create index if not exists weight_rules_active_sort_idx
  on public.weight_rules (event_series_rule_id, is_active, sort_order);

alter table public.weight_rules enable row level security;

drop policy if exists weight_rules_authenticated_read on public.weight_rules;
drop policy if exists weight_rules_admin_all on public.weight_rules;

create policy weight_rules_authenticated_read
on public.weight_rules for select to authenticated
using (true);

create policy weight_rules_admin_all
on public.weight_rules for all to authenticated
using (public.has_role('ADMIN', null))
with check (public.has_role('ADMIN', null));

grant select on public.weight_rules to authenticated, service_role;
grant insert, update, delete on public.weight_rules to authenticated, service_role;

create or replace function public.touch_weight_rules_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists weight_rules_touch_updated_at on public.weight_rules;
create trigger weight_rules_touch_updated_at
before update on public.weight_rules
for each row execute function public.touch_weight_rules_updated_at();

create or replace function public.get_organizer_weight_rules()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.has_role('ADMIN', null) then '[]'::jsonb
    else coalesce(jsonb_agg(jsonb_build_object(
      'weightRuleId', wr.id,
      'eventSeriesRuleId', wr.event_series_rule_id,
      'eventId', e.id,
      'eventName', e.name,
      'seriesRaceId', sr.id,
      'seriesName', sr.name,
      'gradeId', g.id,
      'gradeName', g.name,
      'name', wr.name,
      'engineMinCc', wr.engine_min_cc,
      'engineMaxCc', wr.engine_max_cc,
      'baseWeightKg', wr.base_weight_kg,
      'additionalWeightRules', wr.additional_weight_rules,
      'isActive', wr.is_active,
      'sortOrder', wr.sort_order
    ) order by e.event_order, sr.name, g.sort_order, wr.sort_order, wr.name), '[]'::jsonb)
  end
  from public.weight_rules wr
  join public.event_series_rules esr on esr.id = wr.event_series_rule_id
  join public.events e on e.id = esr.event_id
  join public.series_races sr on sr.id = esr.series_race_id
  join public.grades g on g.id = esr.grade_id;
$$;

create or replace function public.save_organizer_weight_rule(
  p_weight_rule_id uuid default null,
  p_event_series_rule_id uuid default null,
  p_name text default null,
  p_engine_min_cc integer default null,
  p_engine_max_cc integer default null,
  p_base_weight_kg numeric default null,
  p_additional_weight_rules jsonb default '[]'::jsonb,
  p_is_active boolean default true,
  p_sort_order integer default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_event_rule public.event_series_rules%rowtype;
  v_weight_rule_id uuid;
  v_name text;
  v_additional_weight_rules jsonb := coalesce(p_additional_weight_rules, '[]'::jsonb);
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_role('ADMIN', null) then
    raise exception 'Only Admin can manage organizer settings.';
  end if;

  select * into v_event_rule from public.event_series_rules where id = p_event_series_rule_id;
  if v_event_rule.id is null then
    raise exception 'Event Rule was not found.';
  end if;

  if v_event_rule.is_locked then
    raise exception 'Locked Event Rules cannot be changed.';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    raise exception 'Weight rule name is required.';
  end if;

  if p_base_weight_kg is null or p_base_weight_kg < 0 then
    raise exception 'Base weight must be zero or greater.';
  end if;

  if p_engine_min_cc is not null and p_engine_min_cc < 0 then
    raise exception 'Minimum engine CC cannot be negative.';
  end if;

  if p_engine_max_cc is not null and p_engine_max_cc < 0 then
    raise exception 'Maximum engine CC cannot be negative.';
  end if;

  if p_engine_min_cc is not null and p_engine_max_cc is not null and p_engine_min_cc > p_engine_max_cc then
    raise exception 'Minimum engine CC cannot be greater than maximum engine CC.';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'Sort order must be zero or greater.';
  end if;

  if jsonb_typeof(v_additional_weight_rules) <> 'array' then
    raise exception 'Additional weight rules must be a JSON array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_additional_weight_rules) as rule_item
    where jsonb_typeof(rule_item) <> 'object'
  ) then
    raise exception 'Each additional weight rule must be a JSON object.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_additional_weight_rules) as rule_item
    where rule_item ? 'weightKg'
      and (
        jsonb_typeof(rule_item -> 'weightKg') <> 'number'
        or (rule_item ->> 'weightKg')::numeric < 0
      )
  ) then
    raise exception 'Additional weight rule weightKg values must be non-negative numbers.';
  end if;

  if p_weight_rule_id is not null then
    select to_jsonb(wr.*) into v_old_values
    from public.weight_rules wr
    where wr.id = p_weight_rule_id;

    if v_old_values is null then
      raise exception 'Weight rule was not found.';
    end if;

    update public.weight_rules
    set event_series_rule_id = p_event_series_rule_id,
        name = v_name,
        engine_min_cc = p_engine_min_cc,
        engine_max_cc = p_engine_max_cc,
        base_weight_kg = p_base_weight_kg,
        additional_weight_rules = v_additional_weight_rules,
        is_active = coalesce(p_is_active, true),
        sort_order = p_sort_order
    where id = p_weight_rule_id
    returning id, to_jsonb(public.weight_rules.*) into v_weight_rule_id, v_new_values;
  else
    insert into public.weight_rules (
      event_series_rule_id,
      name,
      engine_min_cc,
      engine_max_cc,
      base_weight_kg,
      additional_weight_rules,
      is_active,
      sort_order
    ) values (
      p_event_series_rule_id,
      v_name,
      p_engine_min_cc,
      p_engine_max_cc,
      p_base_weight_kg,
      v_additional_weight_rules,
      coalesce(p_is_active, true),
      p_sort_order
    ) returning id, to_jsonb(public.weight_rules.*) into v_weight_rule_id, v_new_values;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('weight_rule', v_weight_rule_id, case when p_weight_rule_id is null then 'create' else 'update' end, v_old_values, v_new_values, v_actor_profile_id);

  return v_weight_rule_id;
end;
$$;

revoke execute on function public.get_organizer_weight_rules() from public, anon;
revoke execute on function public.save_organizer_weight_rule(uuid, uuid, text, integer, integer, numeric, jsonb, boolean, integer) from public, anon;

grant execute on function public.get_organizer_weight_rules() to authenticated, service_role;
grant execute on function public.save_organizer_weight_rule(uuid, uuid, text, integer, integer, numeric, jsonb, boolean, integer) to authenticated, service_role;
