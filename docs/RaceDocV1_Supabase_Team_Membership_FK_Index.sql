-- RaceDocV1 Team Membership FK Index
-- Purpose: cover the created_by_id FK used for relationship audit/source lookups.

begin;

create index if not exists team_memberships_created_by_id_idx
  on public.team_memberships (created_by_id);

commit;
