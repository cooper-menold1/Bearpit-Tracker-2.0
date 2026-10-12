# Auth migration plan (plan only, no code)

## Problem
No Supabase Auth. The browser uses the anon key, and every table is anon-readable and anon-writable. "Login" is an app-level check (`rpc_login`) and the session lives in `sessionStorage` (`bp_member`). Anyone with the anon key (it ships in the bundle) can read or edit any row, including roles, points, and signups. RLS cannot help until Postgres can tell who is calling.

## Options

**A. Supabase Auth mapped to `members`.** Add `members.auth_user_id uuid`. Members sign in with email magic link or password. Policies use `auth.uid()`.
- Pros: standard, RLS works natively, token refresh and revocation handled, no custom crypto.
- Cons: needs a working email per member (about 70 accounts to link); magic links can land in spam or arrive late; changes the login UX; existing passwords must be migrated or re-collected.

**B. Signed session token + per-action SECURITY DEFINER RPCs.** `rpc_login` returns a signed token (JWT or random token stored hashed in a `sessions` table). Every write goes through an RPC that takes the token, resolves member and role, and checks permission. Direct table writes are revoked from anon.
- Pros: keeps the current password login and UX; no email dependency.
- Cons: every write path (about 40 call sites) becomes an RPC; reads still need a story; we maintain our own session code; it fails open whenever a path is missed.

## Recommendation
Option A with email + password (not magic links), done in phases. Use Supabase Auth with the member's email as the login, so the login screen barely changes. Keep `members` as the profile table, linked by `auth_user_id`. Role checks come from a `SECURITY DEFINER` helper (`current_member_role()`) reading `members` by `auth.uid()`. RLS covers every table and every future query by default, which B cannot promise.

## RLS policies (target state: RLS on everywhere, anon denied)
Roles: Admin > Officer > Member > Prospective. "Self" = the row belongs to the current member.

| Table | Read | Write |
|---|---|---|
| sports | authenticated | Admin/Officer |
| games | authenticated | Admin/Officer |
| members | authenticated, safe columns only (never password; use a view or column grants) | insert/update: Admin/Officer; self may update own non-role columns; delete: Admin. Prospect intake via a narrow RPC, role forced to Prospective |
| attendance | authenticated | Admin/Officer, or self insert/delete on own row |
| selfies | authenticated | self insert/delete own; Admin/Officer delete any |
| selfie_votes | authenticated | self insert/delete own vote only |
| bonus_points | authenticated | Admin/Officer all; self insert only through the event-signup RPC |
| email_templates | Admin/Officer | Admin/Officer |
| chants | authenticated | Admin/Officer |
| bug_reports | Admin/Officer (reporter sees own) | any authenticated insert; Admin/Officer update |
| club_events | authenticated | Admin/Officer |
| event_signups | authenticated | self insert/delete own (slot trigger enforces limit); Admin/Officer delete any |

Sensitive multi-table writes (role changes, point awards, signup plus bonus_points) should be RPCs even under Option A, so they are atomic and validated.

## Migration steps for the ~70 existing members
1. Add `members.auth_user_id` (nullable). No behavior change.
2. Bulk-create Auth users with the Admin API (service role, run locally): one per member email, random password, email confirmed.
3. Link each to its `members` row by email. Report members with missing or duplicate emails for manual fixes.
4. Ship a client that logs in with `signInWithPassword`, falling back to legacy `rpc_login`; on a legacy success it sets that password on the linked Auth user. Members migrate on first login with their current password, so there is no mass reset.
5. After a deadline, send "set your password" reset emails to anyone still unlinked.
6. Enable RLS table by table, lowest risk first: bug_reports, email_templates, chants, club_events, event_signups, selfie_votes, selfies, bonus_points, attendance, games, sports, members last.
7. Drop `members.password`, `rpc_login`, and the legacy fallback.

## Rollout and rollback
- Staging first: clone the Supabase project, run every step there, test each role.
- Each table's policies get their own migration file with a paired rollback (`disable row level security` plus drop policies). Keep a permissive "restore anon access" script ready.
- Cut over in a quiet window (not game day or tabling week). Keep the legacy login until step 7.
- Watch Supabase logs for 401/403 spikes after each table.

## Effort
About 3-5 focused days: 1 day schema, bulk user creation and linking; 1-2 days client auth swap (App.tsx, Login, SettingsModal, session handling); 1-2 days policies and RPCs plus testing every role on staging; then a week of light monitoring.

## What Cooper must do by hand
- Confirm a unique email for all 70 members and resolve gaps and duplicates.
- Create the staging Supabase project; keep the service-role key out of the repo and the client.
- Configure Auth: email provider, confirm/reset templates, site URL and redirect URLs for baylor-bearpit.web.app, a custom SMTP sender (default Supabase email is rate limited).
- Run each migration SQL file in the SQL Editor and the bulk-user script locally.
- Announce the change to members and pick the cutover window.
- Test as Admin, Officer, Member, and Prospective before each RLS switch.
