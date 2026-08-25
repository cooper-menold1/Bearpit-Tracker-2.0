-- Secure login (2026-08-25)
--
-- The members query intentionally excludes the password column (see
-- App.tsx "SECURITY FLAGGED" comment) so it isn't shipped in bulk to every
-- visitor. But Login.tsx's client-side check then fell back to
-- "member.password === undefined => allow" -- and since password was ALWAYS
-- undefined on the client (it's never fetched), literally any password
-- logged in as any member, including Admins. This migration moves
-- password verification server-side so the client never needs the real
-- password, and hashes existing plaintext passwords in place.
--
-- Notes from actually running this against production:
-- - pgcrypto's crypt()/gen_salt() live in the `extensions` schema on
--   Supabase, not `public` -- the functions below need both on their
--   search_path or every call fails with "function crypt(text, text)
--   does not exist" (looks unrelated to search_path at first glance).
-- - New/changed functions aren't always picked up by PostgREST right
--   away. If calls 404 with "Could not find the function ... in the
--   schema cache" right after running this, run
--   `NOTIFY pgrst, 'reload schema';` separately.

create extension if not exists pgcrypto;

-- 1. Hash existing plaintext passwords (skips anything already bcrypt-hashed,
--    so this is safe to re-run).
update members
set password = crypt(password, gen_salt('bf', 8))
where password is not null
  and password !~ '^\$2[aby]\$';

-- 2. Password column can no longer be read or written directly via the API,
--    no matter what a client asks to select/update. All password reads/
--    writes must go through the SECURITY DEFINER functions below.
revoke select (password), insert (password), update (password)
  on members from anon, authenticated;

-- 3. Server-side login check.
create or replace function rpc_login(p_identifier text, p_password text)
returns table (
  id text, first_name text, last_name text, role text,
  years_in_bplt integer, email text, fall_sport_id text,
  spring_sport_id text, is_chair boolean
)
language plpgsql security definer set search_path = public, extensions
as $$
begin
  return query
  select m.id, m.first_name, m.last_name, m.role, m.years_in_bplt,
         m.email, m.fall_sport_id, m.spring_sport_id, m.is_chair
  from members m
  where (lower(m.email) = lower(trim(p_identifier))
         or lower(m.first_name || ' ' || m.last_name) = lower(trim(p_identifier)))
    and m.password is not null
    and m.password = crypt(p_password, m.password);
end;
$$;
revoke all on function rpc_login(text, text) from public;
grant execute on function rpc_login(text, text) to anon, authenticated;

-- 4. Self-service password change -- requires proof of the current password.
create or replace function rpc_set_own_password(p_member_id text, p_current_password text, p_new_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare v_ok boolean;
begin
  select (password is not null and password = crypt(p_current_password, password))
  into v_ok from members where id = p_member_id;

  if v_ok then
    update members set password = crypt(p_new_password, gen_salt('bf', 8)) where id = p_member_id;
  end if;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function rpc_set_own_password(text, text, text) from public;
grant execute on function rpc_set_own_password(text, text, text) to anon, authenticated;

-- 5. Admin sets another member's password (used by the admin "Edit Profile"
--    modal) -- requires proof of the ACTING admin/officer's own current
--    password, since this app has no server-verifiable session otherwise.
create or replace function rpc_admin_set_password(p_admin_id text, p_admin_password text, p_target_member_id text, p_new_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare v_admin_ok boolean;
begin
  select (role in ('Admin', 'Officer') and password is not null and password = crypt(p_admin_password, password))
  into v_admin_ok
  from members where id = p_admin_id;

  if v_admin_ok then
    update members set password = crypt(p_new_password, gen_salt('bf', 8)) where id = p_target_member_id;
  end if;
  return coalesce(v_admin_ok, false);
end;
$$;
revoke all on function rpc_admin_set_password(text, text, text, text) from public;
grant execute on function rpc_admin_set_password(text, text, text, text) to anon, authenticated;

-- 6. Initial password claim for a brand-new member -- only works while that
--    member's password is still unset, so it can never be used to take over
--    an existing account.
create or replace function rpc_claim_initial_password(p_member_id text, p_new_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare v_ok boolean;
begin
  update members set password = crypt(p_new_password, gen_salt('bf', 8))
  where id = p_member_id and password is null
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function rpc_claim_initial_password(text, text) from public;
grant execute on function rpc_claim_initial_password(text, text) to anon, authenticated;

-- Verify
select id, first_name, last_name, role, (password is not null) as has_password from members order by first_name;
