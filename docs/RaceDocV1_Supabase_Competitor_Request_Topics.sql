-- RaceDocV1 Competitor Request Topics
-- Purpose: support multiple standardized request topics per Competitor Request
-- while keeping a structured payload for future approval-side data writeback.

create table if not exists public.competitor_request_topic_options (
  code text primary key,
  thai_label text not null,
  english_label text not null,
  sort_order integer not null,
  requires_other_detail boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.competitor_request_topic_options enable row level security;

drop policy if exists admin_all on public.competitor_request_topic_options;
create policy admin_all on public.competitor_request_topic_options
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists authenticated_read on public.competitor_request_topic_options;
create policy authenticated_read on public.competitor_request_topic_options
  for select to authenticated
  using (is_active = true);

insert into public.competitor_request_topic_options (code, thai_label, english_label, sort_order, requires_other_detail, is_active)
values
  ('CHANGE_ENGINE', 'เปลี่ยนเครื่องยนต์', 'Change engine', 10, false, true),
  ('CUT_ENGINE_SEAL', 'ตัดซีลเครื่องยนต์', 'Cut engine seal', 20, false, true),
  ('CHANGE_GEARBOX', 'เปลี่ยนเกียร์', 'Change gearbox', 30, false, true),
  ('CUT_GEARBOX_SEAL', 'ตัดซีลเกียร์', 'Cut gearbox seal', 40, false, true),
  ('TAKE_CAR_OUT_OF_CIRCUIT', 'นำรถออกนอกสนาม', 'Take car out of circuit', 50, false, true),
  ('LATE_SCRUTINEERING', 'ขอตรวจสภาพรถแข่ง/ชุดแข่งล่าช้า', 'Request late car/race suit scrutineering', 60, false, true),
  ('CANCEL_QUALIFY_TIME', 'ขอไม่นับเวลาการแข่งขัน (Qualify)', 'Request qualify time cancellation', 70, false, true),
  ('TIRE_MARKING', 'มาร์กยาง', 'Tire marking', 80, false, true),
  ('EXPIRED_EQUIPMENT_PERMISSION', 'ขออนุญาตใช้อุปกรณ์ที่หมดอายุ', 'Request permission to use expired equipment', 90, false, true),
  ('SPECIAL_EQUIPMENT_PERMISSION', 'ขออนุญาตใช้/ไม่ใช้ อุปกรณ์ที่ตรวจ / สภาพอนุญาตเป็นกรณีพิเศษ', 'Special permission to use/not use inspected equipment', 100, false, true),
  ('CHANGE_TEAM_NAME', 'เปลี่ยนชื่อทีมแข่ง', 'Change team name', 110, false, true),
  ('CHANGE_DRIVER_DURING_EVENT', 'เปลี่ยนนักแข่งระหว่าง event', 'Change driver during event', 120, false, true),
  ('CHANGE_CAR_DURING_EVENT', 'เปลี่ยนรถแข่งระหว่าง event', 'Change race car during event', 130, false, true),
  ('ABSENT_DRIVER_BRIEFING', 'ขอไม่เข้าร่วมประชุมนักแข่ง', 'Request absence from driver briefing', 140, false, true),
  ('SEND_DRIVER_BRIEFING_REPRESENTATIVE', 'ขอส่งตัวแทนเข้าประชุมนักแข่ง', 'Send representative to driver briefing', 150, false, true),
  ('WITHDRAW_FROM_COMPETITION', 'ขอไม่เข้าร่วมการแข่งขัน', 'Withdraw from competition', 160, false, true),
  ('OTHER', 'อื่นๆ (โปรดระบุ)', 'Other (please specify)', 170, true, true)
on conflict (code) do update set
  thai_label = excluded.thai_label,
  english_label = excluded.english_label,
  sort_order = excluded.sort_order,
  requires_other_detail = excluded.requires_other_detail,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.competitor_requests
  add column if not exists request_topics jsonb not null default '[]'::jsonb;

alter table public.competitor_requests
  drop constraint if exists competitor_requests_request_topics_array_chk;

alter table public.competitor_requests
  add constraint competitor_requests_request_topics_array_chk
  check (jsonb_typeof(request_topics) = 'array');

create index if not exists competitor_requests_request_topics_gin_idx
  on public.competitor_requests using gin (request_topics);

update public.competitor_requests
set request_topics = jsonb_build_array(jsonb_build_object(
      'code', 'LEGACY',
      'label', topic,
      'thaiLabel', topic,
      'englishLabel', null,
      'otherText', null
    ))
where request_topics = '[]'::jsonb
  and nullif(btrim(coalesce(topic, '')), '') is not null;

create or replace function public.get_competitor_request_topic_options()
returns table(
  code text,
  thai_label text,
  english_label text,
  display_label text,
  requires_other_detail boolean,
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    crto.code,
    crto.thai_label,
    crto.english_label,
    crto.thai_label || ' / ' || crto.english_label as display_label,
    crto.requires_other_detail,
    crto.sort_order
  from public.competitor_request_topic_options crto
  where crto.is_active = true
  order by crto.sort_order, crto.thai_label;
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
  request_topics jsonb,
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
    cr.request_topics,
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

drop function if exists public.create_competitor_request(uuid, text, text, uuid, jsonb);

create or replace function public.create_competitor_request(
  p_entry_id uuid,
  p_topic text default null,
  p_description text default null,
  p_race_id uuid default null,
  p_requested_change jsonb default '{}'::jsonb,
  p_request_topics jsonb default '[]'::jsonb
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
  v_topics jsonb := coalesce(p_request_topics, '[]'::jsonb);
  v_normalized_topics jsonb;
  v_topic_summary text;
  v_topic_count integer;
  v_distinct_topic_count integer;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if nullif(btrim(coalesce(p_description, '')), '') is null then
    raise exception 'Request description is required.';
  end if;

  if jsonb_typeof(v_topics) <> 'array' then
    raise exception 'Request topics must be an array.';
  end if;

  select jsonb_array_length(v_topics) into v_topic_count;

  if v_topic_count = 0 and nullif(btrim(coalesce(p_topic, '')), '') is null then
    raise exception 'Select at least one request topic.';
  end if;

  if v_topic_count > 0 then
    select count(*), count(distinct topic_item.value ->> 'code')
      into v_topic_count, v_distinct_topic_count
    from jsonb_array_elements(v_topics) as topic_item(value);

    if v_topic_count <> v_distinct_topic_count then
      raise exception 'Duplicate request topics are not allowed.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_topics) as topic_item(value)
      left join public.competitor_request_topic_options option_row
        on option_row.code = topic_item.value ->> 'code'
       and option_row.is_active = true
      where option_row.code is null
    ) then
      raise exception 'One or more request topics are not configured.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_topics) as topic_item(value)
      join public.competitor_request_topic_options option_row on option_row.code = topic_item.value ->> 'code'
      where option_row.requires_other_detail = true
        and nullif(btrim(coalesce(topic_item.value ->> 'otherText', '')), '') is null
    ) then
      raise exception 'Please specify details for Other request topic.';
    end if;

    select
      jsonb_agg(
        jsonb_build_object(
          'code', option_row.code,
          'label', option_row.thai_label || ' / ' || option_row.english_label,
          'thaiLabel', option_row.thai_label,
          'englishLabel', option_row.english_label,
          'otherText', nullif(btrim(coalesce(topic_item.value ->> 'otherText', '')), '')
        ) order by option_row.sort_order
      ),
      string_agg(
        case
          when option_row.requires_other_detail then option_row.thai_label || ' / ' || option_row.english_label || ': ' || nullif(btrim(coalesce(topic_item.value ->> 'otherText', '')), '')
          else option_row.thai_label || ' / ' || option_row.english_label
        end,
        ', ' order by option_row.sort_order
      )
      into v_normalized_topics, v_topic_summary
    from jsonb_array_elements(v_topics) as topic_item(value)
    join public.competitor_request_topic_options option_row on option_row.code = topic_item.value ->> 'code';
  else
    v_topic_summary := btrim(p_topic);
    v_normalized_topics := jsonb_build_array(jsonb_build_object(
      'code', 'LEGACY',
      'label', v_topic_summary,
      'thaiLabel', v_topic_summary,
      'englishLabel', null,
      'otherText', null
    ));
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

  select lpad((coalesce(max(nullif(regexp_replace(queue_no, '\D', '', 'g'), '')::integer), 0) + 1)::text, 3, '0')
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
    request_topics,
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
    v_topic_summary,
    coalesce(v_normalized_topics, '[]'::jsonb),
    v_status,
    jsonb_build_object(
      'description', btrim(p_description),
      'requestedChange', coalesce(p_requested_change, '{}'::jsonb),
      'topics', coalesce(v_normalized_topics, '[]'::jsonb),
      'futureWritebackStatus', 'PendingTopicMapping'
    ),
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
    jsonb_build_object('entry_form_id', p_entry_id, 'topic', v_topic_summary, 'topics', v_normalized_topics, 'queue_no', v_queue_no),
    v_status::text,
    v_actor_profile_id
  );

  return v_request_id;
end;
$$;

revoke execute on function public.get_competitor_request_topic_options() from public, anon;
revoke execute on function public.get_competitor_requests() from public, anon;
revoke execute on function public.create_competitor_request(uuid, text, text, uuid, jsonb, jsonb) from public, anon;

grant execute on function public.get_competitor_request_topic_options() to authenticated, service_role;
grant execute on function public.get_competitor_requests() to authenticated, service_role;
grant execute on function public.create_competitor_request(uuid, text, text, uuid, jsonb, jsonb) to authenticated, service_role;
