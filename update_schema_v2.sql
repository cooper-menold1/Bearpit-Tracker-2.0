-- Add Fall/Spring Sport and Chair details to Members
ALTER TABLE members ADD COLUMN IF NOT EXISTS fall_sport_id TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS spring_sport_id TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_chair BOOLEAN DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT;

-- Add Attendance Threshold to Sports (default 0.5 i.e. 50%)
ALTER TABLE sports ADD COLUMN IF NOT EXISTS attendance_threshold FLOAT DEFAULT 0.5;

-- Verify
SELECT * FROM members LIMIT 1;
SELECT * FROM sports LIMIT 1;
