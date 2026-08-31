-- "Who recommended you?" field on the Interest form (2026-08-31)
--
-- From the 2026-08-31 Bear Pit leadership meeting: the recruitment form
-- should capture the specific member who referred a prospect, distinct
-- from the existing general "How did you hear about us?" channel field.

alter table members add column if not exists referred_by text;

-- Verify
select column_name, data_type from information_schema.columns
where table_name = 'members' and column_name = 'referred_by';
