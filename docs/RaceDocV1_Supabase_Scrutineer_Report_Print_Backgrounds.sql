-- RaceDocV1 Scrutineer Report A4 Print Backgrounds
-- Purpose: allow Official Scrutineer Reports to select an Event-scoped
-- image background before browser A4 printing.

create or replace function public.get_scrutineer_report_print_options(
  p_report_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with report_context as (
    select
      srp.id as report_id,
      srp.status::text as status,
      srp.print_background_id,
      r.event_id,
      e.name as event_name,
      r.name as race_name,
      series.name || ' - ' || g.name as series_class
    from public.scrutineer_reports srp
    join public.races r on r.id = srp.race_id
    join public.events e on e.id = r.event_id
    join public.series_races series on series.id = srp.series_race_id
    join public.grades g on g.id = srp.grade_id
    where srp.id = p_report_id
      and srp.deleted_at is null
      and public.can_view_scrutineer_report()
  ), background_rows as (
    select
      pba.id,
      pba.title,
      pba.is_default,
      jsonb_build_object(
        'printBackgroundAssetId', pba.id,
        'eventId', pba.event_id,
        'eventName', e.name,
        'title', pba.title,
        'isDefault', pba.is_default,
        'fileAssetId', fa.id,
        'bucket', fa.bucket,
        'path', fa.path,
        'filename', fa.filename,
        'mimeType', fa.mime_type,
        'sizeBytes', fa.size_bytes
      ) as background
    from public.print_background_assets pba
    join report_context rc on rc.event_id = pba.event_id
    join public.file_assets fa on fa.id = pba.file_asset_id and fa.deleted_at is null
    join public.events e on e.id = pba.event_id
    where fa.mime_type in ('image/png', 'image/jpeg', 'image/webp')
  ), selected_background as (
    select br.background
    from background_rows br
    cross join report_context rc
    order by
      case
        when br.id = rc.print_background_id then 0
        when br.is_default then 1
        else 2
      end,
      br.title
    limit 1
  )
  select jsonb_build_object(
    'canManage', public.can_manage_scrutineer_report(),
    'reportId', rc.report_id,
    'status', rc.status,
    'eventId', rc.event_id,
    'eventName', rc.event_name,
    'raceName', rc.race_name,
    'seriesClass', rc.series_class,
    'selectedBackgroundId', selected_background.background ->> 'printBackgroundAssetId',
    'selectedBackground', coalesce(selected_background.background, 'null'::jsonb),
    'printBackgroundAssets', coalesce((
      select jsonb_agg(br.background order by br.is_default desc, br.title)
      from background_rows br
    ), '[]'::jsonb)
  )
  from report_context rc
  left join selected_background on true;
$$;

create or replace function public.set_scrutineer_report_print_background(
  p_report_id uuid,
  p_print_background_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_report public.scrutineer_reports%rowtype;
  v_event_id uuid;
  v_background_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.can_manage_scrutineer_report() then
    raise exception 'Only Admin or Head Scrutineer can select Scrutineer Report print backgrounds.';
  end if;

  select srp.*
    into v_report
  from public.scrutineer_reports srp
  where srp.id = p_report_id
    and srp.deleted_at is null
  for update of srp;

  if v_report.id is null then
    raise exception 'Scrutineer Report was not found.';
  end if;

  if v_report.status <> 'Official'::public.scrutineer_report_status then
    raise exception 'Only Official Scrutineer Reports can be printed with an A4 background.';
  end if;

  select r.event_id into v_event_id
  from public.races r
  where r.id = v_report.race_id;

  if p_print_background_id is not null then
    select pba.id into v_background_id
    from public.print_background_assets pba
    join public.file_assets fa on fa.id = pba.file_asset_id and fa.deleted_at is null
    where pba.id = p_print_background_id
      and pba.event_id = v_event_id
      and fa.mime_type in ('image/png', 'image/jpeg', 'image/webp');

    if v_background_id is null then
      raise exception 'Print background must be an image asset for this report Event.';
    end if;
  end if;

  select to_jsonb(srp.*) into v_old_values
  from public.scrutineer_reports srp
  where srp.id = p_report_id;

  update public.scrutineer_reports
  set print_background_id = v_background_id
  where id = p_report_id
  returning to_jsonb(public.scrutineer_reports.*) into v_new_values;

  insert into public.audit_logs (entity_type, entity_id, action, old_values, new_values, action_by_id)
  values ('scrutineer_report', p_report_id, 'set_print_background', v_old_values, v_new_values, v_actor_profile_id);

  return public.get_scrutineer_report_print_options(p_report_id);
end;
$$;

revoke execute on function public.get_scrutineer_report_print_options(uuid) from public, anon;
revoke execute on function public.set_scrutineer_report_print_background(uuid, uuid) from public, anon;

grant execute on function public.get_scrutineer_report_print_options(uuid) to authenticated, service_role;
grant execute on function public.set_scrutineer_report_print_background(uuid, uuid) to authenticated, service_role;
