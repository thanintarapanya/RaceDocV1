-- RaceDocV1 Privacy Settings
-- Purpose: audit support for self-service privacy/security actions.
-- Password changes are performed by Supabase Auth from the client session; this RPC only records audit trail.

create or replace function public.record_privacy_security_event(
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_action text := lower(nullif(btrim(coalesce(p_action, '')), ''));
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if v_action not in ('password_updated', 'password_update_failed') then
    raise exception 'Unsupported privacy security event: %', p_action;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, action_by_id)
  values (
    'profile',
    v_actor_profile_id,
    v_action,
    coalesce(p_details, '{}'::jsonb) - 'password' - 'newPassword' - 'confirmPassword',
    v_actor_profile_id
  );

  return jsonb_build_object('recorded', true, 'action', v_action);
end;
$$;

revoke execute on function public.record_privacy_security_event(text, jsonb) from public, anon;
grant execute on function public.record_privacy_security_event(text, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
