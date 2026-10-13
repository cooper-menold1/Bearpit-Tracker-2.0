-- ============================================================================
-- FIX 2026-10-13: Re-score past meeting check-in location flags
-- ============================================================================
--
-- PLAIN-ENGLISH INSTRUCTIONS (read this first)
--
-- What this does:
--   Past meeting check-ins were marked "inside" or "outside" the meeting
--   area using a venue point that was about 230 m off. This script
--   recalculates the distance for every meeting check-in that has a location,
--   and sets the "inside the geofence" flag again using the same 1000 m
--   radius the app uses today. Check-ins where the phone's location was too
--   vague (accuracy worse than 1000 m) are set to "unknown" (null) instead
--   of "outside".
--
-- What it does NOT do:
--   - It does not touch names, emails, or any other table.
--   - It does not change check-ins for games that are not meetings.
--   - It does not change rows that have no location (latitude is null).
--
-- Steps, in order:
--   1. Run SECTION 0 (preview). It only reads. Look at the old and new
--      values. Check that the number of rows looks right.
--   2. Run SECTION 1 (backup). This copies the meeting rows into a new table
--      called attendance_geofence_backup_20261013. Do this BEFORE the update.
--      Once the update is committed, the old values can only be restored
--      from this backup table.
--   3. Run SECTION 2 (update). It starts a transaction (begin) and does NOT
--      commit. Read the "UPDATE n" count and the mismatches number from its
--      final select. The count should match the preview count from step 1
--      and mismatches should be 0.
--   4. Run SECTION 3 by itself: type  commit;  if the numbers look right,
--      or  rollback;  if they do not. Nothing is saved until you do this.
--
-- Rollback (after commit):
--   The update cannot be undone by itself because the old values are gone.
--   Use the backup table from step 2 to restore them (see the commented
--   block at the bottom of this file). Confirm the column names first.
--
-- Owner note: this file is for the owner to run by hand in the Supabase SQL
-- editor. Nothing here runs automatically. Run it on the live database only
-- after reading all of it.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SECTION 0: PREVIEW (read only, safe to run any time)
-- Shows old and new values for every meeting check-in with a location.
-- Columns: game_id, member_id (ids only, no names), latitude, longitude,
-- accuracy in meters, old distance, new distance, old flag, new flag.
-- ----------------------------------------------------------------------------

select
  game_id,
  member_id,
  latitude,
  longitude,
  accuracy_meters,
  distance_meters                                   as old_distance_m,
  round(
    (2 * 6371000 * asin(sqrt(
      power(sin(radians(latitude - 31.5451683) / 2), 2)
      + cos(radians(31.5451683)) * cos(radians(latitude))
        * power(sin(radians(longitude - (-97.1154583)) / 2), 2)
    )))::numeric                                    as new_distance_m,
  within_geofence                                   as old_within_geofence,
  case
    when accuracy_meters > greatest(1000, 500) then null
    else (
      round((2 * 6371000 * asin(sqrt(
        power(sin(radians(latitude - 31.5451683) / 2), 2)
        + cos(radians(31.5451683)) * cos(radians(latitude))
          * power(sin(radians(longitude - (-97.1154583)) / 2), 2)
      )))::numeric
      - least(accuracy_meters, 100)
    ) <= 1000
  end                                               as new_within_geofence
from attendance
where game_id like 'meeting%'
  and latitude is not null
order by game_id, member_id;

-- Row count that the update should touch (expect the same number as above):
select count(*) as rows_to_update
from attendance
where game_id like 'meeting%'
  and latitude is not null;


-- ----------------------------------------------------------------------------
-- SECTION 1: BACKUP (run once, BEFORE section 2)
-- Copies the affected rows so the old values can be restored.
-- If this table already exists, stop and ask before re-running, so you do
-- not overwrite a good backup.
-- ----------------------------------------------------------------------------

create table attendance_geofence_backup_20261013 as
select *
from attendance
where game_id like 'meeting%'
  and latitude is not null;

-- Check the backup row count matches the rows_to_update count above:
select count(*) as backup_rows from attendance_geofence_backup_20261013;


-- ----------------------------------------------------------------------------
-- SECTION 2: UPDATE (run as one block; leaves the transaction OPEN, see section 3)
--
-- distance_meters = haversine distance (meters) from the OSM point of the
--                   Paul L. Foster Campus meeting venue,
--                   31.5451683, -97.1154583
-- within_geofence:
--   - null  when accuracy_meters > greatest(1000, 500)  (1000 m)
--             (location too vague to judge)
--   - true  when distance - least(accuracy_meters, 100) <= 1000
--   - false otherwise
--
-- Note: least() ignores nulls in Postgres. If accuracy_meters is null, the
-- row is scored as if accuracy were 100 m.
-- ----------------------------------------------------------------------------

begin;

update attendance as a
set
  distance_meters = h.dist_m,
  within_geofence = case
    when a.accuracy_meters > greatest(1000, 500) then null
    else (h.dist_m - least(a.accuracy_meters, 100)) <= 1000
  end
from (
  select
    ctid as row_id,
    round((2 * 6371000 * asin(sqrt(
      power(sin(radians(latitude - 31.5451683) / 2), 2)
      + cos(radians(31.5451683)) * cos(radians(latitude))
        * power(sin(radians(longitude - (-97.1154583)) / 2), 2)
    )))::numeric AS dist_m
  from attendance
  where game_id like 'meeting%'
    and latitude is not null
) as h
where a.ctid = h.row_id;

-- Verification (read only, inside the open transaction): should show 0
-- mismatches, and the "UPDATE n" count above should equal rows_to_update.
select count(*) as mismatches
from attendance
where game_id like 'meeting%'
  and latitude is not null
  and within_geofence is distinct from (
    case
      when accuracy_meters > greatest(1000, 500) then null
      else (distance_meters - least(accuracy_meters, 100)) <= 1000
    end
  );


-- ----------------------------------------------------------------------------
-- SECTION 3: FINISH (run this by itself, AFTER reading section 2's results)
-- Numbers look right: run  commit;
-- Numbers look wrong:  run  rollback;  instead (and do not run commit).
-- ----------------------------------------------------------------------------

commit;
-- rollback;


-- ----------------------------------------------------------------------------
-- ROLLBACK (only if you need to undo the update AFTER commit)
-- Restores distance and flag from the backup table. Run by hand, after
-- checking the column names match your attendance table.
--
-- begin;
-- update attendance as a
-- set distance_meters = b.distance_meters,
--     within_geofence = b.within_geofence
-- from attendance_geofence_backup_20261013 as b
-- where a.game_id = b.game_id
--   and a.member_id = b.member_id;
-- commit;
-- ----------------------------------------------------------------------------
