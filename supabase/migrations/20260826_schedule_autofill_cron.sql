-- Schedules the autofill-schedule Edge Function to run every Sunday at
-- 10:00am America/Chicago. Run this once in the Supabase SQL Editor after
-- the function is deployed (or via `supabase db push` if you're applying
-- migrations through the CLI).
--
-- pg_cron schedules run in UTC, and Waco observes Central Time with DST, so
-- the UTC hour that means "10am Chicago" shifts by one hour twice a year:
--   - CDT (mid-March -> early November, i.e. most of football/basketball
--     season): 10am Chicago = 15:00 UTC  <- used below
--   - CST (early November -> mid-March): 10am Chicago = 16:00 UTC
-- This job is set for CDT. When the fall DST changeover happens, either
-- re-run cron.alter_job with schedule '0 16 * * 0', or just leave it — the
-- job would then fire at 9am Chicago instead of 10am, which is harmless for
-- a schedule-refresh task.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'weekly-autofill-schedule',
  '0 15 * * 0', -- Sunday 15:00 UTC = 10:00am America/Chicago (CDT)
  $$
  select net.http_post(
    url := '<YOUR_PROJECT_URL>/functions/v1/autofill-schedule',
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  $$
);

-- To check past runs:
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'weekly-autofill-schedule') order by start_time desc limit 20;
-- To unschedule:
--   select cron.unschedule('weekly-autofill-schedule');
