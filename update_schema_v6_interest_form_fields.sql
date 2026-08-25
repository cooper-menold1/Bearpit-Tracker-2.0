-- Interest form fields (2026-08-25)
--
-- Landing page redesign: Attendance Login loses its "unmatched name ->
-- capture as prospect" fallback (recycled into a dedicated public
-- "Interested in Joining?" form instead), which collects phone and class
-- year in addition to name/email. Both are net-new columns on members.

alter table members add column if not exists phone text;
alter table members add column if not exists year text;

-- Verify
select column_name, data_type from information_schema.columns
where table_name = 'members' and column_name in ('phone', 'year');
