-- Automatic referral points (2026-10-26). NOT applied -- run by hand in the SQL Editor.
--
-- members.referred_by_id = id of the member who referred this person. Set by
-- the interest form's member picker, or by an officer linking an old free-text
-- referral on the Applications page. Referral points (Recruitment: +1 when the
-- person applies, +2 at their first meeting) are DERIVED from it in
-- utils/fanTier.ts -- no bonus_points rows are written.
--
-- The free-text members.referred_by column stays as-is (still filled with the
-- picked member's full name, for backward compatibility).
--
-- Safe to run more than once. The app works before this is run (it retries
-- without the column and the referral picker/points just don't stick).

alter table public.members add column if not exists referred_by_id text;

-- members uses column-level grants (see 20261012_security_rls_review.sql), so a
-- new column must be granted explicitly or the client gets "permission denied".
-- The interest form inserts it and the Applications page updates it.
grant select (referred_by_id), insert (referred_by_id), update (referred_by_id)
  on public.members to anon, authenticated;

-- Verify (expect true, true, true):
select has_column_privilege('anon', 'public.members', 'referred_by_id', 'select') as anon_select,
       has_column_privilege('anon', 'public.members', 'referred_by_id', 'insert') as anon_insert,
       has_column_privilege('anon', 'public.members', 'referred_by_id', 'update') as anon_update;

-- ROLLBACK:
--   alter table public.members drop column if exists referred_by_id;
