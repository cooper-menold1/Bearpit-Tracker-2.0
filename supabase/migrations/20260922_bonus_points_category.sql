-- Adds a category column to bonus_points so officer-assigned points (things
-- a member can't self-report on the website: hospitality duty, tabling,
-- special projects, referrals) can be broken out on the member portal
-- instead of showing as one undifferentiated "bonus points" number.
--
-- Part of the attendance-focused -> points-focused rework discussed on the
-- 2026-09-21 leadership call: members should see "here's the category
-- you're getting points in, here's what you need for the next level"
-- instead of a single home-game attendance percentage.
--
-- Nullable / defaulted so existing rows (logged before categories existed)
-- don't break -- they'll show under "Other" in the member portal until an
-- officer re-tags them.
--
-- Run this once in the Supabase SQL Editor (or `supabase db push` if you're
-- applying migrations through the CLI).

alter table bonus_points
  add column if not exists category text not null default 'Other';

comment on column bonus_points.category is 'One of constants.ts POINT_CATEGORIES (Hospitality, Tabling, Special Project, Referral, Other) -- officer-assigned points for things members can''t self-report. Game-attendance points are tracked separately via the attendance table, not this column.';
