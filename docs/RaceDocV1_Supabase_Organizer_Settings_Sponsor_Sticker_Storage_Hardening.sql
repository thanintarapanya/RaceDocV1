-- RaceDocV1 Organizer Settings Sponsor Sticker Storage Hardening
-- Purpose: Keep public URL delivery while preventing public object listing.
-- Apply after RaceDocV1_Supabase_Organizer_Settings_Sponsor_Stickers.sql.

drop policy if exists organizer_assets_select_public on storage.objects;
drop policy if exists organizer_assets_select_admin on storage.objects;

create policy organizer_assets_select_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'organizer_assets'
  and public.has_role('ADMIN', null)
  and (storage.foldername(name))[1] = 'sponsor-stickers'
);
