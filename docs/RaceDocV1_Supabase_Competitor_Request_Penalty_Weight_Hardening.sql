-- RaceDocV1 Competitor Request Penalty Weight Hardening
-- Purpose: make approved Competitor Request penalty weights idempotent in
-- ballast_ledger so Weight-In target calculations cannot double-count retries.

begin;

create unique index if not exists ballast_ledger_penalty_source_uk
  on public.ballast_ledger (source_type, source_id)
  where source_type = 'Penalty'
    and source_id is not null;

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
  v_entry public.entry_forms%rowtype;
  v_next_status public.competitor_request_status;
  v_effective_race_id uuid;
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

  select * into v_entry
  from public.entry_forms
  where id = v_request.entry_form_id
    and deleted_at is null;

  if v_entry.id is null then
    raise exception 'Entry Form was not found.';
  end if;

  v_effective_race_id := coalesce(p_race_id, v_request.race_id);

  if v_effective_race_id is not null and not exists (
    select 1
    from public.races r
    where r.id = v_effective_race_id
      and r.event_id = v_entry.event_id
  ) then
    raise exception 'Penalty race must belong to the Competitor Request event.';
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
      v_effective_race_id,
      p_penalty_weight_kg,
      'Penalty',
      p_request_id,
      true
    )
    on conflict (source_type, source_id)
      where source_type = 'Penalty'
        and source_id is not null
    do update set
      entry_form_id = excluded.entry_form_id,
      race_id = excluded.race_id,
      ballast_kg = excluded.ballast_kg,
      applies_to_next_race = true;
  else
    delete from public.ballast_ledger
    where source_type = 'Penalty'
      and source_id = p_request_id;
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
      'grid_penalty', nullif(btrim(coalesce(p_grid_penalty, '')), ''),
      'race_id', v_effective_race_id
    ),
    v_actor_profile_id
  );
end;
$$;

revoke execute on function public.finalize_competitor_request(uuid, boolean, text, numeric, numeric, text, uuid) from public, anon;
grant execute on function public.finalize_competitor_request(uuid, boolean, text, numeric, numeric, text, uuid) to authenticated, service_role;

commit;
