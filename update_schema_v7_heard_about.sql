-- "How did you hear about us?" field on the Interest form (2026-08-25)
--
-- Missed in the v6 interest-form migration -- the meeting notes' recruitment
-- flow spec included this as an optional field alongside phone/year.

alter table members add column if not exists heard_about text;

-- Verify
select column_name, data_type from information_schema.columns
where table_name = 'members' and column_name = 'heard_about';
