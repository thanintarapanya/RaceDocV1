-- RaceDocV1 Weight-In Status Notifications
-- Purpose: create in-app notification records when an official Weight-In log
-- records a Passed or Failed status for a car.

create or replace function public.create_weight_in_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_title text;
  v_body text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if new.status not in ('Passed'::public.weigh_in_status, 'Failed'::public.weigh_in_status) then
    return new;
  end if;

  select
    wil.id as weigh_in_log_id,
    wil.weigh_in_session_id,
    wil.entry_form_id,
    wil.target_weight_kg,
    wil.actual_weight_kg,
    greatest(wil.target_weight_kg - wil.actual_weight_kg, 0) as missing_weight_kg,
    ef.competitor_profile_id,
    ef.car_number,
    ev.name as event_name,
    r.name as race_name,
    wis.session_type,
    sr.name || ' - ' || g.name as series_class,
    t.owner_profile_id as team_owner_profile_id
  into v_context
  from public.weigh_in_logs wil
  join public.weigh_in_sessions wis on wis.id = wil.weigh_in_session_id
  join public.races r on r.id = wis.race_id
  join public.events ev on ev.id = r.event_id
  join public.entry_forms ef on ef.id = wil.entry_form_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  left join public.teams t on t.id = ef.team_id
  where wil.id = new.id;

  if v_context is null then
    return new;
  end if;

  v_title := case new.status
    when 'Passed'::public.weigh_in_status then 'Weight-In Passed / Car #' || coalesce(v_context.car_number, '--')
    else 'Weight-In Failed / Car #' || coalesce(v_context.car_number, '--')
  end;

  v_body := concat_ws(
    E'\n',
    coalesce(v_context.event_name, 'Event') || ' / ' || coalesce(v_context.race_name, 'Race') || ' / ' || coalesce(v_context.session_type, 'Session'),
    coalesce(v_context.series_class, 'Class'),
    'Target: ' || trim(to_char(v_context.target_weight_kg, 'FM999,999,990.##')) || ' kg / Actual: ' || trim(to_char(v_context.actual_weight_kg, 'FM999,999,990.##')) || ' kg',
    case new.status
      when 'Passed'::public.weigh_in_status then 'Your car meets the official target weight.'
      else 'Under target by ' || trim(to_char(v_context.missing_weight_kg, 'FM999,999,990.##')) || ' kg. Please coordinate with officials for re-weighing.'
    end
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
    'weight_in',
    new.weigh_in_session_id
  from (
    values
      (v_context.competitor_profile_id),
      (v_context.team_owner_profile_id)
  ) recipients(recipient_profile_id)
  where recipient_profile_id is not null;

  return new;
end;
$$;

drop trigger if exists trg_create_weight_in_status_notifications on public.weigh_in_logs;
create trigger trg_create_weight_in_status_notifications
after insert on public.weigh_in_logs
for each row
execute function public.create_weight_in_status_notifications();

revoke execute on function public.create_weight_in_status_notifications() from public, anon, authenticated;
grant execute on function public.create_weight_in_status_notifications() to service_role;
