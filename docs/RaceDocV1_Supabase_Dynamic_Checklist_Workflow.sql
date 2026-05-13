-- RaceDocV1 Dynamic Checklist Workflow
-- Purpose: enable Admin/Secretary-managed checklist topic columns, dynamic
-- per-entry checklist values, and visible audit history for check/uncheck actions.

begin;

-- Seed baseline topics matching the original fixed checklist columns for every event.
insert into public.checklist_topics (event_id, title_th, title_en, sort_order, is_required, is_active)
select e.id, v.title_th, v.title_en, v.sort_order, true, true
from public.events e
cross join (values
  ('เช็คอิน', 'Check-in', 10),
  ('ออกสติ๊กเกอร์', 'Sticker issued', 20),
  ('ตรวจชำระเงิน', 'Payment verified', 30),
  ('ตรวจเอกสาร', 'Documents verified', 40),
  ('ออกสายรัดข้อมือ', 'Wristband issued', 50)
) as v(title_th, title_en, sort_order)
where not exists (
  select 1
  from public.checklist_topics ct
  where ct.event_id = e.id
    and ct.sort_order = v.sort_order
);

-- Backfill old fixed-column checklist values into dynamic checklist_items.
insert into public.checklist_items (entry_form_id, checklist_topic_id, is_checked, updated_by_id, updated_at)
select
  ec.entry_id,
  ct.id,
  case ct.title_en
    when 'Check-in' then ec.competitor_checked_in
    when 'Sticker issued' then ec.sticker_issued
    when 'Payment verified' then ec.payment_verified
    when 'Documents verified' then ec.documents_verified
    when 'Wristband issued' then ec.wristband_issued
    else false
  end,
  ec.checked_by_id,
  coalesce(ec.checked_at, ec.updated_at, now())
from public.entry_checklists ec
join public.entry_forms ef on ef.id = ec.entry_id
    join public.checklist_topics ct on ct.event_id = ef.event_id
    where ct.title_en in ('Check-in', 'Sticker issued', 'Payment verified', 'Documents verified', 'Wristband issued')
      and ct.is_active = true
on conflict (entry_form_id, checklist_topic_id) do nothing;

create index if not exists checklist_topics_event_active_sort_idx
  on public.checklist_topics (event_id, is_active, sort_order);

create index if not exists checklist_items_updated_by_id_idx
  on public.checklist_items (updated_by_id);

create index if not exists audit_logs_checklist_item_idx
  on public.audit_logs (entity_type, entity_id, created_at desc)
  where entity_type = 'checklist_item';

create or replace function public.is_checklist_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['ADMIN', 'SECRETARY'], null);
$$;

create or replace function public.get_dynamic_checklist_matrix()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.is_checklist_operator() as can_edit,
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK'], null) as can_read_all
  ), visible_entries as (
    select
      ef.id,
      ef.event_id,
      ev.name as event_name,
      ev.event_order,
      s.year as season_year,
      sr.name || ' - ' || g.name as series_class,
      g.sort_order as grade_sort_order,
      ef.car_number,
      ef.competitor_profile_id,
      cp.auth_user_id as competitor_user_id,
      coalesce(nullif(btrim(concat_ws(' ', cp.first_name_en, cp.last_name_en)), ''), nullif(btrim(concat_ws(' ', cp.first_name_th, cp.last_name_th)), ''), au.email, 'Unknown competitor') as competitor_name,
      coalesce(au.email, '') as competitor_email,
      ec.notes
    from public.entry_forms ef
    join public.events ev on ev.id = ef.event_id
    join public.seasons s on s.id = ef.season_id
    join public.series_races sr on sr.id = ef.series_race_id
    join public.grades g on g.id = ef.grade_id
    join public.profiles cp on cp.id = ef.competitor_profile_id
    left join auth.users au on au.id = cp.auth_user_id
    left join public.entry_checklists ec on ec.entry_id = ef.id
    cross join ctx
    where ef.deleted_at is null
      and ef.status = 'Active'::public.entry_form_status
      and (ctx.can_read_all or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))
  ), active_topics as (
    select
      ct.id,
      ct.event_id,
      ev.name as event_name,
      ct.title_th,
      ct.title_en,
      ct.sort_order,
      ct.is_required
    from public.checklist_topics ct
    join public.events ev on ev.id = ct.event_id
    where ct.is_active = true
  ), event_options as (
    select e.id, e.name, s.year, e.event_order
    from public.events e
    join public.seasons s on s.id = e.season_id
  )
  select jsonb_build_object(
    'canEdit', (select can_edit from ctx),
    'eventOptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventId', eo.id,
        'eventName', eo.name,
        'seasonYear', eo.year
      ) order by eo.year desc, eo.event_order)
      from event_options eo
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'topicId', at.id,
        'eventId', at.event_id,
        'eventName', at.event_name,
        'titleTh', at.title_th,
        'titleEn', at.title_en,
        'title', coalesce(nullif(at.title_en, ''), at.title_th),
        'shortTitle', left(coalesce(nullif(at.title_en, ''), at.title_th), 14),
        'sortOrder', at.sort_order,
        'isRequired', at.is_required
      ) order by at.event_name, at.sort_order)
      from active_topics at
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entryId', ve.id,
        'eventId', ve.event_id,
        'eventName', ve.event_name,
        'seasonYear', ve.season_year,
        'seriesClass', ve.series_class,
        'carNumber', ve.car_number,
        'competitorUserId', ve.competitor_user_id,
        'competitorName', ve.competitor_name,
        'competitorEmail', ve.competitor_email,
        'notes', ve.notes,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'topicId', at.id,
            'isChecked', coalesce(ci.is_checked, false),
            'updatedByName', nullif(btrim(concat_ws(' ', updater.first_name_en, updater.last_name_en)), ''),
            'updatedAt', ci.updated_at
          ) order by at.sort_order)
          from active_topics at
          left join public.checklist_items ci
            on ci.entry_form_id = ve.id
           and ci.checklist_topic_id = at.id
          left join public.profiles updater on updater.id = ci.updated_by_id
          where at.event_id = ve.event_id
        ), '[]'::jsonb)
      ) order by ve.event_order, ve.series_class, ve.grade_sort_order, ve.car_number)
      from visible_entries ve
    ), '[]'::jsonb)
  );
$$;

create or replace function public.create_checklist_topic(
  p_event_id uuid,
  p_title_en text,
  p_title_th text default null,
  p_is_required boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_topic_id uuid;
  v_sort_order integer;
begin
  if not public.is_checklist_operator() then
    raise exception 'Only Admin or Secretary can create checklist topics.';
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Event was not found.';
  end if;

  if nullif(btrim(coalesce(p_title_en, p_title_th, '')), '') is null then
    raise exception 'Checklist topic title is required.';
  end if;

  select coalesce(max(sort_order), 0) + 10 into v_sort_order
  from public.checklist_topics
  where event_id = p_event_id;

  insert into public.checklist_topics (event_id, title_th, title_en, sort_order, is_required, is_active)
  values (p_event_id, nullif(btrim(coalesce(p_title_th, '')), ''), btrim(coalesce(p_title_en, p_title_th)), v_sort_order, coalesce(p_is_required, true), true)
  returning id into v_topic_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values ('checklist_topic', v_topic_id, 'create', jsonb_build_object('event_id', p_event_id, 'title_en', p_title_en, 'sort_order', v_sort_order), v_actor_profile_id);

  return v_topic_id;
end;
$$;

create or replace function public.move_checklist_topic(p_topic_id uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_topic public.checklist_topics%rowtype;
  v_other public.checklist_topics%rowtype;
  v_temp_sort_order integer;
begin
  if not public.is_checklist_operator() then
    raise exception 'Only Admin or Secretary can reorder checklist topics.';
  end if;

  select * into v_topic
  from public.checklist_topics
  where id = p_topic_id
    and is_active = true;

  if v_topic.id is null then
    raise exception 'Checklist topic was not found.';
  end if;

  if p_direction = 'up' then
    select * into v_other
    from public.checklist_topics
    where event_id = v_topic.event_id
      and is_active = true
      and sort_order < v_topic.sort_order
    order by sort_order desc
    limit 1;
  elsif p_direction = 'down' then
    select * into v_other
    from public.checklist_topics
    where event_id = v_topic.event_id
      and is_active = true
      and sort_order > v_topic.sort_order
    order by sort_order asc
    limit 1;
  else
    raise exception 'Direction must be up or down.';
  end if;

  if v_other.id is null then
    return;
  end if;

  select least(coalesce(min(sort_order), 0), 0) - 10 into v_temp_sort_order
  from public.checklist_topics
  where event_id = v_topic.event_id;

  update public.checklist_topics set sort_order = v_temp_sort_order where id = v_topic.id;
  update public.checklist_topics set sort_order = v_topic.sort_order where id = v_other.id;
  update public.checklist_topics set sort_order = v_other.sort_order where id = v_topic.id;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values (
    'checklist_topic',
    p_topic_id,
    'reorder',
    jsonb_build_object('sort_order', v_topic.sort_order),
    jsonb_build_object('sort_order', v_other.sort_order, 'direction', p_direction),
    v_actor_profile_id
  );
end;
$$;

create or replace function public.delete_checklist_topic(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_topic public.checklist_topics%rowtype;
begin
  if not public.is_checklist_operator() then
    raise exception 'Only Admin or Secretary can delete checklist topics.';
  end if;

  select * into v_topic
  from public.checklist_topics
  where id = p_topic_id;

  if v_topic.id is null then
    raise exception 'Checklist topic was not found.';
  end if;

  update public.checklist_topics
  set is_active = false
  where id = p_topic_id;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('checklist_topic', p_topic_id, 'delete', to_jsonb(v_topic), jsonb_build_object('is_active', false), v_actor_profile_id);
end;
$$;

create or replace function public.update_checklist_item(
  p_entry_id uuid,
  p_topic_id uuid,
  p_is_checked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_previous public.checklist_items%rowtype;
  v_next public.checklist_items%rowtype;
begin
  if not public.is_checklist_operator() then
    raise exception 'Only Admin or Secretary can update checklist items.';
  end if;

  if not exists (
    select 1
    from public.entry_forms ef
    join public.checklist_topics ct on ct.id = p_topic_id and ct.event_id = ef.event_id and ct.is_active = true
    where ef.id = p_entry_id
      and ef.status = 'Active'::public.entry_form_status
      and ef.deleted_at is null
  ) then
    raise exception 'Active Entry Form or matching checklist topic was not found.';
  end if;

  select * into v_previous
  from public.checklist_items
  where entry_form_id = p_entry_id
    and checklist_topic_id = p_topic_id;

  insert into public.checklist_items (entry_form_id, checklist_topic_id, is_checked, updated_by_id, updated_at)
  values (p_entry_id, p_topic_id, coalesce(p_is_checked, false), v_actor_profile_id, now())
  on conflict (entry_form_id, checklist_topic_id) do update set
    is_checked = excluded.is_checked,
    updated_by_id = excluded.updated_by_id,
    updated_at = excluded.updated_at;

  select * into v_next
  from public.checklist_items
  where entry_form_id = p_entry_id
    and checklist_topic_id = p_topic_id;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values (
    'checklist_item',
    v_next.id,
    case when coalesce(v_next.is_checked, false) then 'check' else 'uncheck' end,
    case when v_previous.id is null then null else to_jsonb(v_previous) end,
    jsonb_build_object('entry_form_id', p_entry_id, 'topic_id', p_topic_id, 'is_checked', v_next.is_checked, 'updated_at', v_next.updated_at),
    v_actor_profile_id
  );
end;
$$;

create or replace function public.bulk_update_checklist_item(
  p_entry_ids uuid[],
  p_topic_id uuid,
  p_is_checked boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_entry_id uuid;
  v_previous public.checklist_items%rowtype;
  v_next public.checklist_items%rowtype;
  v_updated_count integer := 0;
begin
  if not public.is_checklist_operator() then
    raise exception 'Only Admin or Secretary can bulk update checklist items.';
  end if;

  if p_entry_ids is null or array_length(p_entry_ids, 1) is null then
    raise exception 'At least one Entry Form is required.';
  end if;

  foreach v_entry_id in array p_entry_ids loop
    if not exists (
      select 1
      from public.entry_forms ef
      join public.checklist_topics ct on ct.id = p_topic_id and ct.event_id = ef.event_id and ct.is_active = true
      where ef.id = v_entry_id
        and ef.status = 'Active'::public.entry_form_status
        and ef.deleted_at is null
    ) then
      raise exception 'Active Entry Form or matching checklist topic was not found.';
    end if;

    select * into v_previous
    from public.checklist_items
    where entry_form_id = v_entry_id
      and checklist_topic_id = p_topic_id;

    insert into public.checklist_items (entry_form_id, checklist_topic_id, is_checked, updated_by_id, updated_at)
    values (v_entry_id, p_topic_id, coalesce(p_is_checked, false), v_actor_profile_id, now())
    on conflict (entry_form_id, checklist_topic_id) do update set
      is_checked = excluded.is_checked,
      updated_by_id = excluded.updated_by_id,
      updated_at = excluded.updated_at;

    select * into v_next
    from public.checklist_items
    where entry_form_id = v_entry_id
      and checklist_topic_id = p_topic_id;

    insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
    values (
      'checklist_item',
      v_next.id,
      case when coalesce(v_next.is_checked, false) then 'bulk_check' else 'bulk_uncheck' end,
      case when v_previous.id is null then null else to_jsonb(v_previous) end,
      jsonb_build_object('entry_form_id', v_entry_id, 'topic_id', p_topic_id, 'is_checked', v_next.is_checked, 'updated_at', v_next.updated_at),
      v_actor_profile_id
    );

    v_updated_count := v_updated_count + 1;
  end loop;

  return v_updated_count;
end;
$$;

create or replace function public.get_checklist_item_audit(p_entry_id uuid, p_topic_id uuid)
returns table(
  action text,
  is_checked boolean,
  actor_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    al.action,
    coalesce((al.new_values ->> 'is_checked')::boolean, false) as is_checked,
    coalesce(nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''), nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''), 'System') as actor_name,
    al.created_at
  from public.checklist_items ci
  join public.entry_forms ef on ef.id = ci.entry_form_id
  join public.audit_logs al on al.entity_type = 'checklist_item' and al.entity_id = ci.id
  left join public.profiles p on p.id = al.action_by_id
  where ci.entry_form_id = p_entry_id
    and ci.checklist_topic_id = p_topic_id
    and (public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK'], null) or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))
  order by al.created_at desc
  limit 20;
$$;

create or replace function public.get_checklist_entry_audit(p_entry_id uuid)
returns table(
  topic_id uuid,
  topic_title text,
  action text,
  is_checked boolean,
  actor_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ct.id as topic_id,
    coalesce(nullif(ct.title_en, ''), ct.title_th, 'Checklist topic') as topic_title,
    al.action,
    coalesce((al.new_values ->> 'is_checked')::boolean, false) as is_checked,
    coalesce(nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''), nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''), 'System') as actor_name,
    al.created_at
  from public.entry_forms ef
  join public.checklist_items ci on ci.entry_form_id = ef.id
  join public.checklist_topics ct on ct.id = ci.checklist_topic_id
  join public.audit_logs al on al.entity_type = 'checklist_item' and al.entity_id = ci.id
  left join public.profiles p on p.id = al.action_by_id
  where ef.id = p_entry_id
    and (public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK'], null) or public.can_manage_competitor(ef.competitor_profile_id, ef.season_id))
  order by al.created_at desc, ct.sort_order asc
  limit 100;
$$;

revoke execute on function public.is_checklist_operator() from public, anon;
revoke execute on function public.get_dynamic_checklist_matrix() from public, anon;
revoke execute on function public.create_checklist_topic(uuid, text, text, boolean) from public, anon;
revoke execute on function public.move_checklist_topic(uuid, text) from public, anon;
revoke execute on function public.delete_checklist_topic(uuid) from public, anon;
revoke execute on function public.update_checklist_item(uuid, uuid, boolean) from public, anon;
revoke execute on function public.bulk_update_checklist_item(uuid[], uuid, boolean) from public, anon;
revoke execute on function public.get_checklist_item_audit(uuid, uuid) from public, anon;
revoke execute on function public.get_checklist_entry_audit(uuid) from public, anon;

grant execute on function public.is_checklist_operator() to authenticated, service_role;
grant execute on function public.get_dynamic_checklist_matrix() to authenticated, service_role;
grant execute on function public.create_checklist_topic(uuid, text, text, boolean) to authenticated, service_role;
grant execute on function public.move_checklist_topic(uuid, text) to authenticated, service_role;
grant execute on function public.delete_checklist_topic(uuid) to authenticated, service_role;
grant execute on function public.update_checklist_item(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.bulk_update_checklist_item(uuid[], uuid, boolean) to authenticated, service_role;
grant execute on function public.get_checklist_item_audit(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_checklist_entry_audit(uuid) to authenticated, service_role;

commit;
