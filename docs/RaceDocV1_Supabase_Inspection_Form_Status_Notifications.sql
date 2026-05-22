-- RaceDocV1 Inspection Form Status Notifications
-- Purpose: create in-app notification records when an official Inspection
-- review changes a form to Failed or Hold, and expose a recipient bell feed.

create or replace function public.create_inspection_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_issue_note text;
  v_item_summary text;
  v_title text;
  v_body text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status not in ('Failed'::public.inspection_form_status, 'Hold'::public.inspection_form_status) then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  select
    ef.competitor_profile_id,
    ef.team_id,
    ef.car_number,
    ev.name as event_name,
    sr.name || ' - ' || g.name as series_class,
    t.owner_profile_id as team_owner_profile_id
  into v_context
  from public.entry_forms ef
  join public.events ev on ev.id = ef.event_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  left join public.teams t on t.id = ef.team_id
  where ef.id = new.entry_form_id;

  select nullif(btrim(ifv.answers_snapshot ->> 'issueNote'), '')
  into v_issue_note
  from public.inspection_form_versions ifv
  where ifv.inspection_form_id = new.id
    and ifv.version_no = new.current_version_no
  order by ifv.created_at desc
  limit 1;

  select string_agg(
    coalesce(nullif(btrim(iti.label_en), ''), iti.label_th, 'Inspection item') ||
      coalesce(': ' || nullif(btrim(iir.comment), ''), ''),
    '; ' order by its.sort_order, iti.sort_order, iti.label_th
  )
  into v_item_summary
  from public.inspection_form_versions ifv
  join public.inspection_item_results iir on iir.inspection_version_id = ifv.id
  left join public.inspection_template_items iti on iti.id = iir.template_item_id
  left join public.inspection_template_sections its on its.id = iti.section_id
  where ifv.inspection_form_id = new.id
    and ifv.version_no = new.current_version_no
    and iir.result_status in ('Failed'::public.inspection_item_result_status, 'Hold'::public.inspection_item_result_status);

  v_title := 'Inspection Form ' || new.status::text || ' / Car #' || coalesce(v_context.car_number, '--');
  v_body := concat_ws(
    E'\n',
    coalesce(v_context.event_name, 'Event') || ' / ' || coalesce(v_context.series_class, 'Class'),
    coalesce(v_issue_note, v_item_summary, 'Please review the Inspection Form for required corrections.')
  );

  insert into public.notifications (
    recipient_profile_id,
    channel,
    title,
    body,
    link_entity_type,
    link_entity_id
  )
  select distinct
    recipient_profile_id,
    'InApp'::public.notification_channel,
    v_title,
    v_body,
    'inspection_form',
    new.id
  from (
    values
      (v_context.competitor_profile_id),
      (v_context.team_owner_profile_id)
  ) recipients(recipient_profile_id)
  where recipient_profile_id is not null;

  return new;
end;
$$;

drop trigger if exists trg_create_inspection_status_notifications on public.inspection_forms;
create trigger trg_create_inspection_status_notifications
after update of status on public.inspection_forms
for each row
execute function public.create_inspection_status_notifications();

create or replace function public.get_my_notifications(p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select public.current_profile_id() as profile_id
  ), visible_notifications as (
    select n.*
    from public.notifications n
    join ctx on ctx.profile_id = n.recipient_profile_id
    where n.channel = 'InApp'::public.notification_channel
    order by n.created_at desc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), unread_row as (
    select count(*)::int as unread_count
    from public.notifications n
    join ctx on ctx.profile_id = n.recipient_profile_id
    where n.channel = 'InApp'::public.notification_channel
      and n.is_read = false
  )
  select jsonb_build_object(
    'unreadCount', coalesce(unread_row.unread_count, 0),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'body', body,
        'linkEntityType', link_entity_type,
        'linkEntityId', link_entity_id,
        'isRead', is_read,
        'createdAt', created_at
      ) order by created_at desc)
      from visible_notifications
    ), '[]'::jsonb)
  )
  from unread_row;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  update public.notifications
  set is_read = true
  where id = p_notification_id
    and recipient_profile_id = v_profile_id;
end;
$$;

revoke execute on function public.create_inspection_status_notifications() from public, anon, authenticated;
revoke execute on function public.get_my_notifications(integer) from public, anon;
revoke execute on function public.mark_notification_read(uuid) from public, anon;

grant execute on function public.create_inspection_status_notifications() to service_role;
grant execute on function public.get_my_notifications(integer) to authenticated, service_role;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
