-- Adds a bug log for site problems Cooper hears about or finds himself, so
-- they can be jotted down fast (often from a phone at a game) and worked
-- through later from the Management "Bug Log" tab.
--
-- No RLS enabled here, matching every other table in this app.
--
-- Run this once in the Supabase SQL Editor (or `supabase db push` if you're
-- applying migrations through the CLI).

create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  page text,
  reported_by text,
  priority text not null default 'Normal',
  status text not null default 'Open',
  created_at timestamptz not null default now(),
  fixed_at timestamptz
);

comment on column bug_reports.page is 'Where on the site the problem shows up, e.g. Check-in, Member Portal, Leaderboard. Free text.';
comment on column bug_reports.reported_by is 'Who told us about it (free text, not a member id) -- often a member mentioning it in person.';
comment on column bug_reports.priority is 'Low / Normal / High.';
comment on column bug_reports.status is 'Open / Fixed.';
