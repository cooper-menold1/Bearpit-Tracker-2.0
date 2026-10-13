-- ============================================================================
-- BearPit Tracker: weekly autofill cron check and fix (2026-10-13)
-- ============================================================================
--
-- WHAT THIS FILE DOES (plain English)
-- The schedule that refreshes the game calendar from baylorbears.com has not
-- worked since about August 31. This file helps find out why and fixes it.
-- The first part only READS information. The fix part is commented out and
-- you turn it on only when you are ready.
--
-- STEP-BY-STEP
--   1. Open the Supabase dashboard for this project and click "SQL Editor".
--   2. Click "New query". Paste this file in.
--   3. Run PART 1 (the diagnostics). It only reads data and is safe to run
--      any time. Copy the results and share them (especially the
--      "status_code" column from PART 1C). That tells us what went wrong:
--        - a placeholder URL (no job runs or runs fail to reach the function)
--        - status 401 (the function needs --no-verify-jwt, see step 6)
--        - no response at all (the function cannot be reached)
--   4. Find your project ref. Open the file .env (or the Vercel/Firebase
--      settings) and look at VITE_SUPABASE_URL. It looks like
--      https://abcdefghijkl.supabase.co. The "abcdefghijkl" part is the
--      PROJECT REF. Use it in place of <project-ref> in PART 2.
--   5. Only after the diagnostics are shared and the fix is agreed, remove the
--      "--" at the start of each line in PART 2 and run it. Then do step 6.
--   6. Deploy the function, from the project folder in a terminal:
--        supabase functions deploy autofill-schedule --no-verify-jwt
--      The "--no-verify-jwt" part lets the scheduled job call the function
--      without a login token.
--   7. Trigger it once by hand, so you don't wait for Sunday. In a terminal:
--        curl -X POST https://<project-ref>.supabase.co/functions/v1/autofill-schedule
--      Replace <project-ref> with the same ref from step 4. Read the JSON that
--      comes back, especially the "log" list. It shows what was added,
--      updated, or removed.
--
-- TIME ZONE NOTE
--   pg_cron runs in UTC. Waco is on Central Time, so the schedule has to
--   shift when daylight saving ends.
--     - Until Nov 1, 2026 (CDT): 10 am Chicago = 15:00 UTC  -> '0 15 * * 0'
--     - From Nov 1, 2026 (CST): 10 am Chicago = 16:00 UTC  -> '0 16 * * 0'
--   Part 2 uses '0 16 * * 0' so the job keeps running at 10 am after Nov 1.
--   If you run the fix before Nov 1, the job will run at 9 am Chicago until
--   Nov 1. That is harmless.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PART 1: DIAGNOSTICS (read only, safe to run any time)
-- ----------------------------------------------------------------------------

-- 1A. Is the job scheduled, and what is its command? Look at the "command"
--     column. If it still contains <YOUR_PROJECT_URL>, that is the bug.
select * from cron.job where jobname = 'weekly-autofill-schedule';

-- 1B. Recent runs of the job: did it run, and did it succeed?
select *
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'weekly-autofill-schedule')
order by start_time desc
limit 20;

-- 1C. HTTP responses the job received. The "status_code" column is the key
--     result. 200 is good. 401 means the function needs --no-verify-jwt.
--     Empty or null means the request never reached the function.
select *
from net._http_response
order by created desc
limit 20;


-- ----------------------------------------------------------------------------
-- PART 2: FIX (commented out. Remove the leading "--" on each line only
-- after the diagnostics are reviewed and the project ref is filled in.)
-- ----------------------------------------------------------------------------

-- 2A. Remove the broken job (it may point at the placeholder URL).
-- select cron.unschedule('weekly-autofill-schedule');

-- 2B. Re-create the job with the real URL. Replace <project-ref> with the
--     subdomain from VITE_SUPABASE_URL (step 4 above). Keep the quotes.
--     Schedule '0 16 * * 0' = Sunday 16:00 UTC = 10 am Central Standard Time
--     (from Nov 1, 2026). Before Nov 1, it runs at 9 am Central Daylight Time.
-- select cron.schedule(
--   'weekly-autofill-schedule',
--   '0 16 * * 0',
--   $$
--   select net.http_post(
--     url := 'https://<project-ref>.supabase.co/functions/v1/autofill-schedule',
--     headers := jsonb_build_object('Content-Type', 'application/json')
--   );
--   $$
-- );

-- 2C. Check that the job now shows the real URL in its command column.
-- select jobname, schedule, command from cron.job where jobname = 'weekly-autofill-schedule';
