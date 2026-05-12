-- RaceDocV1 Inspection Audit FK Indexes
-- Purpose: cover audit/user foreign keys written by the Inspection Form workflow.

begin;

create index if not exists inspection_forms_created_by_id_idx
  on public.inspection_forms (created_by_id);

create index if not exists inspection_forms_updated_by_id_idx
  on public.inspection_forms (updated_by_id);

create index if not exists inspection_form_versions_inspected_by_id_idx
  on public.inspection_form_versions (inspected_by_id);

commit;
