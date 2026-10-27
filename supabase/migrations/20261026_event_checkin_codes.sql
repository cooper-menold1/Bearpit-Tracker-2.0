-- Rotating check-in codes for event check-ins (2026-10-26).
--
-- An "event check-in" is a games row whose id starts with one of the
-- prefixes in utils/fanTier.ts EVENT_CHECKIN_PREFIXES (tabling_, hosp_,
-- gameday_, ...). They have no venue, so the geofence can't prove anyone was
-- there. Instead an officer shows a QR + 6-digit code that changes every 60
-- seconds (components/EventCheckinCode.tsx) and members check in with it.
--
-- How the code works (TOTP-style): each event gets a random secret, stored
-- in event_checkin_secrets, which anon can NOT read. The code for a minute is
-- HMAC-SHA256(secret, minute number) cut down to 6 digits. Only the two
-- SECURITY DEFINER functions below ever touch the secret:
--   * rpc_event_checkin_code   -- officer screen. Creates the secret on first
--     use and returns the current code. Gated by the officer's own password
--     (same pattern as rpc_admin_set_password), since login is custom and the
--     DB can't otherwise tell an officer from anyone with the anon key.
--   * rpc_event_checkin        -- member check-in. Checks the code (current or
--     previous minute), the event's time window, duplicates, then inserts the
--     attendance row.
--
-- Also adds games.end_time (optional "HH:MM", 24h) so an event check-in can
-- say when it closes. Regular games leave it null.
--
-- The client works without this migration: the officer code screen shows a
-- "run the migration" notice and AttendanceForm falls back to the old
-- location flow for event check-ins.
--
-- KNOWN LIMITATION: attendance is still anon-writable (see
-- 20261012_security_rls_review.sql), so someone poking the API directly can
-- still insert an attendance row without a code. This makes the normal path
-- honest; it is not a hard lock. A hard lock needs real auth.
--
-- Run once in the Supabase SQL Editor. Safe to re-run. If the client gets
-- "Could not find the function ... in the schema cache" right after, run
--   NOTIFY pgrst, 'reload schema';
--
-- ROLLBACK:
--   drop function if exists rpc_event_checkin(text, text, text);
--   drop function if exists rpc_event_checkin_code(text, text, text);
--   drop function if exists event_checkin_code_for(text, bigint);
--   drop function if exists event_checkin_parse_time(text);
--   drop function if exists is_event_checkin_id(text);
--   drop table if exists event_checkin_secrets;
--   alter table games drop column if exists end_time;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Optional end time on games (event check-ins use it for the window).
-- ---------------------------------------------------------------------
alter table games add column if not exists end_time text;
comment on column games.end_time is 'Optional end time ("HH:MM", 24h). Set on event check-ins so rpc_event_checkin knows when the event closes. Null for regular games.';

-- ---------------------------------------------------------------------
-- 2. Per-event secrets. RLS on with NO policies + no grants = anon and
--    authenticated can't read or write it at all. Only the SECURITY DEFINER
--    functions below (running as the owner) can.
-- ---------------------------------------------------------------------
create table if not exists event_checkin_secrets (
  game_id text primary key,
  secret text not null,
  created_at timestamptz not null default now()
);
alter table event_checkin_secrets enable row level security;
revoke all on table event_checkin_secrets from anon, authenticated, public;

comment on table event_checkin_secrets is 'Secret per event check-in for the rotating 60-second code. Never readable by the API roles; see rpc_event_checkin_code / rpc_event_checkin.';

-- ---------------------------------------------------------------------
-- 3. Helpers (internal, not callable by the API roles).
-- ---------------------------------------------------------------------

-- Keep in sync with utils/fanTier.ts EVENT_CHECKIN_PREFIXES.
create or replace function is_event_checkin_id(p_id text)
returns boolean
language sql immutable
as $$
  select coalesce(p_id ~ '^(tabling|marketing|hosp|gameday|media|service|community|recruit|lead)_', false);
$$;

-- games.time is free text ("17:30", "12:00 PM", "7 p.m.", "TBA"). Returns
-- null when it can't be read, which makes the window the whole day.
create or replace function event_checkin_parse_time(p_time text)
returns time
language plpgsql immutable
as $$
declare
  m text[];
  h integer;
  mi integer;
begin
  m := regexp_match(lower(coalesce(p_time, '')), '^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?');
  if m is null then return null; end if;
  h := m[1]::integer;
  mi := coalesce(m[2], '0')::integer;
  if m[3] = 'p' and h < 12 then h := h + 12; end if;
  if m[3] = 'a' and h = 12 then h := 0; end if;
  if m[2] is null and m[3] is null then return null; end if; -- a bare number isn't a time
  if h > 23 or mi > 59 then return null; end if;
  return make_time(h, mi, 0);
end;
$$;

-- 6-digit code for one secret + one minute number.
create or replace function event_checkin_code_for(p_secret text, p_window bigint)
returns text
language sql immutable
set search_path = public, extensions
as $$
  select lpad(
    ((('x' || lpad(substr(encode(hmac(p_window::text, p_secret, 'sha256'), 'hex'), 1, 8), 16, '0'))::bit(64)::bigint) % 1000000)::text,
    6, '0');
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to
-- anon/authenticated directly, so revoking from PUBLIC alone leaves them
-- callable through /rpc. Name the roles too.
revoke all on function is_event_checkin_id(text) from public, anon, authenticated;
revoke all on function event_checkin_parse_time(text) from public, anon, authenticated;
revoke all on function event_checkin_code_for(text, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Officer screen: current code for one event check-in.
--    Returns {"ok":true,"code":"123456","seconds_left":42}
--         or {"ok":false,"error":"not_officer" | "no_game" | "not_event"}
-- ---------------------------------------------------------------------
create or replace function rpc_event_checkin_code(p_game_id text, p_officer_id text, p_officer_password text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_officer_ok boolean;
  v_secret text;
  v_epoch bigint := floor(extract(epoch from clock_timestamp()))::bigint;
begin
  select (lower(role) in ('admin', 'officer') and password is not null and password = crypt(p_officer_password, password))
    into v_officer_ok
    from members where id = p_officer_id;
  if not coalesce(v_officer_ok, false) then
    return jsonb_build_object('ok', false, 'error', 'not_officer');
  end if;

  if not exists (select 1 from games where id = p_game_id) then
    return jsonb_build_object('ok', false, 'error', 'no_game');
  end if;
  if not is_event_checkin_id(p_game_id) then
    return jsonb_build_object('ok', false, 'error', 'not_event');
  end if;

  insert into event_checkin_secrets (game_id, secret)
  values (p_game_id, encode(gen_random_bytes(32), 'hex'))
  on conflict (game_id) do nothing;

  select secret into v_secret from event_checkin_secrets where game_id = p_game_id;

  return jsonb_build_object(
    'ok', true,
    'code', event_checkin_code_for(v_secret, v_epoch / 60),
    'seconds_left', 60 - (v_epoch % 60)
  );
end;
$$;
revoke all on function rpc_event_checkin_code(text, text, text) from public;
grant execute on function rpc_event_checkin_code(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Member check-in with a code.
--    Returns one of: 'ok', 'already', 'bad_code', 'not_open', 'closed',
--    'not_event', 'no_game', 'no_member'.
--    Window (Central time): 60 min before the start time through 60 min
--    after end_time (or start + 4h when there's no end time). If the start
--    time can't be read, the whole event day counts.
-- ---------------------------------------------------------------------
create or replace function rpc_event_checkin(p_game_id text, p_member_id text, p_code text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  g record;
  v_secret text;
  v_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_now timestamptz := clock_timestamp();
  v_window bigint := floor(extract(epoch from v_now))::bigint / 60;
  v_start time;
  v_end time;
  v_opens timestamptz;
  v_closes timestamptz;
begin
  select games.date::date as d, games."time" as start_txt, games.end_time as end_txt
    into g from games where games.id = p_game_id;
  if not found then return 'no_game'; end if;
  if not is_event_checkin_id(p_game_id) then return 'not_event'; end if;
  if not exists (select 1 from members where id = p_member_id) then return 'no_member'; end if;

  if exists (select 1 from attendance where game_id = p_game_id and member_id = p_member_id) then
    return 'already';
  end if;

  -- Event window, with slack on both ends.
  v_start := event_checkin_parse_time(g.start_txt);
  v_end := event_checkin_parse_time(g.end_txt);
  if v_start is null then
    v_opens := (g.d::timestamp) at time zone 'America/Chicago';
    v_closes := ((g.d + 1)::timestamp) at time zone 'America/Chicago';
  else
    v_opens := ((g.d + v_start) at time zone 'America/Chicago') - interval '60 minutes';
    if v_end is null then
      v_closes := ((g.d + v_start) at time zone 'America/Chicago') + interval '4 hours';
    else
      v_closes := ((g.d + v_end) at time zone 'America/Chicago') + interval '60 minutes';
      if v_end < v_start then v_closes := v_closes + interval '1 day'; end if; -- runs past midnight
    end if;
  end if;
  if v_now < v_opens then return 'not_open'; end if;
  if v_now > v_closes then return 'closed'; end if;

  -- Code: current minute or the one before (covers a code that flips while
  -- someone is typing it).
  select secret into v_secret from event_checkin_secrets where game_id = p_game_id;
  if v_secret is null or length(v_code) <> 6
     or v_code not in (event_checkin_code_for(v_secret, v_window), event_checkin_code_for(v_secret, v_window - 1)) then
    return 'bad_code';
  end if;

  begin
    insert into attendance (game_id, member_id) values (p_game_id, p_member_id);
  exception when unique_violation then
    return 'already';
  end;
  return 'ok';
end;
$$;
revoke all on function rpc_event_checkin(text, text, text) from public;
grant execute on function rpc_event_checkin(text, text, text) to anon, authenticated;

-- Verify (expect false, false, then a row per function):
select has_table_privilege('anon', 'public.event_checkin_secrets', 'select') as anon_can_read_secrets,
       has_function_privilege('anon', 'public.event_checkin_code_for(text, bigint)', 'execute') as anon_can_run_code_helper;
select proname from pg_proc where proname in ('rpc_event_checkin', 'rpc_event_checkin_code') order by 1;
