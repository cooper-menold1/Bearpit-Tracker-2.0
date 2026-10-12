-- Enforces club_events.max_signups on the database side.
--
-- Before this, the slot limit was checked only in the client
-- (App.tsx handleSignUpForEvent), so two members tapping the last slot at the
-- same moment could both get in. This BEFORE INSERT trigger locks the parent
-- club_events row (FOR UPDATE), which serializes concurrent signups for the
-- same event, then rejects the insert if the event is already at its limit.
--
-- The exception message contains 'event_full'; the client matches on that to
-- show "this event just filled up". The client also works without this
-- trigger installed (it simply keeps its old client-side check).
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- ROLLBACK:
--   drop trigger if exists trg_event_signups_slot_limit on event_signups;
--   drop function if exists enforce_event_signup_slot_limit();

create or replace function enforce_event_signup_slot_limit()
returns trigger
language plpgsql
as $$
declare
  v_max integer;
  v_taken integer;
begin
  -- Row lock: concurrent signups for the same event queue up here.
  select max_signups into v_max
    from club_events
   where id = new.event_id
   for update;

  if not found then
    return new; -- let the foreign key report the missing event
  end if;

  select count(*) into v_taken
    from event_signups
   where event_id = new.event_id;

  if v_taken >= v_max then
    raise exception 'event_full: this event has no open slots (% of % taken)', v_taken, v_max
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_event_signups_slot_limit on event_signups;
create trigger trg_event_signups_slot_limit
  before insert on event_signups
  for each row
  execute function enforce_event_signup_slot_limit();
