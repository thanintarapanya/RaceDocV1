-- =========================================================
-- RaceDocV1 Current User Roles RPC
-- Deployed via Supabase MCP migration: current_user_roles_rpc
-- Purpose: navigation/authorization display without direct table access.
-- =========================================================

create or replace function public.get_current_user_roles()
returns table (role_code text)
language sql
stable
security definer
set search_path = public
as $$
  select ra.role_code::text
  from public.role_assignments ra
  where ra.user_id = auth.uid();
$$;

revoke all on function public.get_current_user_roles() from public, anon;
grant execute on function public.get_current_user_roles() to authenticated;
