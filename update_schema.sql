-- 1. Updates to Games Table
ALTER TABLE games ADD COLUMN IF NOT EXISTS points_value INTEGER DEFAULT 1;

-- 2. Create Bonus Points Table (Manual Adjustments)
CREATE TABLE IF NOT EXISTS bonus_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason TEXT,
    date TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for bonus_points
ALTER TABLE bonus_points ENABLE ROW LEVEL SECURITY;

-- Policies for bonus_points
CREATE POLICY "Public Read Access" ON bonus_points FOR SELECT USING (true);
CREATE POLICY "Authenticated Insert/Update/Delete" ON bonus_points FOR ALL 
USING (auth.role() IN ('authenticated', 'anon'));


-- 3. Create Selfie Votes Table
CREATE TABLE IF NOT EXISTS selfie_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selfie_id TEXT REFERENCES selfies(id) ON DELETE CASCADE,
    member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(selfie_id, member_id) -- Prevent multiple votes on same photo by same user
);

-- Enable RLS for selfie_votes
ALTER TABLE selfie_votes ENABLE ROW LEVEL SECURITY;

-- Policies for selfie_votes
CREATE POLICY "Public Read Access" ON selfie_votes FOR SELECT USING (true);
CREATE POLICY "Rate Limit / Auth Insert" ON selfie_votes FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'anon'));
CREATE POLICY "Owner Delete" ON selfie_votes FOR DELETE USING (true);
