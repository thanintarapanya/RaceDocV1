-- RaceDocV1 Weight-In Workflow
-- Purpose: first functional Weight-In slice using real races, sessions,
-- Inspection BOP values, ballast ledger, and append-only weigh logs.

begin;

-- Seed one open weigh-in session for each race so the tab has real race context.
insert into public.weigh_in_sessions (race_id, session_type, status, opened_at)
select r.id, r.session_type, 'Open'::public.weigh_in_session_status, now()
from public.races r
where not exists (
  select 1
  from public.weigh_in_sessions wis
  where wis.race_id = r.id
    and wis.session_type = r.session_type
);

create index if not exists weigh_in_logs_session_entry_time_idx
  on public.weigh_in_logs (weigh_in_session_id, entry_form_id, weighed_at desc);

create index if not exists weigh_in_logs_weighed_by_id_idx
  on public.weigh_in_logs (weighed_by_id);

create index if not exists ballast_ledger_entry_race_idx
  on public.ballast_ledger (entry_form_id, race_id);

create or replace function public.get_weight_in_sessions()
returns table(
  session_id uuid,
  race_id uuid,
  event_name text,
  race_name text,
  race_order integer,
  session_type text,
  status text,
  scheduled_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wis.id as session_id,
    r.id as race_id,
    e.name as event_name,
    r.name as race_name,
    r.race_order,
    wis.session_type,
    wis.status::text,
    r.scheduled_at,
    wis.opened_at,
    wis.closed_at
  from public.weigh_in_sessions wis
  join public.races r on r.id = wis.race_id
  join public.events e on e.id = r.event_id
  where public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK', 'TEAM_MANAGER', 'COMPETITOR'], null)
  order by e.event_order, r.race_order, wis.session_type;
$$;

create or replace function public.get_weight_in_entries(p_session_id uuid)
returns table(
  entry_id uuid,
  weigh_in_session_id uuid,
  latest_log_id uuid,
  event_name text,
  race_name text,
  session_type text,
  season_year integer,
  series_class text,
  car_number text,
  competitor_name text,
  competitor_email text,
  vehicle_summary text,
  inspection_status text,
  bop_base_weight_kg numeric,
  bop_option_weight_kg numeric,
  success_ballast_kg numeric,
  penalty_weight_kg numeric,
  join_weight_kg numeric,
  target_weight_kg numeric,
  actual_weight_kg numeric,
  status text,
  missing_weight_kg numeric,
  weighed_at timestamptz,
  weighed_by_name text,
  can_edit boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) as can_operate,
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK'], null) as can_read_all
  ), session_row as (
    select wis.*, r.event_id, r.name as race_name, e.name as event_name
    from public.weigh_in_sessions wis
    join public.races r on r.id = wis.race_id
    join public.events e on e.id = r.event_id
    where wis.id = p_session_id
  ), latest_inspection as (
    select distinct on (inf.entry_form_id)
      inf.entry_form_id,
      inf.id as inspection_form_id,
      inf.status,
      coalesce(ifv.bop_base_weight_kg, inf.official_bop_weight_kg, 0) as bop_base_weight_kg,
      coalesce(ifv.bop_option_weight_kg, 0) as bop_option_weight_kg
    from public.inspection_forms inf
    left join public.inspection_form_versions ifv
      on ifv.inspection_form_id = inf.id
     and ifv.version_no = inf.current_version_no
    order by inf.entry_form_id, inf.current_version_no desc
  ), ballast as (
    select
      bl.entry_form_id,
      coalesce(sum(bl.ballast_kg) filter (where bl.source_type = 'SuccessBallast'), 0) as success_ballast_kg,
      coalesce(sum(bl.ballast_kg) filter (where bl.source_type = 'Penalty'), 0) as penalty_weight_kg,
      coalesce(sum(bl.ballast_kg) filter (where bl.source_type = 'JoinWeight'), 0) as join_weight_kg
    from public.ballast_ledger bl
    join session_row sr on true
    where bl.applies_to_next_race = true
      and (bl.race_id is null or bl.race_id = sr.race_id)
    group by bl.entry_form_id
  ), latest_log as (
    select distinct on (wil.entry_form_id)
      wil.*,
      coalesce(nullif(btrim(concat_ws(' ', wp.first_name_th, wp.last_name_th)), ''), nullif(btrim(concat_ws(' ', wp.first_name_en, wp.last_name_en)), ''), 'Official') as weighed_by_name
    from public.weigh_in_logs wil
    left join public.profiles wp on wp.id = wil.weighed_by_id
    where wil.weigh_in_session_id = p_session_id
    order by wil.entry_form_id, wil.weighed_at desc, wil.id desc
  )
  select
    ef.id as entry_id,
    sr.id as weigh_in_session_id,
    ll.id as latest_log_id,
    sr.event_name,
    sr.race_name,
    sr.session_type,
    s.year as season_year,
    ser.name || ' - ' || g.name as series_class,
    ef.car_number,
    coalesce(
      nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''),
      nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''),
      au.email,
      'Competitor'
    ) as competitor_name,
    coalesce(au.email, '') as competitor_email,
    nullif(btrim(concat_ws(' ', ef.vehicle_snapshot ->> 'manufacturer', ef.vehicle_snapshot ->> 'model')), '') as vehicle_summary,
    coalesce(li.status::text, 'NotInspected') as inspection_status,
    coalesce(li.bop_base_weight_kg, 0) as bop_base_weight_kg,
    coalesce(li.bop_option_weight_kg, 0) as bop_option_weight_kg,
    coalesce(b.success_ballast_kg, 0) as success_ballast_kg,
    coalesce(b.penalty_weight_kg, 0) as penalty_weight_kg,
    coalesce(b.join_weight_kg, 0) as join_weight_kg,
    coalesce(ll.target_weight_kg, coalesce(li.bop_base_weight_kg, 0) + coalesce(li.bop_option_weight_kg, 0) + coalesce(b.success_ballast_kg, 0) + coalesce(b.penalty_weight_kg, 0) + coalesce(b.join_weight_kg, 0)) as target_weight_kg,
    ll.actual_weight_kg,
    coalesce(ll.status::text, 'Pending') as status,
    case
      when ll.actual_weight_kg is null then null
      when ll.actual_weight_kg >= ll.target_weight_kg then 0
      else ll.target_weight_kg - ll.actual_weight_kg
    end as missing_weight_kg,
    ll.weighed_at,
    ll.weighed_by_name,
    ctx.can_operate as can_edit
  from session_row sr
  join public.entry_forms ef on ef.event_id = sr.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races ser on ser.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles p on p.id = ef.competitor_profile_id
  left join auth.users au on au.id = p.auth_user_id
  left join latest_inspection li on li.entry_form_id = ef.id
  left join ballast b on b.entry_form_id = ef.id
  left join latest_log ll on ll.entry_form_id = ef.id
  cross join ctx
  where ef.deleted_at is null
    and ef.status = 'Active'::public.entry_form_status
    and (ctx.can_read_all or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))
  order by ser.name, g.sort_order, ef.car_number;
$$;

create or replace function public.save_weigh_in_log(
  p_session_id uuid,
  p_entry_id uuid,
  p_actual_weight_kg numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_session public.weigh_in_sessions%rowtype;
  v_entry public.entry_forms%rowtype;
  v_inspection_form_id uuid;
  v_bop_base numeric := 0;
  v_bop_option numeric := 0;
  v_success numeric := 0;
  v_penalty numeric := 0;
  v_join numeric := 0;
  v_target numeric := 0;
  v_status public.weigh_in_status;
  v_log_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) then
    raise exception 'Only officials can save Weight-In logs.';
  end if;

  if p_actual_weight_kg is null or p_actual_weight_kg < 0 then
    raise exception 'Actual weight must be a non-negative number.';
  end if;

  select * into v_session
  from public.weigh_in_sessions
  where id = p_session_id;

  if v_session.id is null then
    raise exception 'Weight-In session was not found.';
  end if;

  if v_session.status <> 'Open'::public.weigh_in_session_status then
    raise exception 'Weight-In session is not open.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = p_entry_id
    and deleted_at is null;

  if v_entry.id is null then
    raise exception 'Entry Form was not found.';
  end if;

  if v_entry.status <> 'Active'::public.entry_form_status then
    raise exception 'Only Active Entry Forms can be weighed.';
  end if;

  select
    inf.id,
    coalesce(ifv.bop_base_weight_kg, inf.official_bop_weight_kg, 0),
    coalesce(ifv.bop_option_weight_kg, 0)
  into v_inspection_form_id, v_bop_base, v_bop_option
  from public.inspection_forms inf
  left join public.inspection_form_versions ifv
    on ifv.inspection_form_id = inf.id
   and ifv.version_no = inf.current_version_no
  where inf.entry_form_id = p_entry_id
  order by inf.current_version_no desc
  limit 1;

  select
    coalesce(sum(ballast_kg) filter (where source_type = 'SuccessBallast'), 0),
    coalesce(sum(ballast_kg) filter (where source_type = 'Penalty'), 0),
    coalesce(sum(ballast_kg) filter (where source_type = 'JoinWeight'), 0)
  into v_success, v_penalty, v_join
  from public.ballast_ledger
  where entry_form_id = p_entry_id
    and applies_to_next_race = true
    and (race_id is null or race_id = v_session.race_id);

  v_target := coalesce(v_bop_base, 0) + coalesce(v_bop_option, 0) + coalesce(v_success, 0) + coalesce(v_penalty, 0) + coalesce(v_join, 0);
  v_status := case when p_actual_weight_kg >= v_target then 'Passed'::public.weigh_in_status else 'Failed'::public.weigh_in_status end;

  insert into public.weigh_in_logs (
    weigh_in_session_id,
    entry_form_id,
    inspection_form_id,
    bop_base_weight_kg,
    bop_option_weight_kg,
    success_ballast_kg,
    penalty_weight_kg,
    join_weight_kg,
    target_weight_kg,
    actual_weight_kg,
    status,
    weighed_by_id,
    weighed_at
  ) values (
    p_session_id,
    p_entry_id,
    v_inspection_form_id,
    coalesce(v_bop_base, 0),
    coalesce(v_bop_option, 0),
    coalesce(v_success, 0),
    coalesce(v_penalty, 0),
    coalesce(v_join, 0),
    v_target,
    p_actual_weight_kg,
    v_status,
    v_actor_profile_id,
    now()
  ) returning id into v_log_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
  values (
    'weigh_in_log',
    v_log_id,
    'save_actual_weight',
    jsonb_build_object('entry_form_id', p_entry_id, 'target_weight_kg', v_target, 'actual_weight_kg', p_actual_weight_kg),
    v_status::text,
    v_actor_profile_id
  );

  return v_log_id;
end;
$$;

revoke execute on function public.get_weight_in_sessions() from public, anon;
revoke execute on function public.get_weight_in_entries(uuid) from public, anon;
revoke execute on function public.save_weigh_in_log(uuid, uuid, numeric) from public, anon;

grant execute on function public.get_weight_in_sessions() to authenticated, service_role;
grant execute on function public.get_weight_in_entries(uuid) to authenticated, service_role;
grant execute on function public.save_weigh_in_log(uuid, uuid, numeric) to authenticated, service_role;

commit;
