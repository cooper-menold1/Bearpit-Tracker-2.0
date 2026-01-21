-- Add Venue IDs to Sports table
ALTER TABLE sports ADD COLUMN IF NOT EXISTS venue_ids TEXT[] DEFAULT '{}';

-- Populate existing sports with their venue IDs
UPDATE sports SET venue_ids = '{"ferrell"}' WHERE id = 'vb';
UPDATE sports SET venue_ids = '{"bettylou"}' WHERE id = 'soccer';
UPDATE sports SET venue_ids = '{"foster", "ferrell"}' WHERE id = 'wbb';
UPDATE sports SET venue_ids = '{"foster", "ferrell"}' WHERE id = 'mbb';
UPDATE sports SET venue_ids = '{"hurd"}' WHERE id = 'mtennis';
UPDATE sports SET venue_ids = '{"hurd"}' WHERE id = 'wtennis';
UPDATE sports SET venue_ids = '{"ballpark"}' WHERE id = 'baseball';
UPDATE sports SET venue_ids = '{"getterman"}' WHERE id = 'softball';
UPDATE sports SET venue_ids = '{"ferrell"}' WHERE id = 'acro';

-- Verify
SELECT * FROM sports;
