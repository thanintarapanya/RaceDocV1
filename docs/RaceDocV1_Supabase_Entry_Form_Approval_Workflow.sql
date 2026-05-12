-- RaceDocV1 Entry Form Approval Workflow
-- Applied via Supabase MCP on 2026-05-12.
-- Purpose: enable Secretary/Admin review, approve, reject, locking, and audit trail for pending entry forms.

alter table public.entries
  add column if not exists approved_by_id uuid references public.users(id),
  add column if not exists rejected_by_id uuid references public.users(id);

alter table public.entry_forms
  add column if not exists is_locked boolean not null default false,
  add column if not exists approved_by_id uuid references public.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by_id uuid references public.users(id),
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

update public.entry_forms ef
set
  is_locked = en.is_locked,
  approved_at = coalesce(ef.approved_at, en.approved_at),
  rejected_at = coalesce(ef.rejected_at, en.rejected_at),
  rejection_reason = coalesce(ef.rejection_reason, en.rejection_reason)
from public.entries en
where en.id = ef.id;

create or replace function public.is_admin_or_secretary(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = p_user_id
      and ra.role_code in ('ADMIN'::public.role_code, 'SECRETARY'::public.role_code)
  );
$$;

create or replace function public.get_secretary_pending_entries()
returns table (
  id uuid,
  batch_id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  status text,
  submitted_at timestamptz,
  created_at timestamptz,
  competitor_user_id uuid,
  competitor_name text,
  competitor_email text,
  personal_snapshot jsonb,
  driver_license_snapshot jsonb,
  vehicle_snapshot jsonb,
  team_snapshot jsonb,
  signature_path text,
  documents jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ef.id,
    ef.batch_id,
    ev.name as event_name,
    s.year as season_year,
    esc.series_class,
    ef.car_number,
    ef.status::text as status,
    en.submitted_at,
    ef.created_at,
    ef.competitor_user_id,
    coalesce(
      nullif(u.full_name, ''),
      nullif(btrim(concat_ws(' ', ef.personal_snapshot->>'firstNameEn', ef.personal_snapshot->>'lastNameEn')), ''),
      nullif(btrim(concat_ws(' ', ef.personal_snapshot->>'firstNameTh', ef.personal_snapshot->>'lastNameTh')), ''),
      u.email
    ) as competitor_name,
    u.email as competitor_email,
    ef.personal_snapshot,
    ef.driver_license_snapshot,
    ef.vehicle_snapshot,
    ef.team_snapshot,
    ef.signature_path,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'documentType', efd.document_type,
          'isRequired', efd.is_required,
          'uploadedAt', efd.uploaded_at,
          'fileAssetId', fa.id,
          'bucket', fa.bucket,
          'path', fa.path,
          'filename', fa.filename,
          'mimeType', fa.mime_type,
          'sizeBytes', fa.size_bytes
        ) order by efd.is_required desc, efd.document_type
      ) filter (where efd.id is not null),
      '[]'::jsonb
    ) as documents
  from public.entry_forms ef
  join public.entries en on en.id = ef.id
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.event_series_configs esc on esc.id = ef.event_series_config_id
  join public.users u on u.id = ef.competitor_user_id
  left join public.entry_form_documents efd on efd.entry_form_id = ef.id
  left join public.file_assets fa on fa.id = efd.file_asset_id and fa.deleted_at is null
  where public.is_admin_or_secretary(auth.uid())
    and ef.deleted_at is null
    and en.deleted_at is null
    and ef.status = 'pending'::public.entry_status
    and en.status = 'pending'::public.entry_status
  group by
    ef.id,
    ev.name,
    s.year,
    esc.series_class,
    en.submitted_at,
    u.full_name,
    u.email
  order by ef.created_at asc;
$$;

create or replace function public.approve_entry_form(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_email text;
  v_previous_status public.entry_status;
  v_competitor_user_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_or_secretary(v_actor_id) then
    raise exception 'Only Admin or Secretary can approve entry forms';
  end if;

  select ra.role_code::text
  into v_actor_role
  from public.role_assignments ra
  where ra.user_id = v_actor_id
    and ra.role_code in ('ADMIN'::public.role_code, 'SECRETARY'::public.role_code)
  order by case when ra.role_code = 'ADMIN'::public.role_code then 0 else 1 end
  limit 1;

  select u.email into v_actor_email from public.users u where u.id = v_actor_id;

  select en.status, en.competitor_user_id
  into v_previous_status, v_competitor_user_id
  from public.entries en
  where en.id = p_entry_id
    and en.deleted_at is null
  for update;

  if v_previous_status is null then
    raise exception 'Entry form not found';
  end if;

  if v_previous_status <> 'pending'::public.entry_status then
    raise exception 'Only pending entry forms can be approved';
  end if;

  update public.entries
  set
    status = 'active'::public.entry_status,
    is_locked = true,
    approved_at = now(),
    approved_by_id = v_actor_id,
    rejected_at = null,
    rejected_by_id = null,
    rejection_reason = null,
    updated_by_id = v_actor_id,
    updated_at = now()
  where id = p_entry_id;

  update public.entry_forms
  set
    status = 'active'::public.entry_status,
    is_locked = true,
    approved_at = now(),
    approved_by_id = v_actor_id,
    rejected_at = null,
    rejected_by_id = null,
    rejection_reason = null,
    updated_by_id = v_actor_id,
    updated_at = now()
  where id = p_entry_id;

  update public.entry_form_batches b
  set status = 'active'::public.entry_status
  where b.id = (select ef.batch_id from public.entry_forms ef where ef.id = p_entry_id)
    and not exists (
      select 1 from public.entry_forms ef
      where ef.batch_id = b.id
        and ef.status <> 'active'::public.entry_status
    );

  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    actor_email,
    entity_type,
    entity_id,
    action,
    previous_value,
    new_value,
    diff,
    context,
    reason
  ) values (
    v_actor_id,
    coalesce(v_actor_role, 'UNKNOWN'),
    v_actor_email,
    'entry_form',
    p_entry_id,
    'approve',
    jsonb_build_object('status', v_previous_status::text, 'is_locked', false),
    jsonb_build_object('status', 'active', 'is_locked', true),
    jsonb_build_object('status', jsonb_build_array(v_previous_status::text, 'active'), 'is_locked', jsonb_build_array(false, true)),
    jsonb_build_object('competitor_user_id', v_competitor_user_id),
    null
  );
end;
$$;

create or replace function public.reject_entry_form(p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_email text;
  v_previous_status public.entry_status;
  v_competitor_user_id uuid;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_or_secretary(v_actor_id) then
    raise exception 'Only Admin or Secretary can reject entry forms';
  end if;

  if v_reason is null then
    raise exception 'Rejection reason is required';
  end if;

  select ra.role_code::text
  into v_actor_role
  from public.role_assignments ra
  where ra.user_id = v_actor_id
    and ra.role_code in ('ADMIN'::public.role_code, 'SECRETARY'::public.role_code)
  order by case when ra.role_code = 'ADMIN'::public.role_code then 0 else 1 end
  limit 1;

  select u.email into v_actor_email from public.users u where u.id = v_actor_id;

  select en.status, en.competitor_user_id
  into v_previous_status, v_competitor_user_id
  from public.entries en
  where en.id = p_entry_id
    and en.deleted_at is null
  for update;

  if v_previous_status is null then
    raise exception 'Entry form not found';
  end if;

  if v_previous_status <> 'pending'::public.entry_status then
    raise exception 'Only pending entry forms can be rejected';
  end if;

  update public.entries
  set
    status = 'rejected'::public.entry_status,
    is_locked = false,
    approved_at = null,
    approved_by_id = null,
    rejected_at = now(),
    rejected_by_id = v_actor_id,
    rejection_reason = v_reason,
    updated_by_id = v_actor_id,
    updated_at = now()
  where id = p_entry_id;

  update public.entry_forms
  set
    status = 'rejected'::public.entry_status,
    is_locked = false,
    approved_at = null,
    approved_by_id = null,
    rejected_at = now(),
    rejected_by_id = v_actor_id,
    rejection_reason = v_reason,
    updated_by_id = v_actor_id,
    updated_at = now()
  where id = p_entry_id;

  update public.entry_form_batches b
  set status = 'rejected'::public.entry_status
  where b.id = (select ef.batch_id from public.entry_forms ef where ef.id = p_entry_id)
    and not exists (
      select 1 from public.entry_forms ef
      where ef.batch_id = b.id
        and ef.status <> 'rejected'::public.entry_status
    );

  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    actor_email,
    entity_type,
    entity_id,
    action,
    previous_value,
    new_value,
    diff,
    context,
    reason
  ) values (
    v_actor_id,
    coalesce(v_actor_role, 'UNKNOWN'),
    v_actor_email,
    'entry_form',
    p_entry_id,
    'reject',
    jsonb_build_object('status', v_previous_status::text),
    jsonb_build_object('status', 'rejected', 'rejection_reason', v_reason),
    jsonb_build_object('status', jsonb_build_array(v_previous_status::text, 'rejected')),
    jsonb_build_object('competitor_user_id', v_competitor_user_id),
    v_reason
  );
end;
$$;

revoke all on function public.is_admin_or_secretary(uuid) from public, anon;
revoke all on function public.get_secretary_pending_entries() from public, anon;
revoke all on function public.approve_entry_form(uuid) from public, anon;
revoke all on function public.reject_entry_form(uuid, text) from public, anon;

grant execute on function public.is_admin_or_secretary(uuid) to authenticated;
grant execute on function public.get_secretary_pending_entries() to authenticated;
grant execute on function public.approve_entry_form(uuid) to authenticated;
grant execute on function public.reject_entry_form(uuid, text) to authenticated;
