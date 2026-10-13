-- Restore selfie uploads: allow the anon/authenticated roles to INSERT objects into the 'photos' bucket.
-- OWNER-RUN, NOT APPLIED. Run section 0 first and read the output, then section 1.

-- 0. Read-only checks ---------------------------------------------------------
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'photos';
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects';
-- Expect: one 'photos' row with public = true. If it is missing, create it (public) in the dashboard first.
-- If file_size_limit / allowed_mime_types are set, make sure they allow image/jpeg and ~500 KB.

-- 1. Guarded policy -----------------------------------------------------------
-- Mirrors the app's existing all-anon write model (the site has no per-user auth for writes).
-- Insert only; no update/delete, and only into the 'photos' bucket.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'anon upload selfies to photos'
  ) then
    create policy "anon upload selfies to photos"
      on storage.objects for insert
      to anon, authenticated
      with check (bucket_id = 'photos');
  end if;
end $$;

-- Rollback:
-- drop policy if exists "anon upload selfies to photos" on storage.objects;
