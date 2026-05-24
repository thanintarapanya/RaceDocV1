-- RaceDocV1 Audit Trail Viewer
-- Purpose: Admin-only read model for inspecting system audit logs from the UI.

create index if not exists audit_logs_entity_created_at_idx
  on public.audit_logs (entity_type, created_at desc);

create or replace function public.get_audit_trail(
  p_entity_type text default 'all',
  p_action text default null,
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_type text := lower(coalesce(nullif(btrim(p_entity_type), ''), 'all'));
  v_action text := lower(nullif(btrim(coalesce(p_action, '')), ''));
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if not public.has_role('ADMIN', null) then
    raise exception 'Admin role is required to view Audit Trail.';
  end if;

  if v_entity_type <> 'all' and v_entity_type !~ '^[a-z0-9_]+$' then
    raise exception 'Unsupported audit entity type: %', p_entity_type;
  end if;

  with filtered as (
    select al.id
    from public.audit_logs al
    left join public.profiles actor on actor.id = al.action_by_id
    where (v_entity_type = 'all' or lower(al.entity_type) = v_entity_type)
      and (v_action is null or lower(al.action) like '%' || v_action || '%')
      and (
        v_search is null
        or lower(al.entity_type) like '%' || v_search || '%'
        or lower(al.action) like '%' || v_search || '%'
        or al.entity_id::text like '%' || v_search || '%'
        or lower(coalesce(al.previous_status, '')) like '%' || v_search || '%'
        or lower(coalesce(al.new_status, '')) like '%' || v_search || '%'
        or lower(coalesce(actor.first_name_en, '')) like '%' || v_search || '%'
        or lower(coalesce(actor.last_name_en, '')) like '%' || v_search || '%'
        or lower(coalesce(actor.first_name_th, '')) like '%' || v_search || '%'
        or lower(coalesce(actor.last_name_th, '')) like '%' || v_search || '%'
        or lower(coalesce(al.old_values::text, '')) like '%' || v_search || '%'
        or lower(coalesce(al.new_values::text, '')) like '%' || v_search || '%'
      )
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select
      al.*,
      nullif(concat_ws(' ', actor.first_name_en, actor.last_name_en), '') as actor_name_en,
      nullif(concat_ws(' ', actor.first_name_th, actor.last_name_th), '') as actor_name_th
    from public.audit_logs al
    left join public.profiles actor on actor.id = al.action_by_id
    where (v_entity_type = 'all' or lower(al.entity_type) = v_entity_type)
      and (v_action is null or lower(al.action) like '%' || v_action || '%')
      and (
        v_search is null
        or lower(al.entity_type) like '%' || v_search || '%'
        or lower(al.action) like '%' || v_search || '%'
        or al.entity_id::text like '%' || v_search || '%'
        or lower(coalesce(al.previous_status, '')) like '%' || v_search || '%'
        or lower(coalesce(al.new_status, '')) like '%' || v_search || '%'
        or lower(coalesce(actor.first_name_en, '')) like '%' || v_search || '%'
        or lower(coalesce(actor.last_name_en, '')) like '%' || v_search || '%'
        or lower(coalesce(actor.first_name_th, '')) like '%' || v_search || '%'
        or lower(coalesce(actor.last_name_th, '')) like '%' || v_search || '%'
        or lower(coalesce(al.old_values::text, '')) like '%' || v_search || '%'
        or lower(coalesce(al.new_values::text, '')) like '%' || v_search || '%'
      )
    order by al.created_at desc
    limit v_limit offset v_offset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'entityType', entity_type,
        'entityId', entity_id,
        'action', action,
        'oldValues', old_values,
        'newValues', new_values,
        'previousStatus', previous_status,
        'newStatus', new_status,
        'actionById', action_by_id,
        'actorName', coalesce(actor_name_en, actor_name_th),
        'createdAt', created_at
      )
      order by created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from filtered;

  return jsonb_build_object(
    'canView', true,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'items', v_items
  );
end;
$$;

revoke execute on function public.get_audit_trail(text, text, text, integer, integer) from public, anon;
grant execute on function public.get_audit_trail(text, text, text, integer, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
