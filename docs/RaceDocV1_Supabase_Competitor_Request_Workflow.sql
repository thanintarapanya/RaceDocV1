-- RaceDocV1 Competitor Request Workflow
-- Purpose: first functional request workflow slice with dropdown-safe active
-- entry selection, requester consent rules, secretary final decision, and
-- penalty weight sync to Weight-In via ballast_ledger.

begin;

alter table public.competitor_requests
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists competitor_requests_entry_status_idx
  on public.competitor_requests (entry_form_id, status);

create index if not exists competitor_requests_requester_idx
  on public.competitor_requests (requester_profile_id);

create index if not exists competitor_requests_submitted_by_idx
  on public.competitor_requests (submitted_by_id);

create index if not exists competitor_requests_race_id_idx
  on public.competitor_requests (race_id);

create index if not exists request_approvals_request_id_idx
  on public.request_approvals (competitor_request_id);

create or replace function public.get_competitor_request_entry_options()
returns table(
  entry_id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  competitor_name text,
  vehicle_summary text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ef.id as entry_id,
    ev.name as event_name,
    s.year as season_year,
    sr.name || ' - ' || g.name as series_class,
    ef.car_number,
    coalesce(
      nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''),
      nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''),
      'Competitor'
    ) as competitor_name,
    nullif(btrim(concat_ws(' ', ef.vehicle_snapshot ->> 'manufacturer', ef.vehicle_snapshot ->> 'model')), '') as vehicle_summary
  from public.entry_forms ef
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles p on p.id = ef.competitor_profile_id
  where ef.deleted_at is null
    and ef.status = 'Active'::public.entry_form_status
    and public.can_manage_competitor(ef.competitor_profile_id, ef.season_id)
  order by s.year desc, ev.event_order, sr.name, g.sort_order, ef.car_number;
$$;

create or replace function public.get_competitor_requests()
returns table(
  request_id uuid,
  entry_id uuid,
  race_id uuid,
  event_name text,
  season_year integer,
  series_class text,
  car_number text,
  competitor_name text,
  competitor_email text,
  queue_no text,
  topic text,
  status text,
  racer_consent_status text,
  fine_amount numeric,
  penalty_weight_kg numeric,
  grid_penalty text,
  request_payload jsonb,
  final_comment text,
  created_at timestamptz,
  updated_at timestamptz,
  can_racer_consent boolean,
  can_final_decide boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.current_profile_id() as profile_id,
      public.has_any_role(array['ADMIN', 'SECRETARY', 'HEAD_SCRUTINEER', 'SCRUTINEER_STAFF', 'OFFSITE_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK'], null) as can_read_all,
      public.has_any_role(array['ADMIN', 'SECRETARY'], null) as can_decide
  )
  select
    cr.id as request_id,
    ef.id as entry_id,
    cr.race_id,
    ev.name as event_name,
    s.year as season_year,
    sr.name || ' - ' || g.name as series_class,
    ef.car_number,
    coalesce(
      nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''),
      nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''),
      au.email,
      'Competitor'
    ) as competitor_name,
    coalesce(au.email, '') as competitor_email,
    cr.queue_no,
    cr.topic,
    cr.status::text,
    cr.racer_consent_status::text,
    cr.fine_amount,
    cr.penalty_weight_kg,
    cr.grid_penalty,
    cr.request_payload,
    cr.final_comment,
    cr.created_at,
    cr.updated_at,
    (cr.status = 'Need Racer Approval'::public.competitor_request_status and ef.competitor_profile_id = ctx.profile_id) as can_racer_consent,
    (cr.status in ('Pending'::public.competitor_request_status, 'In Review'::public.competitor_request_status) and ctx.can_decide) as can_final_decide
  from public.competitor_requests cr
  join public.entry_forms ef on ef.id = cr.entry_form_id
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles p on p.id = ef.competitor_profile_id
  left join auth.users au on au.id = p.auth_user_id
  cross join ctx
  where cr.deleted_at is null
    and (ctx.can_read_all or public.can_access_competitor_request(cr.id))
  order by cr.created_at desc, cr.queue_no desc;
$$;

create or replace function public.create_competitor_request(
  p_entry_id uuid,
  p_topic text,
  p_description text,
  p_race_id uuid default null,
  p_requested_change jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_entry public.entry_forms%rowtype;
  v_queue_no text;
  v_request_id uuid;
  v_status public.competitor_request_status;
  v_consent public.racer_consent_status;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if nullif(btrim(coalesce(p_topic, '')), '') is null then
    raise exception 'Request topic is required.';
  end if;

  if nullif(btrim(coalesce(p_description, '')), '') is null then
    raise exception 'Request description is required.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = p_entry_id
    and deleted_at is null;

  if v_entry.id is null then
    raise exception 'Entry Form was not found.';
  end if;

  if v_entry.status <> 'Active'::public.entry_form_status then
    raise exception 'Competitor Requests can only be created for Active Entry Forms.';
  end if;

  if not public.can_manage_competitor(v_entry.competitor_profile_id, v_entry.season_id) then
    raise exception 'You can only create requests for your own active entries or accepted team competitors.';
  end if;

  if v_actor_profile_id = v_entry.competitor_profile_id then
    v_status := 'Pending'::public.competitor_request_status;
    v_consent := 'Approved'::public.racer_consent_status;
  else
    v_status := 'Need Racer Approval'::public.competitor_request_status;
    v_consent := 'Pending'::public.racer_consent_status;
  end if;

  select lpad((coalesce(max(nullif(regexp_replace(queue_no, '\\D', '', 'g'), '')::integer), 0) + 1)::text, 3, '0')
    into v_queue_no
  from public.competitor_requests
  where entry_form_id in (
    select id
    from public.entry_forms
    where event_id = v_entry.event_id
  );

  insert into public.competitor_requests (
    entry_form_id,
    race_id,
    requester_profile_id,
    submitted_by_id,
    queue_no,
    topic,
    status,
    request_payload,
    racer_consent_status,
    racer_consented_at,
    created_at,
    updated_at
  ) values (
    p_entry_id,
    p_race_id,
    v_entry.competitor_profile_id,
    v_actor_profile_id,
    v_queue_no,
    btrim(p_topic),
    v_status,
    jsonb_build_object('description', btrim(p_description), 'requestedChange', coalesce(p_requested_change, '{}'::jsonb)),
    v_consent,
    case when v_consent = 'Approved'::public.racer_consent_status then now() else null end,
    now(),
    now()
  ) returning id into v_request_id;

  insert into public.audit_logs (entity_type, entity_id, action, new_values, new_status, action_by_id)
  values (
    'competitor_request',
    v_request_id,
    'create',
    jsonb_build_object('entry_form_id', p_entry_id, 'topic', btrim(p_topic), 'queue_no', v_queue_no),
    v_status::text,
    v_actor_profile_id
  );

  return v_request_id;
end;
$$;

create or replace function public.respond_competitor_request_consent(
  p_request_id uuid,
  p_accept boolean,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_request public.competitor_requests%rowtype;
  v_entry public.entry_forms%rowtype;
  v_next_status public.competitor_request_status;
  v_next_consent public.racer_consent_status;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_request
  from public.competitor_requests
  where id = p_request_id
    and deleted_at is null
  for update;

  if v_request.id is null then
    raise exception 'Competitor Request was not found.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = v_request.entry_form_id;

  if v_entry.competitor_profile_id <> v_actor_profile_id then
    raise exception 'Only the competitor can approve or reject this Team Manager request.';
  end if;

  if v_request.status <> 'Need Racer Approval'::public.competitor_request_status then
    raise exception 'This request is not waiting for racer approval.';
  end if;

  v_next_status := case when p_accept then 'Pending'::public.competitor_request_status else 'Rejected'::public.competitor_request_status end;
  v_next_consent := case when p_accept then 'Approved'::public.racer_consent_status else 'Rejected'::public.racer_consent_status end;

  update public.competitor_requests
  set status = v_next_status,
      racer_consent_status = v_next_consent,
      racer_consented_at = now(),
      final_decision_by_id = case when p_accept then final_decision_by_id else v_actor_profile_id end,
      final_decision_at = case when p_accept then final_decision_at else now() end,
      final_comment = case when p_accept then final_comment else nullif(btrim(coalesce(p_comment, '')), '') end,
      updated_at = now()
  where id = p_request_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'competitor_request',
    p_request_id,
    case when p_accept then 'racer_consent_approve' else 'racer_consent_reject' end,
    v_request.status::text,
    v_next_status::text,
    jsonb_build_object('comment', nullif(btrim(coalesce(p_comment, '')), '')),
    v_actor_profile_id
  );
end;
$$;

create or replace function public.finalize_competitor_request(
  p_request_id uuid,
  p_approve boolean,
  p_comment text,
  p_fine_amount numeric default null,
  p_penalty_weight_kg numeric default null,
  p_grid_penalty text default null,
  p_race_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_request public.competitor_requests%rowtype;
  v_next_status public.competitor_request_status;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_any_role(array['ADMIN', 'SECRETARY'], null) then
    raise exception 'Only Admin or Secretary can finalize Competitor Requests.';
  end if;

  if nullif(btrim(coalesce(p_comment, '')), '') is null then
    raise exception 'Final comment is required.';
  end if;

  if coalesce(p_fine_amount, 0) < 0 or coalesce(p_penalty_weight_kg, 0) < 0 then
    raise exception 'Fine and penalty weight must be non-negative.';
  end if;

  select * into v_request
  from public.competitor_requests
  where id = p_request_id
    and deleted_at is null
  for update;

  if v_request.id is null then
    raise exception 'Competitor Request was not found.';
  end if;

  if v_request.status not in ('Pending'::public.competitor_request_status, 'In Review'::public.competitor_request_status) then
    raise exception 'Only Pending or In Review requests can be finalized.';
  end if;

  v_next_status := case when p_approve then 'Approved'::public.competitor_request_status else 'Rejected'::public.competitor_request_status end;

  update public.competitor_requests
  set status = v_next_status,
      fine_amount = p_fine_amount,
      penalty_weight_kg = p_penalty_weight_kg,
      grid_penalty = nullif(btrim(coalesce(p_grid_penalty, '')), ''),
      race_id = coalesce(p_race_id, race_id),
      final_decision_by_id = v_actor_profile_id,
      final_decision_at = now(),
      final_comment = btrim(p_comment),
      updated_at = now()
  where id = p_request_id;

  if p_approve and coalesce(p_penalty_weight_kg, 0) > 0 then
    insert into public.ballast_ledger (
      entry_form_id,
      race_id,
      ballast_kg,
      source_type,
      source_id,
      applies_to_next_race
    ) values (
      v_request.entry_form_id,
      coalesce(p_race_id, v_request.race_id),
      p_penalty_weight_kg,
      'Penalty',
      p_request_id,
      true
    );
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'competitor_request',
    p_request_id,
    'final_decision',
    v_request.status::text,
    v_next_status::text,
    jsonb_build_object(
      'comment', btrim(p_comment),
      'fine_amount', p_fine_amount,
      'penalty_weight_kg', p_penalty_weight_kg,
      'grid_penalty', nullif(btrim(coalesce(p_grid_penalty, '')), '')
    ),
    v_actor_profile_id
  );
end;
$$;

revoke execute on function public.get_competitor_request_entry_options() from public, anon;
revoke execute on function public.get_competitor_requests() from public, anon;
revoke execute on function public.create_competitor_request(uuid, text, text, uuid, jsonb) from public, anon;
revoke execute on function public.respond_competitor_request_consent(uuid, boolean, text) from public, anon;
revoke execute on function public.finalize_competitor_request(uuid, boolean, text, numeric, numeric, text, uuid) from public, anon;

grant execute on function public.get_competitor_request_entry_options() to authenticated, service_role;
grant execute on function public.get_competitor_requests() to authenticated, service_role;
grant execute on function public.create_competitor_request(uuid, text, text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.respond_competitor_request_consent(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.finalize_competitor_request(uuid, boolean, text, numeric, numeric, text, uuid) to authenticated, service_role;

commit;
