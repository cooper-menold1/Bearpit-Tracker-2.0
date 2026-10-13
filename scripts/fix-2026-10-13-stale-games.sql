-- ============================================================================
-- BearPit Tracker: fix stale game rows (2026-10-13)
-- ============================================================================
--
-- WHAT THIS FILE DOES (plain English)
-- Some games in the calendar are out of date. The school moved them, changed
-- the time, or removed them, but the app still shows the old version. This
-- file cleans those up by hand.
--
-- HOW TO RUN IT
--   1. Open the Supabase dashboard for this project and click "SQL Editor".
--   2. Click "New query". Paste this whole file in.
--   3. SECTION 0 (the preview) runs first and only READS data. Click "Run"
--      and look at the results before doing anything else. Check that:
--        - the first table lists the games you expect (about 16 deletes and
--          4 edits), and
--        - the attendance count table is EMPTY (zero rows). If any game
--          shows up there, STOP. Do not run the rest. Ask for help first.
--   4. If the preview looks right, run SECTION 1 and SECTION 2 together.
--      They are wrapped in begin; ... commit; so they run as one step.
--   5. If anything errors, the whole block rolls back. Nothing changes.
--
-- SAFE TO RE-RUN
--   Every change checks first whether it still needs to happen. Running this
--   file a second time does nothing harmful. Rows the automatic autofill
--   already fixed are simply skipped.
--   Before re-running, look at the section 0 preview again.
--
-- WHAT IT NEVER TOUCHES
--   The attendance table. Games that have any check-in are never deleted.
--
-- ORDER OF WORK
--   Run this AFTER the autofill fix is deployed and the function has been
--   triggered once by hand. Otherwise the autofill job may bring the old
--   rows back.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SECTION 0: PREVIEW (read only, safe to run any time)
-- ----------------------------------------------------------------------------

select id, sport_id, date, time, opponent, location
from games
where id in (
  'scraped_1789422666282_scmq0ss7x',
  'scraped_1790946824325_jmgty2gw6',
  'scraped_1789422666282_h2f2etxx5',
  'scraped_1790342311310_769a7b12v',
  'scraped_1789422666282_zrukyfbfi',
  'autofill_sport_1769127391045_2026-10-03',
  'scraped_1787705787005_y01kymm9s',
  'scraped_1787705787005_cavfd53js',
  'scraped_1787705787005_4gnrfnymk',
  'autofill_mtennis_2026-10-01',
  'autofill_mtennis_2026-10-02',
  'autofill_mtennis_2026-10-03',
  'autofill_mtennis_2026-10-04',
  'scraped_1787705787004_blnq2j9s7',
  'scraped_1790946824325_prz9rrkb9',
  'scraped_1788201919431_3p168ia4n',
  'scraped_1790946824325_5wfnqn5v5',
  'scraped_1790946824325_2c2gbo5i5',
  'scraped_1790946824325_47k5w1fuo',
  'autofill_sport_1766984360314_2026-10-23'
)
order by date, id;

-- Expect ZERO rows here. Any row means a game has check-ins. Do not delete it.
select game_id, count(*)
from attendance
where game_id in (
  'scraped_1789422666282_scmq0ss7x',
  'scraped_1790946824325_jmgty2gw6',
  'scraped_1789422666282_h2f2etxx5',
  'scraped_1790342311310_769a7b12v',
  'scraped_1789422666282_zrukyfbfi',
  'autofill_sport_1769127391045_2026-10-03',
  'scraped_1787705787005_y01kymm9s',
  'scraped_1787705787005_cavfd53js',
  'scraped_1787705787005_4gnrfnymk',
  'autofill_mtennis_2026-10-01',
  'autofill_mtennis_2026-10-02',
  'autofill_mtennis_2026-10-03',
  'autofill_mtennis_2026-10-04',
  'scraped_1787705787004_blnq2j9s7',
  'scraped_1790946824325_prz9rrkb9',
  'scraped_1788201919431_3p168ia4n',
  'scraped_1790946824325_5wfnqn5v5',
  'scraped_1790946824325_2c2gbo5i5',
  'scraped_1790946824325_47k5w1fuo',
  'autofill_sport_1766984360314_2026-10-23'
)
group by 1;


begin;

-- ----------------------------------------------------------------------------
-- SECTION 1: DELETE stale games (games the school no longer lists, or that
-- were moved to a new date and now exist as a separate row).
-- Each delete only happens if the game has NO attendance rows.
-- ----------------------------------------------------------------------------

delete from games
where id = 'scraped_1789422666282_scmq0ss7x'   -- softball McLennan CC, 9/24 (moved to 10/13)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1790946824325_jmgty2gw6'   -- softball Navarro CC, 10/06 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1789422666282_h2f2etxx5'   -- softball, 9/26 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1790342311310_769a7b12v'   -- softball, 9/25 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1789422666282_zrukyfbfi'   -- softball, 9/29 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'autofill_sport_1769127391045_2026-10-03'   -- Equestrian UT Martin, 10/03 TBA (site lists 10/02 only)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1787705787005_y01kymm9s'   -- mtennis Columbus ATP 75, 9/28 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1787705787005_cavfd53js'   -- mtennis Columbus ATP 75, 9/29 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1787705787005_4gnrfnymk'   -- mtennis Columbus ATP 75, 9/30 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'autofill_mtennis_2026-10-01'       -- mtennis Columbus ATP 75 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'autofill_mtennis_2026-10-02'       -- mtennis Columbus ATP 75 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'autofill_mtennis_2026-10-03'       -- mtennis Columbus ATP 75 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'autofill_mtennis_2026-10-04'       -- mtennis Columbus ATP 75 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1787705787004_blnq2j9s7'   -- golf, 9/22 (event now 9/19-9/21)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1790946824325_prz9rrkb9'   -- XC Nike Town Twilight, 10/02 (not listed)
  and not exists (select 1 from attendance a where a.game_id = games.id);

delete from games
where id = 'scraped_1788201919431_3p168ia4n'   -- volleyball Hawaii duplicate, 8/30 12 a.m.
  and not exists (select 1 from attendance a where a.game_id = games.id);


-- ----------------------------------------------------------------------------
-- SECTION 2: UPDATE games the school moved or re-timed.
-- Each update only changes the row if the value is still the old one, so
-- re-running is harmless.
-- ----------------------------------------------------------------------------

update games
set time = '12 pm',
    opponent = 'Southwest Mississippi Community College'
where id = 'scraped_1790946824325_5wfnqn5v5'   -- softball, 10/09 (was 3 pm)
  and (time is distinct from '12 pm'
       or opponent is distinct from 'Southwest Mississippi Community College');

update games
set date = '2026-10-09',
    opponent = 'University of Southern Mississippi'
where id = 'scraped_1790946824325_2c2gbo5i5'   -- softball, moved from 10/10 to 10/09
  and (date is distinct from '2026-10-09'
       or opponent is distinct from 'University of Southern Mississippi');

update games
set time = '6 p.m.'
where id = 'scraped_1790946824325_47k5w1fuo'   -- Football vs TCU, 10/17 (was TBD)
  and time is distinct from '6 p.m.';

update games
set time = '7 pm'
where id = 'autofill_sport_1766984360314_2026-10-23'   -- Basketball vs Illinois, 10/23 (was TBD)
  and time is distinct from '7 pm';

commit;
