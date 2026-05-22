-- RaceDocV1 Competitor Request Status Notifications
-- Purpose: create in-app notification records when Competitor Requests
-- become ready for Secretary/Admin review or receive a final verdict.

create or replace function public.create_competitor_request_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_title text;
  v_body text;
  v_penalty_lines text;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = new.status then
      return new;
    end if;
  elsif tg_op <> 'INSERT' then
    return new;
  end if;

  if new.status not in (
    'Pending'::public.competitor_request_status,
    'Approved'::public.competitor_request_status,
    'Rejected'::public.competitor_request_status
  ) then
    return new;
  end if;

  select
    cr.requester_profile_id,
    cr.submitted_by_id,
    cr.queue_no,
    cr.topic,
    cr.final_comment,
    cr.fine_amount,
    cr.penalty_weight_kg,
    cr.grid_penalty,
    ef.competitor_profile_id,
    ef.car_number,
    ef.season_id,
    ev.name as event_name,
    sr.name || ' - ' || g.name as series_class,
    t.owner_profile_id as team_owner_profile_id
  into v_context
  from public.competitor_requests cr
  join public.entry_forms ef on ef.id = cr.entry_form_id
  join public.events ev on ev.id = ef.event_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  left join public.teams t on t.id = ef.team_id
  where cr.id = new.id;

  if v_context is null then
    return new;
  end if;

  v_title := case new.status
    when 'Pending'::public.competitor_request_status then 'Competitor Request Pending / Queue ' || coalesce(v_context.queue_no, '--')
    when 'Approved'::public.competitor_request_status then 'Competitor Request Approved / Queue ' || coalesce(v_context.queue_no, '--')
    else 'Competitor Request Rejected / Queue ' || coalesce(v_context.queue_no, '--')
  end;

  v_penalty_lines := concat_ws(
    E'\n',
    case when v_context.fine_amount is not null then 'Fine: ' || to_char(v_context.fine_amount, 'FM999,999,999,990.00') || ' THB' end,
    case when v_context.penalty_weight_kg is not null then 'Penalty weight: ' || trim(to_char(v_context.penalty_weight_kg, 'FM999,999,990.##')) || ' kg' end,
    case when nullif(btrim(v_context.grid_penalty), '') is not null then 'Grid penalty: ' || btrim(v_context.grid_penalty) end
  );

  v_body := case new.status
    when 'Pending'::public.competitor_request_status then concat_ws(
      E'\n',
      coalesce(v_context.event_name, 'Event') || ' / ' || coalesce(v_context.series_class, 'Class') || ' / Car #' || coalesce(v_context.car_number, '--'),
      'Topic: ' || coalesce(v_context.topic, 'Competitor Request'),
      'This request is ready for Secretary/Admin screening.'
    )
    else concat_ws(
      E'\n',
      coalesce(v_context.event_name, 'Event') || ' / ' || coalesce(v_context.series_class, 'Class') || ' / Car #' || coalesce(v_context.car_number, '--'),
      'Topic: ' || coalesce(v_context.topic, 'Competitor Request'),
      coalesce(nullif(btrim(v_context.final_comment), ''), 'Final decision recorded.'),
      nullif(v_penalty_lines, '')
    )
  end;

  if new.status = 'Pending'::public.competitor_request_status then
    insert into public.notifications (
      recipient_profile_id,
      channel,
      title,
      body,
      link_entity_type,
      link_entity_id
    )
    select distinct
      ur.profile_id,
      'InApp'::public.notification_channel,
      v_title,
      v_body,
      'competitor_request',
      new.id
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.is_active = true
      and r.code in ('ADMIN', 'SECRETARY')
      and (ur.season_id is null or ur.season_id = v_context.season_id)
      and ur.profile_id is not null;
  else
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
      'competitor_request',
      new.id
    from (
      values
        (v_context.competitor_profile_id),
        (v_context.requester_profile_id),
        (v_context.submitted_by_id),
        (v_context.team_owner_profile_id)
    ) recipients(recipient_profile_id)
    where recipient_profile_id is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_create_competitor_request_status_notifications on public.competitor_requests;
create trigger trg_create_competitor_request_status_notifications
after insert or update of status on public.competitor_requests
for each row
execute function public.create_competitor_request_status_notifications();

revoke execute on function public.create_competitor_request_status_notifications() from public, anon, authenticated;
grant execute on function public.create_competitor_request_status_notifications() to service_role;
