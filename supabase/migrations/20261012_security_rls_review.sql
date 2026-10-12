-- Security / RLS review (2026-10-12). NOT applied -- run by hand in the SQL Editor.
--
-- STEP 0: run these first and look at the output.
--
--   select * from pg_policies;
--   select has_column_privilege('anon', 'public.members', 'password', 'select') as anon_can_read_password,
--          has_column_privilege('authenticated', 'public.members', 'password', 'select') as authed_can_read_password;
--   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
--
-- WHAT THE REVIEW FOUND (probed read-only with the public anon key):
--   * update_schema_v4_secure_login.sql did `revoke select (password) ... from anon`.
--     That is a NO-OP when anon already holds a TABLE-level SELECT grant (the
--     Supabase default): a column-level revoke does not subtract from a table grant.
--     Result: anon CAN select/filter members.password today (37 bcrypt hashes
--     exist). The client never asks for it, but anyone with the public anon key
--     can pull every hash (incl. the 5 Admins) and crack them offline.
--   * Tables the app uses, all anon-readable AND anon-writable (no/permissive RLS):
--     sports, games, members, attendance, selfies, bonus_points, selfie_votes,
--     email_templates, chants (+ bug_reports, club_events, storage bucket "Chants").
--     Login is custom (rpc_login), so the DB cannot tell an Admin from anyone
--     else: every write arrives as the anon role. Real write protection needs
--     Supabase Auth or server-side RPCs per privileged action. That is a larger
--     refactor and is deliberately NOT attempted here.

-- =====================================================================
-- FIX 1 (clearly safe): really hide members.password from the API roles.
-- =====================================================================
-- Why safe: the only client read of members is App.tsx fetchData() with an
-- explicit column list that excludes password. All password reads/writes go
-- through SECURITY DEFINER rpc_* functions (unaffected). The interest-form
-- insert and profile/role upserts never write password (handleAddMember's
-- payload has no password column), so they keep working. The autofill-schedule
-- edge function uses the service_role key (unaffected).
--
-- Method: drop the table-level grants, then re-grant every column EXCEPT password.
revoke select, insert, update on public.members from anon, authenticated;

do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'members' and column_name <> 'password';

  execute format('grant select (%s), insert (%s), update (%s) on public.members to anon, authenticated', cols, cols, cols);
end $$;

-- delete stays table-level (Management "remove member" uses it).
grant delete on public.members to anon, authenticated;

-- NOTE: any column added to members LATER must be granted explicitly, e.g.
--   grant select (new_col), insert (new_col), update (new_col) on public.members to anon, authenticated;
-- or the client gets "permission denied for table members".

-- Verify (expect false, true), then test the site: login, interest form, member list:
select has_column_privilege('anon', 'public.members', 'password', 'select') as anon_can_read_password,
       has_column_privilege('anon', 'public.members', 'email', 'select')    as anon_can_read_email;

-- ROLLBACK if anything breaks:
--   grant select, insert, update on public.members to anon, authenticated;

-- CAVEAT: App.tsx subscribes to Realtime postgres_changes on members. The
-- callback only refetches, so it should be fine, but if the member list stops
-- live-updating after this, that is why; a page refresh still works.

-- =====================================================================
-- NOT proposed (would break existing flows; listed for awareness)
-- =====================================================================
-- * members email/phone are readable by anyone with the anon key (the client
--   loads them for every visitor). Fix = serve contact fields through an
--   admin-only RPC. Needs a client change; not safe in SQL alone.
-- * rpc_login has no rate limiting -> online password guessing is possible.
--   Later: an attempts table + lockout inside rpc_login.
-- * rpc_claim_initial_password lets anyone set a password on a member whose
--   password is NULL. Today that is 33 Prospective rows and 0 Admin/Officer/
--   Member rows, so impact is low; never leave a real member with NULL.
-- * Restricting writes on games/attendance/selfies/bonus_points/sports/
--   email_templates to "authenticated" would break the whole app (nobody is
--   ever 'authenticated' in Supabase Auth terms). Revisit only with a real auth move.
