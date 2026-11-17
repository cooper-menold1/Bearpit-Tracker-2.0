-- BPLT Excel sync (2026-11-16): tag where each bonus point came from.
-- 'excel' = synced from the exec team's Box sheet by scripts/excel_sync.py.
-- 'app'   = everything entered on the site before/outside the sheet (kept, just not counted
--           while SHEET_ONLY_POINTS is on in utils/fanTier.ts). Nothing is deleted.
alter table public.bonus_points add column if not exists source text not null default 'app';
create index if not exists bonus_points_source_idx on public.bonus_points (source);
notify pgrst, 'reload schema';
-- Check: should return one row per source value.
select source, count(*) from public.bonus_points group by source;
