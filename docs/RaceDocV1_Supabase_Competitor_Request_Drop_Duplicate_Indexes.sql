-- RaceDocV1 Competitor Request Duplicate Index Cleanup
-- Purpose: remove duplicate indexes introduced by the first request workflow
-- migration while keeping existing equivalent FK indexes.

begin;

drop index if exists public.competitor_requests_requester_idx;
drop index if exists public.competitor_requests_submitted_by_idx;

commit;
