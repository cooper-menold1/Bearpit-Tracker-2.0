-- Adds the tabling-signup / club-events feature discussed on the
-- 2026-09-21 leadership call: a second, non-game calendar of club events
-- (tabling shifts, etc) that members can sign up for open slots on, which
-- automatically awards them points in that event's category.
--
-- club_events: one row per event (e.g. "Tabling - Fountain Mall", 2026-10-02,
-- 2 slots, 1 pt each, category 'Tabling'). Officers create/delete these.
--
-- event_signups: one row per member per event they've signed up for. The
-- unique constraint prevents double sign-up. bonus_point_id links to the
-- bonus_points row this signup awarded, so cancelling a signup can reverse
-- the points instead of leaving an orphaned award.
--
-- No RLS enabled here, matching every other table in this app (members,
-- games, bonus_points, attendance, etc all rely on the anon key having full
-- access -- there's no Supabase Auth layer, login is an app-level password
-- check against the members table). Slot-limit enforcement (maxSignups) is
-- done client-side, not with a DB constraint/trigger -- acceptable for a
-- roster this size; two people signing up for the last slot at the exact
-- same instant is the only race condition and it just means one extra
-- person on the shift, not a hard failure.
--
-- Run this once in the Supabase SQL Editor (or `supabase db push`).

create table if not exists club_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Tabling',
  date date not null,
  time text,
  location text,
  max_signups integer not null default 2,
  points_value integer not null default 1,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists event_signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references club_events(id) on delete cascade,
  member_id text not null,
  bonus_point_id text,
  "timestamp" timestamptz not null default now(),
  unique (event_id, member_id)
);

comment on table club_events is 'Non-game club activities (primarily tabling) members can sign up for a slot on. Separate from games/game calendar per the 2026-09-21 call.';
comment on column club_events.max_signups is 'How many members can sign up for this event at once, e.g. "2-3 people tabling at all times".';
comment on column event_signups.bonus_point_id is 'The bonus_points.id this signup awarded (category/points come from the parent club_events row). Nullable in case the points insert failed independently of the signup insert.';
