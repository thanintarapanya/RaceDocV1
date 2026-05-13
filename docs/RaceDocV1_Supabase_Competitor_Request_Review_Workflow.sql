-- RaceDocV1 Competitor Request Review Workflow
-- Purpose: allow Admin/Secretary to send a Competitor Request to officials
-- for recommendation before the final Secretary/Admin decision.

create index if not exists request_approvals_approver_status_idx
  on public.request_approvals (approver_profile_id, status);

create or replace function public.get_competitor_request_reviewer_options()
returns table(
  profile_id uuid,
  role_code text,
  role_name text,
  display_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.id, r.code)
    p.id as profile_id,
    r.code as role_code,
    r.name as role_name,
    coalesce(
      nullif(btrim(concat_ws(' ', p.first_name_th, p.last_name_th)), ''),
      nullif(btrim(concat_ws(' ', p.first_name_en, p.last_name_en)), ''),
      au.email,
      r.name
    ) as display_name,
    coalesce(au.email, '') as email
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.profile_id
  left join auth.users au on au.id = p.auth_user_id
  where public.has_any_role(array['ADMIN', 'SECRETARY'], null)
    and ur.is_active = true
    and r.code in ('HEAD_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK')
  order by p.id, r.code, display_name;
$$;

drop function if exists public.get_competitor_requests();

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
  approvals jsonb,
  can_racer_consent boolean,
  can_final_decide boolean,
  can_assign_reviewers boolean
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
    coalesce(approval_rows.approvals, '[]'::jsonb) as approvals,
    (cr.status = 'Need Racer Approval'::public.competitor_request_status and ef.competitor_profile_id = ctx.profile_id) as can_racer_consent,
    (cr.status in ('Pending'::public.competitor_request_status, 'In Review'::public.competitor_request_status) and ctx.can_decide) as can_final_decide,
    (cr.status in ('Pending'::public.competitor_request_status, 'In Review'::public.competitor_request_status) and ctx.can_decide) as can_assign_reviewers
  from public.competitor_requests cr
  join public.entry_forms ef on ef.id = cr.entry_form_id
  join public.events ev on ev.id = ef.event_id
  join public.seasons s on s.id = ef.season_id
  join public.series_races sr on sr.id = ef.series_race_id
  join public.grades g on g.id = ef.grade_id
  join public.profiles p on p.id = ef.competitor_profile_id
  left join auth.users au on au.id = p.auth_user_id
  cross join ctx
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'approvalId', ra.id,
        'approverProfileId', ra.approver_profile_id,
        'approverRoleCode', ra.approver_role_code,
        'approverName', coalesce(
          nullif(btrim(concat_ws(' ', ap.first_name_th, ap.last_name_th)), ''),
          nullif(btrim(concat_ws(' ', ap.first_name_en, ap.last_name_en)), ''),
          approver_auth.email,
          ra.approver_role_code
        ),
        'status', ra.status::text,
        'comment', ra.comment,
        'decidedAt', ra.decided_at,
        'canDecideApproval', ra.status = 'Pending'::public.request_approval_status and ra.approver_profile_id = ctx.profile_id
      ) order by ra.decided_at nulls first, ra.approver_role_code
    ) as approvals
    from public.request_approvals ra
    join public.profiles ap on ap.id = ra.approver_profile_id
    left join auth.users approver_auth on approver_auth.id = ap.auth_user_id
    where ra.competitor_request_id = cr.id
  ) approval_rows on true
  where cr.deleted_at is null
    and (ctx.can_read_all or public.can_access_competitor_request(cr.id))
  order by cr.created_at desc, cr.queue_no desc;
$$;

create or replace function public.assign_competitor_request_reviewers(
  p_request_id uuid,
  p_reviewers jsonb
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
  v_reviewer record;
  v_row_count integer := 0;
  v_inserted_count integer := 0;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_any_role(array['ADMIN', 'SECRETARY'], null) then
    raise exception 'Only Admin or Secretary can assign request reviewers.';
  end if;

  if jsonb_typeof(coalesce(p_reviewers, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_reviewers, '[]'::jsonb)) = 0 then
    raise exception 'Select at least one reviewer.';
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
    raise exception 'Only Pending or In Review requests can be sent for review.';
  end if;

  select * into v_entry
  from public.entry_forms
  where id = v_request.entry_form_id;

  for v_reviewer in
    select
      (reviewer_item.value ->> 'profileId')::uuid as profile_id,
      btrim(reviewer_item.value ->> 'roleCode') as role_code
    from jsonb_array_elements(p_reviewers) as reviewer_item(value)
  loop
    if v_reviewer.role_code not in ('HEAD_SCRUTINEER', 'CHAIRMAN', 'STEWARD', 'CLERK') then
      raise exception 'Reviewer role % is not allowed for Competitor Request review.', v_reviewer.role_code;
    end if;

    if not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.profile_id = v_reviewer.profile_id
        and ur.is_active = true
        and r.code = v_reviewer.role_code
        and (ur.season_id is null or ur.season_id = v_entry.season_id)
    ) then
      raise exception 'Selected reviewer does not hold the requested active role.';
    end if;

    insert into public.request_approvals (
      competitor_request_id,
      approver_profile_id,
      approver_role_code,
      status,
      comment,
      decided_at
    ) values (
      p_request_id,
      v_reviewer.profile_id,
      v_reviewer.role_code,
      'Pending'::public.request_approval_status,
      null,
      null
    )
    on conflict (competitor_request_id, approver_profile_id, approver_role_code) do nothing;

    get diagnostics v_row_count = row_count;
    v_inserted_count := v_inserted_count + v_row_count;
  end loop;

  update public.competitor_requests
  set status = 'In Review'::public.competitor_request_status,
      updated_at = now()
  where id = p_request_id;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'competitor_request',
    p_request_id,
    'assign_reviewers',
    v_request.status::text,
    'In Review',
    jsonb_build_object('reviewers', p_reviewers, 'new_assignment_count', v_inserted_count),
    v_actor_profile_id
  );
end;
$$;

create or replace function public.submit_competitor_request_review(
  p_approval_id uuid,
  p_approve boolean,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_approval public.request_approvals%rowtype;
  v_request public.competitor_requests%rowtype;
  v_next_status public.request_approval_status;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if nullif(btrim(coalesce(p_comment, '')), '') is null then
    raise exception 'Review comment is required.';
  end if;

  select * into v_approval
  from public.request_approvals
  where id = p_approval_id
  for update;

  if v_approval.id is null then
    raise exception 'Request review assignment was not found.';
  end if;

  if v_approval.approver_profile_id <> v_actor_profile_id then
    raise exception 'Only the assigned official can submit this review.';
  end if;

  if v_approval.status <> 'Pending'::public.request_approval_status then
    raise exception 'This review has already been submitted.';
  end if;

  select * into v_request
  from public.competitor_requests
  where id = v_approval.competitor_request_id
    and deleted_at is null
  for update;

  if v_request.id is null then
    raise exception 'Competitor Request was not found.';
  end if;

  if v_request.status not in ('Pending'::public.competitor_request_status, 'In Review'::public.competitor_request_status) then
    raise exception 'Only open requests can receive reviewer recommendations.';
  end if;

  v_next_status := case when p_approve then 'Approved'::public.request_approval_status else 'Rejected'::public.request_approval_status end;

  update public.request_approvals
  set status = v_next_status,
      comment = btrim(p_comment),
      decided_at = now()
  where id = p_approval_id;

  update public.competitor_requests
  set status = 'In Review'::public.competitor_request_status,
      updated_at = now()
  where id = v_request.id
    and status = 'Pending'::public.competitor_request_status;

  insert into public.audit_logs (entity_type, entity_id, action, previous_status, new_status, new_values, action_by_id)
  values (
    'competitor_request',
    v_request.id,
    'review_recommendation',
    v_approval.status::text,
    v_next_status::text,
    jsonb_build_object('approval_id', p_approval_id, 'role_code', v_approval.approver_role_code, 'comment', btrim(p_comment)),
    v_actor_profile_id
  );
end;
$$;

revoke execute on function public.get_competitor_request_reviewer_options() from public, anon;
revoke execute on function public.get_competitor_requests() from public, anon;
revoke execute on function public.assign_competitor_request_reviewers(uuid, jsonb) from public, anon;
revoke execute on function public.submit_competitor_request_review(uuid, boolean, text) from public, anon;

grant execute on function public.get_competitor_request_reviewer_options() to authenticated, service_role;
grant execute on function public.get_competitor_requests() to authenticated, service_role;
grant execute on function public.assign_competitor_request_reviewers(uuid, jsonb) to authenticated, service_role;
grant execute on function public.submit_competitor_request_review(uuid, boolean, text) to authenticated, service_role;
