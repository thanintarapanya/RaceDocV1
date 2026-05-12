-- RaceDocV1 Inspection Form Workflow
-- Purpose: first functional Inspection Form slice using the existing dynamic
-- template/version schema. This seeds starter templates and exposes safe RPCs
-- for list, create, and official status updates.

begin;

-- Existing helper functions used display labels in some environments. Pin them
-- to the seeded role codes so RLS and RPC checks remain deterministic.
create or replace function public.is_head_scrutineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('HEAD_SCRUTINEER', null);
$$;

create or replace function public.is_scrutineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null);
$$;

-- Seed a conservative baseline template for every active/locked event-series rule
-- that does not already have an inspection template. Admin can replace/extend this
-- later through the full Form Builder phase.
with rules_without_template as (
  select esr.id as event_series_rule_id
  from public.event_series_rules esr
  where esr.status in ('Active'::public.rule_status, 'Locked'::public.rule_status)
    and not exists (
      select 1
      from public.inspection_form_templates ift
      where ift.event_series_rule_id = esr.id
    )
), inserted_templates as (
  insert into public.inspection_form_templates (event_series_rule_id, name, version, is_active)
  select event_series_rule_id, 'Baseline Trackside Inspection', 1, true
  from rules_without_template
  returning id
), inserted_sections as (
  insert into public.inspection_template_sections (template_id, code, title, sort_order, is_fixed)
  select t.id, s.code, s.title, s.sort_order, true
  from inserted_templates t
  cross join (values
    ('driver', 'Driver', 10),
    ('car', 'Car', 20),
    ('weight', 'Weight', 30),
    ('safety', 'Safety', 40),
    ('seal', 'Seal', 50),
    ('review', 'Review', 60)
  ) as s(code, title, sort_order)
  returning id, template_id, code
)
insert into public.inspection_template_items (
  section_id,
  label_th,
  label_en,
  input_type,
  options,
  weight_effect_type,
  fixed_weight_kg,
  is_required,
  sort_order
)
select s.id, i.label_th, i.label_en, i.input_type::public.inspection_input_type, '[]'::jsonb,
       i.weight_effect_type::public.weight_effect_type, i.fixed_weight_kg, i.is_required, i.sort_order
from inserted_sections s
join (values
  ('driver', 'ยืนยันตัวนักแข่ง', 'Driver identity confirmed', 'Checkbox', 'None', null::numeric, true, 10),
  ('driver', 'ตรวจใบอนุญาตขับแข่ง', 'Competition license verified', 'Checkbox', 'None', null::numeric, true, 20),
  ('car', 'หมายเลขรถตรงกับ Entry Form', 'Car number matches Entry Form', 'Checkbox', 'None', null::numeric, true, 10),
  ('car', 'ข้อมูลรถตรงกับรถจริง', 'Vehicle matches declared data', 'Checkbox', 'None', null::numeric, true, 20),
  ('weight', 'น้ำหนัก BOP ฐาน', 'Base BOP weight', 'Number', 'Vary', null::numeric, false, 10),
  ('weight', 'น้ำหนักอุปกรณ์เพิ่มเติม', 'Option weight', 'Number', 'Vary', null::numeric, false, 20),
  ('safety', 'ชุดแข่งและหมวกกันน็อค', 'Racing suit and helmet checked', 'Checkbox', 'None', null::numeric, true, 10),
  ('safety', 'เข็มขัดนิรภัย/เบาะ', 'Harness and seat checked', 'Checkbox', 'None', null::numeric, true, 20),
  ('safety', 'ถังดับเพลิง', 'Fire extinguisher checked', 'Checkbox', 'None', null::numeric, true, 30),
  ('safety', 'สวิตช์ตัดไฟ', 'Battery cut-off checked', 'Checkbox', 'None', null::numeric, true, 40),
  ('seal', 'หมายเลขซีลเครื่องยนต์', 'Engine seal number', 'Text Input', 'None', null::numeric, false, 10),
  ('seal', 'หมายเลขซีลเกียร์', 'Gear seal number', 'Text Input', 'None', null::numeric, false, 20),
  ('seal', 'ตรวจนอกสถานที่', 'Off-site inspected', 'Checkbox', 'None', null::numeric, false, 30),
  ('review', 'หมายเหตุผลการตรวจ', 'Inspection issue note', 'Text Input', 'None', null::numeric, false, 10)
) as i(section_code, label_th, label_en, input_type, weight_effect_type, fixed_weight_kg, is_required, sort_order)
  on i.section_code = s.code;

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
    coalesce(inf.current_version_no, 0) as current_version_no,
    inf.submitted_at,
    ef.is_eligible_to_race,
    nullif(btrim(concat_ws(' ', ef.vehicle_snapshot ->> 'manufacturer', ef.vehicle_snapshot ->> 'model')), '') as vehicle_summary,
    (at.id is not null and inf.id is null and (ctx.can_operate or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))) as can_create,
    ctx.can_operate as can_update_status,
    ctx.can_offsite as can_offsite_inspect
  from public.entry_forms ef
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles p on p.id = ef.competitor_profile_id
  left join auth.users au on au.id = p.auth_user_id
  left join public.inspection_forms inf on inf.entry_form_id = ef.id
  left join active_templates at on at.event_series_rule_id = ef.event_series_rule_id
  cross join ctx
  where ef.deleted_at is null
    and ef.status = 'Active'::public.entry_form_status
    and (ctx.can_read_all or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))
  order by s.year desc, ev.event_order, sr.name, g.sort_order, ef.car_number;
$$;

create or replace function public.create_inspection_form_for_entry(p_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_entry public.entry_forms%rowtype;
  v_template_id uuid;
  v_inspection_form_id uuid;
  v_version_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = p_entry_id
    and deleted_at is null
  for update;

  if v_entry.id is null then
    raise exception 'Entry Form was not found.';
  end if;

  if v_entry.status <> 'Active'::public.entry_form_status then
    raise exception 'Only Active Entry Forms can create Inspection Forms.';
  end if;

  if not (
    public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null)
    or public.can_manage_competitor(v_entry.competitor_profile_id, v_entry.season_id)
  ) then
    raise exception 'You do not have access to create this Inspection Form.';
  end if;

  select id into v_inspection_form_id
  from public.inspection_forms
  where entry_form_id = p_entry_id;

  if v_inspection_form_id is not null then
    return v_inspection_form_id;
  end if;

  select id into v_template_id
  from public.inspection_form_templates
  where event_series_rule_id = v_entry.event_series_rule_id
    and is_active = true
  order by version desc
  limit 1;

  if v_template_id is null then
    raise exception 'Inspection template is not configured for this Entry Form.';
  end if;

  insert into public.inspection_forms (
    entry_form_id,
    template_id,
    status,
    current_version_no,
    is_locked,
    created_by_id,
    updated_by_id,
    submitted_at
  ) values (
    p_entry_id,
    v_template_id,
    'Pending'::public.inspection_form_status,
    1,
    true,
    v_actor_profile_id,
    v_actor_profile_id,
    now()
  ) returning id into v_inspection_form_id;

  insert into public.inspection_form_versions (
    inspection_form_id,
    version_no,
    answers_snapshot,
    status,
    inspected_by_id
  ) values (
    v_inspection_form_id,
    1,
    jsonb_build_object(
      'source', 'created_from_entry_form',
      'personalSnapshot', v_entry.personal_snapshot,
      'vehicleSnapshot', v_entry.vehicle_snapshot,
      'teamSnapshot', v_entry.team_snapshot
    ),
    'Pending'::public.inspection_form_status,
    v_actor_profile_id
  ) returning id into v_version_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
  values (
    'inspection_form',
    v_inspection_form_id,
    'create',
    jsonb_build_object('entry_form_id', p_entry_id, 'version_id', v_version_id),
    'Pending',
    v_actor_profile_id
  );

  return v_inspection_form_id;
end;
$$;

create or replace function public.update_inspection_form_status(
  p_inspection_form_id uuid,
  p_status text,
  p_issue_note text default null,
  p_bop_base_weight_kg numeric default null,
  p_bop_option_weight_kg numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_form public.inspection_forms%rowtype;
  v_next_status public.inspection_form_status;
  v_next_version_no integer;
  v_total_weight numeric;
  v_version_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER'], null) then
    raise exception 'Only officials can update Inspection Form status.';
  end if;

  if p_status not in ('Pending', 'Passed', 'Hold', 'Failed') then
    raise exception 'Invalid Inspection Form status.';
  end if;

  v_next_status := p_status::public.inspection_form_status;

  if v_next_status in ('Hold'::public.inspection_form_status, 'Failed'::public.inspection_form_status)
     and nullif(btrim(coalesce(p_issue_note, '')), '') is null then
    raise exception 'Issue note is required for Hold or Failed Inspection Forms.';
  end if;

  select * into v_form
  from public.inspection_forms
  where id = p_inspection_form_id
  for update;

  if v_form.id is null then
    raise exception 'Inspection Form was not found.';
  end if;

  v_next_version_no := v_form.current_version_no + 1;
  v_total_weight := coalesce(p_bop_base_weight_kg, 0) + coalesce(p_bop_option_weight_kg, 0);

  insert into public.inspection_form_versions (
    inspection_form_id,
    version_no,
    answers_snapshot,
    bop_base_weight_kg,
    bop_option_weight_kg,
    bop_total_weight_kg,
    status,
    inspected_by_id
  ) values (
    p_inspection_form_id,
    v_next_version_no,
    jsonb_build_object(
      'source', 'official_status_update',
      'issueNote', nullif(btrim(coalesce(p_issue_note, '')), '')
    ),
    p_bop_base_weight_kg,
    p_bop_option_weight_kg,
    case when p_bop_base_weight_kg is null and p_bop_option_weight_kg is null then null else v_total_weight end,
    v_next_status,
    v_actor_profile_id
  ) returning id into v_version_id;

  update public.inspection_forms
  set status = v_next_status,
      official_bop_weight_kg = case
        when p_bop_base_weight_kg is null and p_bop_option_weight_kg is null then official_bop_weight_kg
        else v_total_weight
      end,
      current_version_no = v_next_version_no,
      is_locked = true,
      updated_by_id = v_actor_profile_id
  where id = p_inspection_form_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'inspection_form',
    p_inspection_form_id,
    'status_update',
    v_form.status::text,
    v_next_status::text,
    jsonb_build_object('version_id', v_version_id, 'issue_note', nullif(btrim(coalesce(p_issue_note, '')), ''), 'bop_total_weight_kg', v_total_weight),
    v_actor_profile_id
  );

  return v_version_id;
end;
$$;

revoke execute on function public.is_head_scrutineer() from public, anon;
revoke execute on function public.is_scrutineer() from public, anon;
revoke execute on function public.get_inspection_form_entries() from public, anon;
revoke execute on function public.create_inspection_form_for_entry(uuid) from public, anon;
revoke execute on function public.update_inspection_form_status(uuid, text, text, numeric, numeric) from public, anon;

grant execute on function public.is_head_scrutineer() to authenticated, service_role;
grant execute on function public.is_scrutineer() to authenticated, service_role;
grant execute on function public.get_inspection_form_entries() to authenticated, service_role;
grant execute on function public.create_inspection_form_for_entry(uuid) to authenticated, service_role;
grant execute on function public.update_inspection_form_status(uuid, text, text, numeric, numeric) to authenticated, service_role;

commit;
