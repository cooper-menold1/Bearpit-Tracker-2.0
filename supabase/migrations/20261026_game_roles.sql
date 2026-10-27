-- Game-day roster (2026-10-26). NOT applied -- run by hand in the SQL Editor.
-- Safe to run more than once.
--
-- game_roles: one row per member per job at a game (chant leader, setup /
-- tear-down crew, hospitality team, ...), assigned by officers from the
-- Manage > Games calendar ("Game-day roster" on a game in the day details).
-- Values come from the Official BPLT Incentive Framework (Fall 2026); the
-- presets live in utils/fanTier.ts GAME_ROLE_PRESETS.
--
-- Points are NOT stored as bonus_points. They're derived in the app
-- (utils/fanTier.ts confirmedGameRoles): a role only counts once the member
-- also has an attendance check-in for that game. Until then officers see it
-- as "pending". Removing a role (or the check-in) removes the points.
--
-- Until this is run the app hides the roster UI and keeps working.
--
-- Access matches the rest of the app (see 20261012_security_rls_review.sql):
-- login is custom, so every client read/write arrives as anon. RLS is on with
-- one permissive policy, the same effective access as bonus_points, so it
-- also works if this project auto-enables RLS on new tables.

create table if not exists game_roles (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  role text not null,
  category text not null default 'Game Day',
  points integer not null default 2,
  created_at timestamptz not null default now(),
  unique (game_id, member_id, role)
);

create index if not exists game_roles_member_id_idx on game_roles (member_id);

comment on table game_roles is 'Officer-assigned game-day jobs per member per game. Points (category/points) only count once the member also checked in to that game (attendance); derived client-side in utils/fanTier.ts, never written to bonus_points.';
comment on column game_roles.category is 'One of constants.ts POINT_CATEGORIES, usually Game Day / Hospitality / Media.';

alter table game_roles enable row level security;
drop policy if exists "Public access" on game_roles;
create policy "Public access" on game_roles for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.game_roles to anon, authenticated;

-- Live updates for other officers' screens (the app refetches on change).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_roles') then
    alter publication supabase_realtime add table public.game_roles;
  end if;
end $$;

-- Verify (expect 0 rows, no error):
select * from game_roles limit 1;

-- ROLLBACK (drops every roster assignment; the points disappear with them):
--   drop table if exists game_roles;
