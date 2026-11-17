# Plan: Excel point tracker as the backend (daily 9 AM sync)

Status: LIVE 2026-11-16. Daily 9 AM task ('BPLT Excel Sync') runs `scripts/excel_sync.py --apply`. All non-attendance points come only from the sheet (`SHEET_ONLY_POINTS` in utils/fanTier.ts).

## Goal
The exec team keeps points in one Excel sheet. Every day at 9:00 AM Central, the website's points update to match the sheet. If an audit finds a false claim, the team deletes that row in Excel, and the next 9 AM sync removes it from the site.

**Rule: Excel is the source of truth for the points it covers.** Remove points in the sheet, not on the site. A point deleted only on the website comes back at the next sync.

## How it works

```
Excel sheet (exec team edits)
      |  9:00 AM daily
      v
scripts/excel-sync.mjs
  1. read the sheet
  2. validate every row (member, category, points, date)
  3. diff against the site's Excel-sourced points
  4. safety checks (see below), back up, apply
  5. write a sync report
      v
Supabase bonus_points (only rows with source = 'excel')
      v
Website (leaderboard, member portal, fan tiers) updates on its own
```

### 1. Database change (one small migration)
- Add `source` (text, default 'app') and `sheet_key` (text, unique when present) to `bonus_points`.
- The sync only creates, updates or deletes rows where `source = 'excel'`. Game check-ins, event check-in codes, quick awards, referrals and shift attendance are never touched.
- `sheet_key` = a stable ID per sheet row so edits update in place instead of duplicating. Best option: an "ID" column in the sheet (filled once, never edited). Fallback: a hash of member + date + category + reason (then editing any of those fields counts as delete + re-add, which is fine).

### 2. Reading the sheet
- Use the `xlsx` (SheetJS) package in a Node script, same style as the existing `scripts/pending-*.mjs`, with dry-run by default and `--apply` to write.
- Match names to `members` (first + last, case/space-insensitive, nickname table for exceptions). **Never auto-create members.** Unmatched names are skipped and listed in the report.
- Categories must match `POINT_CATEGORIES`. Bad categories, blank or non-numeric points, or unparseable dates are skipped and reported. One bad row never blocks the rest.

### 3. Safety checks (because the sync can delete points)
- **Mass-delete guard:** if a run would delete more than 10 rows or more than 15% of the Excel-sourced points, it stops, changes nothing, and flags it. This protects against a half-saved, renamed or re-sorted sheet wiping everyone's points.
- **Empty or unreadable sheet:** stop and change nothing.
- **Backup first:** each applied run saves the current Excel-sourced rows to `sync-backups/YYYY-MM-DD.json` (gitignored), so any run can be undone.
- **Report every run:** `sync-reports/YYYY-MM-DD.md` lists added, changed, removed, skipped (with reason), and member point totals that changed. Optional: email the report to Cooper (Gmail is already wired up for /mail-triage).

### 4. The 9 AM schedule
Depends on where the sheet lives (question 1 below):

| Sheet lives in | How the sync gets it | Runs from | Catch |
|---|---|---|---|
| Baylor OneDrive / SharePoint (synced to the laptop) | reads the local synced .xlsx | Windows Scheduled Task on the laptop, Daily 9:00 AM | Laptop must be on. Set "run as soon as possible after a missed start" so it catches up when the laptop wakes. Daily triggers work on this machine (AtLogOn does not). |
| Box (BPLT Box folder) | Box shared-link download | Same laptop task, or a Supabase Edge Function on pg_cron | Cloud version needs a Box link that allows direct download |
| Google Sheets | published CSV link | Supabase Edge Function + pg_cron at 9 AM CT, no laptop needed | Team edits in Google Sheets instead of Excel |

Recommendation: start with the **laptop Scheduled Task reading the OneDrive-synced file**. It's the fastest to build and keeps the team in Excel. Baylor blocks student app registrations for Microsoft Graph, so a cloud job can't read Baylor OneDrive directly. If missed mornings become a problem, move to the desktop or to Google Sheets + pg_cron.

Note: pg_cron runs in UTC, so 9:00 AM Central = `0 15 * * *` in CST (after Nov 1) and `0 14 * * *` in CDT. The laptop task uses local time, so this doesn't matter there.

### 5. Keys
The sync uses `SUPABASE_SERVICE_ROLE_KEY` if one is set, otherwise the public anon key (what it uses today). Note: `.env` is tracked in git (it only holds the public URL + anon key), so a service role key must NOT go in it. Put it in an untracked file instead. The repo is public. The sheet path lives in the gitignored `sync-state/sheet-path.txt`. This also keeps the sync working after the planned RLS / Supabase Auth hardening, when anon writes go away.

### 6. Rollout
1. Cooper uploads the new sheet after tonight's meeting.
2. Claude maps its columns, then writes the migration + `excel-sync.mjs`.
3. Cooper runs the migration SQL in the Supabase SQL editor.
4. **Dry run** against production: report only, no writes. Cooper and the exec team check the diff.
5. First `--apply` run done by hand, with a backup.
6. **Existing points:** decide how to handle points already on the site that the sheet now covers (question 4), so nobody gets double-counted.
7. Turn on the 9 AM Scheduled Task. Watch the first 3 reports.

## Decisions so far (2026-11-16)
- **The sheet lives in Box.** Options for getting it at 9 AM, best first:
  1. **Box Drive** on the laptop syncs the file to a local folder, and the laptop Scheduled Task reads it. No Box API needed.
  2. **Box shared-link download.** Only works if Baylor's Box lets a link download the file directly. That would allow a cloud job (no laptop).
  3. **Box API.** Probably blocked, same as Microsoft Graph, since Baylor admins have to approve apps.
- **The website mirrors the sheet.** Members' points on the site should equal the sheet. Still to confirm from the file: does the sheet include game/event attendance? If yes, check-in points must stop counting separately (or be excluded from the sheet) so nothing double counts.

## The sheet (BPLT Point Tracking System.xlsx, downloaded from Box 2026-11-16)
- **Activity Log** (table `ActivityLogTable`, rows 2-501): Member Name, Date Completed, Category, Activity, Points (formula), Notes / Verification. One row per award, which is the best layout for syncing. 27 used rows, 7 members, 8/28-11/15.
- **Activity Guide:** 26 activities with point values. These match the official framework. Activities are written as "Category: Activity".
- **Member Summary:** SUMIFS totals per member/category, with a hand-typed member list. The sync ignores this tab and calculates its own totals.

### Problems found in the sheet
1. **Most rows are worth 0 points in Excel.** The Points formula looks up the Activity in the Guide's "Category: Activity" list. 25 of the 26 filled rows type the activity without the "Category: " prefix, so the lookup fails and returns blank. Only Cal Baker's row matches. One row (Nina, 10/2 UCF hospitality) has a typed 2. So the Member Summary totals are mostly 0 right now. **Fix:** change the formula to also match without the prefix, or re-pick each activity from the dropdown. The sync will match both forms either way, and it calculates points from the Guide itself.
2. The Points column header reads "0" instead of a name.
3. Blank rows in the middle (rows 26-28), plus a row with only a name (Eric Ornelas). The sync skips these and reports them.
4. Row 11 has no dropdown validation (D2:D10 and D12:D501 have it).
5. The sheet says "Gameday". The site says "Game Day". The sync maps one to the other.
6. **The sheet has Attendance rows** (Nina, soccer vs Pepperdine 9/30). The site already gives attendance points from check-ins, so this would double count.

### Sync mapping
- Member: name → `members` (case/space-insensitive). Never created. Unmatched names are reported.
- Points: Guide value for the activity (with or without prefix). If the activity isn't in the Guide, use a typed number in the Points column if there is one. Otherwise skip and report.
- Category: from the Guide (fallback: the Category column). "Gameday" → "Game Day".
- Reason on the site: the Activity plus the Notes (e.g. "Edit video content (before/after parade reel)").
- `sheet_key`: hash of name + date + activity + notes. The sheet has no ID column. Changing any of those counts as delete + re-add, which gives the same result.

## Questions for Cooper (answer after the meeting)
1. **Where does the sheet live?** Baylor OneDrive/SharePoint, Box, or someone's laptop? Who edits it?
2. **What shape is it?** One row per award (name, date, category, points, reason) works best. A totals grid (one row per member, one column per category) can work too, but the site would then show one lump entry per category with no history.
3. **What does the sheet cover?** Only things the site can't track (hospitality, tabling, media, etc.)? Or everything, including game attendance? If attendance is in it too, it will double count with check-ins unless we turn one of them off.
4. **Points already on the site:** points already entered through Points Manager, Bulk Award or Quick Award. Keep them as they are? Or move them into the sheet so Excel holds everything?
5. **Removals happen in Excel only.** Confirm the team is OK with that. (The alternative is a "removed" flag on the site that the sync respects. That's more complicated.)
6. **Report:** email the daily report to you, the exec team, or no one?
