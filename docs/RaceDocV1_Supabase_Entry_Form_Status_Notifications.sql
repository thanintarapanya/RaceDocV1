-- RaceDocV1 Entry Form Status Notifications
-- Purpose: create in-app notification records when Secretary/Admin approval
-- changes an Entry Form to Active or Rejected.

create or replace function public.create_entry_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_reject_reason text;
  v_title text;
  v_body text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status not in ('Active'::public.entry_form_status, 'Rejected'::public.entry_form_status) then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  select
    ef.competitor_profile_id,
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
  where ef.id = new.id;

  if new.status = 'Rejected'::public.entry_form_status then
    select nullif(btrim(al.new_values ->> 'reason'), '')
    into v_reject_reason
    from public.audit_logs al
    where al.entity_type = 'entry_form'
      and al.entity_id = new.id
      and al.action = 'reject'
      and al.new_status = 'Rejected'
    order by al.created_at desc
    limit 1;
  end if;

  v_title := case new.status
    when 'Active'::public.entry_form_status then 'Entry Form Approved / Car #' || coalesce(v_context.car_number, '--')
    else 'Entry Form Rejected / Car #' || coalesce(v_context.car_number, '--')
  end;

  v_body := concat_ws(
    E'\n',
    coalesce(v_context.event_name, 'Event') || ' / ' || coalesce(v_context.series_class, 'Class'),
    case new.status
      when 'Active'::public.entry_form_status then 'Your Entry Form has been approved and locked as official race data.'
      else coalesce(v_reject_reason, 'Your Entry Form was rejected. Please review the reason and submit corrected details.')
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
    'entry_form',
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

drop trigger if exists trg_create_entry_status_notifications on public.entry_forms;
create constraint trigger trg_create_entry_status_notifications
after update of status on public.entry_forms
deferrable initially deferred
for each row
execute function public.create_entry_status_notifications();

revoke execute on function public.create_entry_status_notifications() from public, anon, authenticated;
grant execute on function public.create_entry_status_notifications() to service_role;
