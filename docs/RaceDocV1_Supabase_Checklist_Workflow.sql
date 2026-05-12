-- RaceDocV1 Checklist Workflow
-- Applied via Supabase MCP on 2026-05-12.
-- Purpose: manage candidate checklist items for Active Entry Forms with Admin/Secretary updates and competitor-visible read access.

create table if not exists public.entry_checklists (
  entry_id uuid primary key references public.entries(id) on delete cascade,
  competitor_checked_in boolean not null default false,
  sticker_issued boolean not null default false,
  payment_verified boolean not null default false,
  documents_verified boolean not null default false,
  wristband_issued boolean not null default false,
  notes text,
  checked_by_id uuid references public.users(id),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entry_checklists enable row level security;

create or replace function public.get_checklist_entries()
returns table (
  entry_id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  competitor_user_id uuid,
  competitor_name text,
  competitor_email text,
  status text,
  competitor_checked_in boolean,
  sticker_issued boolean,
  payment_verified boolean,
  documents_verified boolean,
  wristband_issued boolean,
  notes text,
  checked_by_name text,
  checked_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select
      auth.uid() as user_id,
      public.is_admin_or_secretary(auth.uid()) as elevated
  )
  select
    e.id as entry_id,
    ev.name as event_name,
    s.year as season_year,
    esc.series_class,
    e.car_number,
    e.competitor_user_id,
    coalesce(
      nullif(u.full_name, ''),
      nullif(btrim(concat_ws(' ', p.given_name_en, p.family_name_en)), ''),
      nullif(btrim(concat_ws(' ', p.given_name_th, p.family_name_th)), ''),
      u.email
    ) as competitor_name,
    u.email as competitor_email,
    e.status::text as status,
    coalesce(ec.competitor_checked_in, false) as competitor_checked_in,
    coalesce(ec.sticker_issued, false) as sticker_issued,
    coalesce(ec.payment_verified, false) as payment_verified,
    coalesce(ec.documents_verified, false) as documents_verified,
    coalesce(ec.wristband_issued, false) as wristband_issued,
    ec.notes,
    checker.full_name as checked_by_name,
    ec.checked_at,
    coalesce(ec.updated_at, e.updated_at) as updated_at
  from public.entries e
  join actor a on true
  join public.events ev on ev.id = e.event_id
  join public.seasons s on s.id = e.season_id
  join public.event_series_configs esc on esc.id = e.event_series_config_id
  join public.users u on u.id = e.competitor_user_id
  left join public.profiles p on p.user_id = e.competitor_user_id
  left join public.entry_checklists ec on ec.entry_id = e.id
  left join public.users checker on checker.id = ec.checked_by_id
  where e.deleted_at is null
    and e.status = 'active'::public.entry_status
    and (
      a.elevated
      or e.competitor_user_id = a.user_id
      or e.team_manager_id = a.user_id
      or e.created_by_id = a.user_id
    )
  order by ev.event_order nulls last, esc.series_class, e.car_number;
$$;

create or replace function public.update_entry_checklist(
  p_entry_id uuid,
  p_competitor_checked_in boolean default null,
  p_sticker_issued boolean default null,
  p_payment_verified boolean default null,
  p_documents_verified boolean default null,
  p_wristband_issued boolean default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_email text;
  v_previous jsonb;
  v_next jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_or_secretary(v_actor_id) then
    raise exception 'Only Admin or Secretary can update checklist items';
  end if;

  if not exists (
    select 1
    from public.entries e
    where e.id = p_entry_id
      and e.deleted_at is null
      and e.status = 'active'::public.entry_status
  ) then
    raise exception 'Active entry not found';
  end if;

  select ra.role_code::text
  into v_actor_role
  from public.role_assignments ra
  where ra.user_id = v_actor_id
    and ra.role_code in ('ADMIN'::public.role_code, 'SECRETARY'::public.role_code)
  order by case when ra.role_code = 'ADMIN'::public.role_code then 0 else 1 end
  limit 1;

  select u.email into v_actor_email from public.users u where u.id = v_actor_id;

  select to_jsonb(ec)
  into v_previous
  from public.entry_checklists ec
  where ec.entry_id = p_entry_id;

  insert into public.entry_checklists (
    entry_id,
    competitor_checked_in,
    sticker_issued,
    payment_verified,
    documents_verified,
    wristband_issued,
    notes,
    checked_by_id,
    checked_at,
    updated_at
  ) values (
    p_entry_id,
    coalesce(p_competitor_checked_in, false),
    coalesce(p_sticker_issued, false),
    coalesce(p_payment_verified, false),
    coalesce(p_documents_verified, false),
    coalesce(p_wristband_issued, false),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_actor_id,
    now(),
    now()
  ) on conflict (entry_id) do update set
    competitor_checked_in = coalesce(p_competitor_checked_in, public.entry_checklists.competitor_checked_in),
    sticker_issued = coalesce(p_sticker_issued, public.entry_checklists.sticker_issued),
    payment_verified = coalesce(p_payment_verified, public.entry_checklists.payment_verified),
    documents_verified = coalesce(p_documents_verified, public.entry_checklists.documents_verified),
    wristband_issued = coalesce(p_wristband_issued, public.entry_checklists.wristband_issued),
    notes = case when p_notes is null then public.entry_checklists.notes else nullif(btrim(p_notes), '') end,
    checked_by_id = v_actor_id,
    checked_at = now(),
    updated_at = now();

  select to_jsonb(ec)
  into v_next
  from public.entry_checklists ec
  where ec.entry_id = p_entry_id;

  update public.entries
  set
    admin_checklist = jsonb_build_object(
      'competitorCheckedIn', (v_next->>'competitor_checked_in')::boolean,
      'stickerIssued', (v_next->>'sticker_issued')::boolean,
      'paymentVerified', (v_next->>'payment_verified')::boolean,
      'documentsVerified', (v_next->>'documents_verified')::boolean,
      'wristbandIssued', (v_next->>'wristband_issued')::boolean,
      'notes', v_next->>'notes',
      'checkedById', v_actor_id,
      'checkedAt', now()
    ),
    updated_by_id = v_actor_id,
    updated_at = now()
  where id = p_entry_id;

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
    'entry_checklist',
    p_entry_id,
    'update',
    coalesce(v_previous, '{}'::jsonb),
    coalesce(v_next, '{}'::jsonb),
    jsonb_build_object('changed', true),
    jsonb_build_object('entry_id', p_entry_id),
    null
  );
end;
$$;

drop policy if exists "entry_checklists_select_visible" on public.entry_checklists;
create policy "entry_checklists_select_visible"
  on public.entry_checklists
  for select
  to authenticated
  using (
    public.is_admin_or_secretary(auth.uid())
    or exists (
      select 1
      from public.entries e
      where e.id = entry_checklists.entry_id
        and e.deleted_at is null
        and (
          e.competitor_user_id = auth.uid()
          or e.team_manager_id = auth.uid()
          or e.created_by_id = auth.uid()
        )
    )
  );

revoke all on function public.get_checklist_entries() from public, anon;
revoke all on function public.update_entry_checklist(uuid, boolean, boolean, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.get_checklist_entries() to authenticated;
grant execute on function public.update_entry_checklist(uuid, boolean, boolean, boolean, boolean, boolean, text) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
