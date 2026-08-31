-- Adds location columns to attendance so a check-in's shared location is
-- recorded for officers to double-check, replacing the old (unused --
-- selfies uploaded via AttendanceForm were never actually inserted into the
-- selfies table, see git history) "upload a photo" requirement.
--
-- All columns are nullable: away games and sports with no venue defined
-- have nothing to compare distance against, so distance_meters and
-- within_geofence stay null for those rows while latitude/longitude are
-- still recorded.
--
-- Run this once in the Supabase SQL Editor (or `supabase db push` if you're
-- applying migrations through the CLI).

alter table attendance
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists accuracy_meters double precision,
  add column if not exists distance_meters double precision,
  add column if not exists within_geofence boolean;

comment on column attendance.distance_meters is 'Distance from the nearest matching venue at check-in time, in meters. Null when the game has no venue to compare against (away game, or sport with no venue configured).';
comment on column attendance.within_geofence is 'Whether the check-in location fell within the venue''s geofence radius. Null when there was no venue to check against -- see distance_meters.';
